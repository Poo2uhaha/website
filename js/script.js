// Interactive custom cursor script
// Moves the .cursor element with the mouse and adds a click effect.

// Ensure the DOM is fully loaded before attaching listeners
document.addEventListener('DOMContentLoaded', () => {
    const cursor = document.querySelector('.cursor');
    if (!cursor) return;

    // Move cursor with mouse
    document.addEventListener('mousemove', (e) =>
        {
        // Position the cursor element centered on the pointer
        const x = e.clientX;
        const y = e.clientY;
        // Use left/top positioning so the CSS centering transform (-50%,-50%) remains
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
        });
    // Add a brief scaling effect on click
    document.addEventListener('click', () => {
        cursor.classList.add('click');
        // Remove the class after the animation duration (150ms)
        setTimeout(() => {
            cursor.classList.remove('click');
        }, 150);
    });
});
