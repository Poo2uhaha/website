// ---------------------------------------------------------------
// Hexagonal Grid with Repulsive Spring Distortion
// ---------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gridCanvas');
    const ctx = canvas.getContext('2d');

    // -----------------------------------------------------------------
    // Configuration
    // -----------------------------------------------------------------
    const hexSize = 40;              // Distance between points
    const lineWidth = 1;
    const nodeRadius = 2;
    const mouseRadius = 150;         // Radius of illumination falloff
    const repulsionForce = 0.015;     // Push magnitude (smaller = milder)
    const stiffness = 0.015;          // Spring back strength (smaller = sluggish)
    const damping = 0.94;            // High damping for sluggish movement

    // Illumination color ramps: dim (far/unlit) -> bright (at cursor)
    const baseNodeRGB = [60, 60, 60],   baseNodeA = 0.5;
    const litNodeRGB  = [225, 225, 235], litNodeA = 0.95;
    const baseLineRGB = [60, 60, 60],   baseLineA = 0.45;
    const litLineRGB  = [180, 190, 210], litLineA = 0.9;

    function lerp(a, b, t) { return a + (b - a) * t; }

    // Smoothstep-eased brightness in [0, 1] based on distance from the cursor
    function brightnessAt(px, py) {
        const dist = Math.hypot(px - mouse.x, py - mouse.y);
        const t = Math.max(0, Math.min(1, 1 - dist / mouseRadius));
        return t * t * (3 - 2 * t);
    }

    function colorForBrightness(t, baseRGB, baseA, litRGB, litA) {
        const r = lerp(baseRGB[0], litRGB[0], t) | 0;
        const g = lerp(baseRGB[1], litRGB[1], t) | 0;
        const b = lerp(baseRGB[2], litRGB[2], t) | 0;
        const a = lerp(baseA, litA, t);
        return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
    }

    // -----------------------------------------------------------------
    // State
    // -----------------------------------------------------------------
    let points = [];                 // {x, y, ox, oy, vx, vy}
    let mouse = { x: -9999, y: -9999 };
    let width, height;

    function buildGrid() {
        points = [];
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        const a = hexSize; 
        const v1x = a * Math.sqrt(3);
        const v1y = 0;
        const v2x = (a * Math.sqrt(3)) / 2;
        const v2y = a * 1.5;

        const tauBx = 0;
        const tauBy = a;

        // Calculate range to cover viewport exactly
        const rangeX = Math.ceil(width / v1x) + 2;
        const rangeY = Math.ceil(height / v2y) + 2;

        for (let j = -1; j < rangeY; j++) {
            for (let i = -1; i < rangeX; i++) {
                const ax = i * v1x + j * v2x;
                const ay = i * v1y + j * v2y;
                const bx = ax + tauBx;
                const by = ay + tauBy;

                // Store nodes with their grid indices for O(1) lookup
                points.push({ x: ax, y: ay, ox: ax, oy: ay, vx: 0, vy: 0, type: 'A', i, j });
                points.push({ x: bx, y: by, ox: bx, oy: by, vx: 0, vy: 0, type: 'B', i, j });
            }
        }
    }

    document.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
    });

    function updatePoints() {
        for (const p of points) {
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const distSq = dx * dx + dy * dy;
            const radiusSq = mouseRadius * mouseRadius;

            if (distSq < radiusSq) {
                // PUSH AWAY from cursor
                const force = (1 - Math.sqrt(distSq) / mouseRadius) * repulsionForce;
                p.vx += dx * force;
                p.vy += dy * force;
            }

            // Spring back to rest
            const sx = p.ox - p.x;
            const sy = p.oy - p.y;
            p.vx += sx * stiffness;
            p.vy += sy * stiffness;

            p.vx *= damping;
            p.vy *= damping;
            p.x += p.vx;
            p.y += p.vy;
        }
    }

    function draw() {
        ctx.fillStyle = '#121212';
        ctx.fillRect(0, 0, width, height);

        // Optimization: create a spatial map for points to avoid O(N^2) searching
        const gridMap = new Map();
        points.forEach((p, idx) => {
            const key = `${p.type}-${p.i}-${p.j}`;
            gridMap.set(key, idx);
        });

        for (let i = 0; i < points.length; i++) {
            const p = points[i];

            const tSelf = brightnessAt(p.x, p.y);
            // Nodes glow brighter and swell slightly the closer they are to the cursor
            ctx.beginPath();
            ctx.arc(p.x, p.y, nodeRadius + tSelf * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = colorForBrightness(tSelf, baseNodeRGB, baseNodeA, litNodeRGB, litNodeA);
            ctx.fill();

            if (p.type === 'A') {
                // Fixed connectivity for the honeycomb lattice.
                // Basis: v1=(s3,0), v2=(s3/2, 1.5), tau_B=(0, a)
                // Neighbors of A(i, j), each at bond length a:
                // 1. B(i, j)     -> offset (0, a)          straight down
                // 2. B(i, j-1)   -> offset (-s3/2, -0.5a)  up-left
                // 3. B(i+1, j-1) -> offset (+s3/2, -0.5a)  up-right
                const targets = [
                    { t: 'B', i: p.i,     j: p.j },       // Down
                    { t: 'B', i: p.i,     j: p.j - 1 },   // Up-left
                    { t: 'B', i: p.i + 1, j: p.j - 1 }    // Up-right (was i-1,j+1 -- wrong neighbor)
                ];

                targets.forEach(target => {
                    const targetIdx = gridMap.get(`${target.t}-${target.i}-${target.j}`);
                    if (targetIdx !== undefined) {
                        const p2 = points[targetIdx];
                        const tOther = brightnessAt(p2.x, p2.y);

                        // Per-segment gradient so light flows smoothly from a
                        // lit endpoint into a dim one, rather than one flat color
                        const grad = ctx.createLinearGradient(p.x, p.y, p2.x, p2.y);
                        grad.addColorStop(0, colorForBrightness(tSelf, baseLineRGB, baseLineA, litLineRGB, litLineA));
                        grad.addColorStop(1, colorForBrightness(tOther, baseLineRGB, baseLineA, litLineRGB, litLineA));

                        ctx.beginPath();
                        ctx.strokeStyle = grad;
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                });
            }
        }
    }

    function animate() {
        updatePoints();
        draw();
        requestAnimationFrame(animate);
    }

    function init() {
        console.log('Grid Init started');
        try {
            buildGrid();
            console.log('Grid built with', points.length, 'points');
            animate();
            console.log('Animation loop started');
        } catch (e) {
            console.error('Error during grid initialization:', e);
        }
    }
    window.addEventListener('resize', () => buildGrid());
    init();
});
