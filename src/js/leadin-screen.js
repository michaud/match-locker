export function initLeadInScreen(screen) {
    const tellSwipeRight = screen.querySelector('#tell-swipe-right');
    const tellSwipeUp = screen.querySelector('#tell-swipe-up');
    let idleTimer;

    function showIdleIndicators() {
        tellSwipeRight.classList.add('visible');
        tellSwipeUp.classList.add('visible');
    }

    function resetIdleTimer() {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(showIdleIndicators, 8000); // 2 minutes
    }

    function handleInteraction() {
        resetIdleTimer();
        tellSwipeRight.classList.remove('visible');
        tellSwipeUp.classList.remove('visible');
    }

    // Add a class to the screen to trigger the initial animations via CSS
    screen.classList.add('start-animation');

    // Set up idle timer
    resetIdleTimer();
    screen.addEventListener('pointerdown', handleInteraction, { once: true });
    screen.addEventListener('keydown', handleInteraction, { once: true });
}
