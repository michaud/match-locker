import { createDragHandler } from './drag.js';
import { createLeadInSwiper } from './leadin-swiper.js';

export function initLeadInScreen(screen, navigateToStartScreen) {
    const tellSwipeRight = screen.querySelector('#tell-swipe-right');
    const tellSwipeUp = screen.querySelector('#tell-swipe-up');
    const leadinPlayButton = screen.querySelector('#leadin-play-button');
    let idleTimer;

    // We must wait for the next animation frame to ensure the screen is visible in the DOM
    // before we try to initialize the swipers on its elements.
    requestAnimationFrame(() => {
        // Initialize Lead-in Swipers
        const leadinVSwiper = createLeadInSwiper({
            id: 'leadin-v',
            elementSelector: '#leadin-v-swiper',
            direction: 'vertical',
            itemSize: 50.8, // Calculated from SVG rect positions (e.g., 67.46875 - 16.668749)
            initialIndex: 0, // Start showing 'leadin-v-0'
            playSlideId: 'leadin-v-play',
        });

        const leadinHSwiper = createLeadInSwiper({
            id: 'leadin-h',
            elementSelector: '#leadin-h-swiper',
            direction: 'horizontal',
            itemSize: 69.32, // Calculated from SVG rect positions (e.g., 95.25 - 25.929167)
            initialIndex: 0, // Start showing 'leadin-h-0'
            playSlideId: 'leadin-h-play',
        });

        if (!leadinVSwiper || !leadinHSwiper) {
            console.error("Failed to initialize one or more lead-in swipers. Aborting lead-in screen setup.");
            return;
        }

        let vSwiperAtPlay = false;
        let hSwiperAtPlay = false;

        const checkPlayCondition = () => {
            vSwiperAtPlay = (leadinVSwiper.getCurrentSlideId() === leadinVSwiper.getPlaySlideId());
            hSwiperAtPlay = (leadinHSwiper.getCurrentSlideId() === leadinHSwiper.getPlaySlideId());

            if (vSwiperAtPlay && hSwiperAtPlay) {
                leadinPlayButton.classList.add('active');
                // Detach drag handler once play button is active to prevent further swiping
                dragHandler.detach();
            } else {
                leadinPlayButton.classList.remove('active');
            }
        };

        // Listen for snapComplete events on lead-in swipers
        leadinVSwiper.on('snapComplete', checkPlayCondition);
        leadinHSwiper.on('snapComplete', checkPlayCondition);

        // Initial check for play condition
        checkPlayCondition();

        function showIdleIndicators() {
            tellSwipeRight.classList.add('visible');
            tellSwipeUp.classList.add('visible');
        }

        function resetIdleTimer() {
            // clearTimeout(idleTimer);
            // idleTimer = setTimeout(showIdleIndicators, 8000); // 2 minutes
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

        // Drag handler for lead-in screen swipers
        const dragHandler = createDragHandler(
            screen,
            () => ({ hostSwiper: leadinHSwiper, guestSwiper: leadinVSwiper }), // Return lead-in swipers
            () => { /* No tap callback for lead-in screen */ },
            (dragSwiper, otherSwiper) => {
                // This is the onDragStartCallback for the lead-in screen.
                // It's primarily for visual feedback, similar to the game screen.
                screen.style.cursor = 'grabbing';
                screen.classList.add('is-dragging');
                // Hide idle indicators if dragging starts
                tellSwipeRight.classList.remove('visible');
                tellSwipeUp.classList.remove('visible');
            }
        );
        dragHandler.attach();

        leadinPlayButton.addEventListener('click', navigateToStartScreen);
    });
}
