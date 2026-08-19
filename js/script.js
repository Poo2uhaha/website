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
    const baseLineColor = 'rgba(60, 60, 60, 0.5)'; 
    const activeLineColor = 'rgba(150, 150, 150, 0.8)';
    const nodeRadius = 2;
    const mouseRadius = 150;         // Radius of influence
    const repulsionForce = 0.03;     // Push magnitude (smaller = milder)
    const stiffness = 0.02;          // Spring back strength (smaller = sluggish)
    const damping = 0.92;            // High damping for sluggish movement

    // -----------------------------------------------------------------
    // State
    // -----------------------------------------------------------------
    let points = [];                 // {x, y, ox, oy, vx, vy}
    let mouse = { x: -9999, y: -9999 };
    let width, height;

    function buildGrid() {
        points = [];
        // Use window.innerWidth/innerHeight instead of canvas.clientWidth
        // because the canvas might not have layout dimensions yet
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        const cols = Math.ceil(width / (hexSize * 0.866)) + 1;
        const rows = Math.ceil(height / (hexSize * 0.75)) + 1;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Hexagonal offset
                const ox = c * hexSize * 0.866;
                const oy = (r * hexSize * 0.75) + (c % 2 === 0 ? 0 : (hexSize * 0.375));
                points.push({ x: ox, y: oy, ox, oy, vx: 0, vy: 0 });
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

        const cols = Math.ceil(width / (hexSize * 0.866)) + 1;
        
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const col = i % cols;
            const row = Math.floor(i / cols);

            // Determine if this point is "illuminated"
            const dist = Math.hypot(p.x - mouse.x, p.y - mouse.y);
            const isLit = dist < mouseRadius;
            const color = isLit ? activeLineColor : baseLineColor;

            // Draw nodes
            ctx.beginPath();
            ctx.arc(p.x, p.y, nodeRadius, 0, Math.PI * 2);
            ctx.fillStyle = isLit ? 'rgba(200, 200, 200, 0.8)' : 'rgba(60, 60, 60, 0.5)';
            ctx.fill();

            // Draw connections to neighbors (hexagonal logic)
            const isEvenCol = col % 2 === 0;
            const targetNeighbors = isEvenCol ? 
                [{c: 1, r: 0}, {c: 1, r: 1}, {c: 0, r: 1}] : 
                [{c: 1, r: -1}, {c: 1, r: 0}, {c: 0, r: 1}];

            targetNeighbors.forEach(n => {
                const nc = col + n.c;
                const nr = row + n.r;
                if (nc >= 0 && nc < cols && nr >= 0 && nr < Math.floor(points.length / cols)) {
                    const index = nr * cols + nc;
                    if (index >= 0 && index < points.length) {
                        const p2 = points[index];
                        ctx.beginPath();
                        ctx.strokeStyle = color;
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                }
            });
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