// ---------------------------------------------------------------
// Hexagonal Grid with Repulsive Spring Distortion (Optimized)
// ---------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gridCanvas');
    const ctx = canvas.getContext('2d');

    // -----------------------------------------------------------------
    // Configuration
    // -----------------------------------------------------------------
    const hexSize = 40;                 // Distance between points
    const lineWidth = 1;
    const nodeRadius = 2;
    const baseMouseRadius = 150;        // Radius of illumination falloff
    const repulsionForce = 0.015;       // Push magnitude (smaller = milder)
    const stiffness = 0.02;             // Spring back strength (smaller = sluggish)
    const damping = 0.85;               // High damping for sluggish movement

    // Illumination color ramps: dim (far/unlit) -> bright (at cursor)
    const baseNodeRGB = [60, 60, 60],   baseNodeA = 0.5;
    const litNodeRGB  = [225, 225, 235], litNodeA = 0.95;
    const baseLineRGB = [60, 60, 60],   baseLineA = 0.45;
    const litLineRGB  = [180, 190, 210], litLineA = 0.9;

    function lerp(a, b, t) { return a + (b - a) * t; }

    // Smoothstep-eased brightness in [0, 1] based on distance from the cursor
    function brightnessAt(px, py) {
        const dx = px - mouse.x;
        const dy = py - mouse.y;
        const distSq = dx * dx + dy * dy;
        const radiusSq = currentMouseRadius * currentMouseRadius;

        if (distSq >= radiusSq) return 0;

        const dist = Math.sqrt(distSq);
        const t = 1 - dist / currentMouseRadius;
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
    let points = [];                    // {x, y, ox, oy, vx, vy, brightness}
    let mouse = { x: -9999, y: -9999 };
    let gridMap = new Map();   
    let width, height;
    let baseArea = null;
    let zoomScale = 1;          
    let currentMouseRadius = 150;

    function buildGrid() {
        points = [];
        gridMap.clear();
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        const currentArea = width * height;
        if (baseArea === null) baseArea = currentArea;
        
        // OPTIMIZATION: Cap the zoom scale to prevent performance crashes on 4K/fullscreen monitors
        zoomScale = Math.min(Math.sqrt(currentArea / baseArea), 1.8);

        currentMouseRadius = baseMouseRadius * zoomScale;
        const a = hexSize * zoomScale;

        const v1x = a * Math.sqrt(3);
        const v1y = 0;
        const v2x = (a * Math.sqrt(3)) / 2;
        const v2y = a * 1.5;

        const tauBx = 0;
        const tauBy = a;

        const rangeY = Math.ceil(height / v2y) + 2;

        for (let j = -1; j < rangeY; j++) {
            const iStart = Math.floor(-(j * v2x) / v1x) - 1;
            const iEnd = Math.ceil((width - j * v2x) / v1x) + 1;

            for (let i = iStart; i <= iEnd; i++) {
                const ax = i * v1x + j * v2x;
                const ay = i * v1y + j * v2y;
                const bx = ax + tauBx;
                const by = ay + tauBy;

                points.push({ x: ax, y: ay, ox: ax, oy: ay, vx: 0, vy: 0, type: 'A', i, j, brightness: 0 });
                points.push({ x: bx, y: by, ox: bx, oy: by, vx: 0, vy: 0, type: 'B', i, j, brightness: 0 });
            }
        }

        points.forEach((p, idx) => {
            const key = `${p.type}-${p.i}-${p.j}`;
            gridMap.set(key, idx);
        });
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
            const radiusSq = currentMouseRadius * currentMouseRadius;

            if (distSq < radiusSq) {
                const force = (1 - Math.sqrt(distSq) / currentMouseRadius) * repulsionForce;
                p.vx += dx * force;
                p.vy += dy * force;
            }

            const sx = p.ox - p.x;
            const sy = p.oy - p.y;
            p.vx += sx * stiffness;
            p.vy += sy * stiffness;

            p.vx *= damping;
            p.vy *= damping;
            p.x += p.vx;
            p.y += p.vy;

            // OPTIMIZATION: Cache brightness here once per frame so draw() doesn't recalculate it
            p.brightness = brightnessAt(p.x, p.y);
        }
    }

    function draw() {
        ctx.fillStyle = '#121212';
        ctx.fillRect(0, 0, width, height);

        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const tSelf = p.brightness; // Using cached value
            const currentRadius = (nodeRadius + tSelf * 1.5) * zoomScale;

            ctx.beginPath();
            ctx.arc(p.x, p.y, currentRadius + tSelf * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = colorForBrightness(tSelf, baseNodeRGB, baseNodeA, litNodeRGB, litNodeA);
            ctx.fill();

            if (p.type === 'A') {
                const targets = [
                    { t: 'B', i: p.i,     j: p.j },       // Down
                    { t: 'B', i: p.i,     j: p.j - 1 },   // Up-left
                    { t: 'B', i: p.i + 1, j: p.j - 1 }    // Up-right
                ];

                ctx.lineWidth = lineWidth * zoomScale;

                targets.forEach(target => {
                    const targetIdx = gridMap.get(`${target.t}-${target.i}-${target.j}`);
                    if (targetIdx !== undefined) {
                        const p2 = points[targetIdx];
                        const tOther = p2.brightness; // Using cached value

                        // OPTIMIZATION: Replaced slow createLinearGradient with a fast solid averaged stroke color
                        const avgT = (tSelf + tOther) * 0.5;

                        ctx.beginPath();
                        ctx.strokeStyle = colorForBrightness(avgT, baseLineRGB, baseLineA, litLineRGB, litLineA);
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                });
            }
        }
    }

    function animate() {
        // Optional Debug timing to test performance in the browser console
        const t0 = performance.now();
        updatePoints();
        draw();
        const t1 = performance.now();

        // Uncomment the line below if you want to inspect frame times in production
        // if ((t1 - t0) > 20) console.warn(`Slow frame: ${(t1 - t0).toFixed(1)}ms | Points: ${points.length}`);

        requestAnimationFrame(animate);
    }

    function init() {
        try {
            buildGrid();
            animate();
        } catch (e) {
            console.error('Error during grid initialization:', e);
        }
    }

    let rebuildTimer = null;
    function scheduleRebuild() {
        clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(buildGrid, 120);
    }

    window.addEventListener('resize', scheduleRebuild);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', scheduleRebuild);
    }

    init();
});