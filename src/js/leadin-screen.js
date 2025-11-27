import { createDragHandler } from './drag.js';
import { createLeadInSwiper } from './leadin-swiper.js';

export function initLeadInScreen(screen, navigateToStartScreen) {
    const tellSwipeRight = screen.querySelector('#tell-swipe-right');
    const tellSwipeUp = screen.querySelector('#tell-swipe-up');
    const leadinPlayButton = screen.querySelector('#leadin-play-button');
    const playButtonRect = leadinPlayButton.querySelector('#play-button-bg'); // Target the visual element
    const playButtonText = leadinPlayButton.querySelector('#play-button-text-path'); // Target the visual element
    const vSwiperElement = screen.querySelector('#leadin-v-swiper');
    const hSwiperElement = screen.querySelector('#leadin-h-swiper');
    let idleTimer;

    // Set initial state: hidden and ready for fade-in.
    playButtonRect.style.opacity = '0';
    playButtonRect.style.transition = 'opacity 0.3s ease-in-out';
    playButtonText.style.transition = 'opacity 0.3s ease-in-out';

    // Add transitions for smooth opacity changes on the swiper groups.
    vSwiperElement.style.transition = 'opacity 0.3s ease-in-out';
    hSwiperElement.style.transition = 'opacity 0.3s ease-in-out';

    // We must wait for the next animation frame to ensure the screen is visible in the DOM
    // before we try to initialize the swipers on its elements.
    requestAnimationFrame(() => {
        let activeSwiperId = null;

        // Initialize swipers FIRST, but without the callback yet.
        const leadinVSwiper = createLeadInSwiper({
            id: 'leadin-v',
            elementSelector: '#leadin-v-swiper',
            direction: 'vertical',
            itemSize: 50.8, // Height of a rect + spacing
            playSlideId: 'leadin-v-play',
            initialOverlapIndex: 3, // Start one slide down to avoid initial overlap
        });

        const leadinHSwiper = createLeadInSwiper({
            id: 'leadin-h',
            elementSelector: '#leadin-h-swiper',
            direction: 'horizontal',
            itemSize: 69.320833, // Width of a rect + spacing
            playSlideId: 'leadin-h-play',
            initialOverlapIndex: 3, // Start one slide down to avoid initial overlap
        });

        if (!leadinVSwiper || !leadinHSwiper) {
            console.error("Failed to initialize one or more lead-in swipers. Aborting lead-in screen setup.");
            return;
        }

        const handleSwiperActiveStateChange = (isActive, swiperId) => {
            if (isActive) {
                activeSwiperId = swiperId;
                const inactiveSwiper = (swiperId === 'leadin-v') ? leadinHSwiper : leadinVSwiper;
                if (inactiveSwiper) {
                    // The overlapping slide is the one currently at the intersection, not the static "play" slide.
                    const inactivePlaySlideId = inactiveSwiper.getOverlappingSlideId();

                    // Use querySelectorAll to hide ALL instances of the overlapping slide (original and clones).

                    inactiveSwiper.getElement().querySelectorAll(`[data-slide-id="${inactivePlaySlideId}"]`).forEach(slide => {
                        slide.style.visibility = 'hidden';
                    });
                }
            } else {
                // Only reset visibility if the swiper that just finished was the active one.
                // This prevents a rapid sequence of drags from prematurely showing the other swiper.
                if (activeSwiperId === swiperId) {
                    activeSwiperId = null;
                    // Restore visibility for ALL slides in both swipers to ensure a clean state.
                    // Use querySelectorAll to ensure all instances (clones) are made visible again.
                    leadinVSwiper.getElement().querySelectorAll(`[data-slide-id]`).forEach(slide => {
                        slide.style.visibility = 'visible';
                    });

                    leadinHSwiper.getElement().querySelectorAll(`[data-slide-id]`).forEach(slide => {
                        slide.style.visibility = 'visible';
                    });
                }
            }
        };

        // Now that the handler is defined and the swipers exist, register the callbacks.
        leadinVSwiper.onActiveStateChange = handleSwiperActiveStateChange;
        leadinHSwiper.onActiveStateChange = handleSwiperActiveStateChange;

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

        let vSwiperAtPlay = false;
        let hSwiperAtPlay = false;

        const checkPlayCondition = () => {
            vSwiperAtPlay = (leadinVSwiper.getOverlappingSlideId() === leadinVSwiper.getPlaySlideId());
            hSwiperAtPlay = (leadinHSwiper.getOverlappingSlideId() === leadinHSwiper.getPlaySlideId());

            if (vSwiperAtPlay && hSwiperAtPlay) {
                leadinPlayButton.classList.add('active');
                playButtonRect.style.opacity = '1';
                playButtonText.style.fillOpacity = '1';
                vSwiperElement.style.opacity = '0.5';
                hSwiperElement.style.opacity = '0.5';
                // Detach drag handler once play button is active to prevent further swiping
                dragHandler.detach();
            } else {
                leadinPlayButton.classList.remove('active');
                playButtonRect.style.opacity = '0';
                playButtonText.style.fillOpacity = '0.384956';
                vSwiperElement.style.opacity = '1';
                hSwiperElement.style.opacity = '1';
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

        leadinPlayButton.addEventListener('click', navigateToStartScreen);
    });
}
