import { createDragHandler } from './drag.js';
import { createLeadInSwiper } from './leadin-swiper.js';

export function initLeadInScreen(screen, navigateToStartScreen, settingsManager) {
    const tellSwipeRight = screen.querySelector('#tell-swipe-right');
    const tellSwipeUp = screen.querySelector('#tell-swipe-up');
    const leadinPlayButton = screen.querySelector('#leadin-play-button');
    const playButtonRect = leadinPlayButton.querySelector('#play-button-bg'); // Target the visual element
    const playButtonText = leadinPlayButton.querySelector('#play-button-text-path'); // Target the visual element
    const vSwiperElement = screen.querySelector('#leadin-v-swiper');
    const hSwiperElement = screen.querySelector('#leadin-h-swiper');
    const noLeadinContainer = screen.querySelector('.no-leadin');
    const logoBigBg = screen.querySelector('#logo-big-bg');
    let idleTimer;

    // Set initial state: hidden and ready for fade-in.
    playButtonRect.style.opacity = '0';
    playButtonRect.style.transition = 'opacity 0.3s ease-in-out';
    playButtonText.style.transition = 'opacity 0.3s ease-in-out';

    // Add transitions for smooth opacity changes on the swiper groups.
    vSwiperElement.style.transition = 'opacity 0.3s ease-in-out';
    hSwiperElement.style.transition = 'opacity 0.3s ease-in-out';
    noLeadinContainer.style.display = 'none'; // Initially hide the checkbox container

    // --- "Skip Lead-in" Logic ---
    const currentSettings = settingsManager.getSettings();

    if (currentSettings.hasVisited) {
        const noLeadinCheckbox = noLeadinContainer.querySelector('input[type="checkbox"]');
        noLeadinCheckbox.checked = currentSettings.skipLeadin;

        noLeadinCheckbox.addEventListener('change', (event) => {
            settingsManager.updateSetting('skipLeadin', event.target.checked);
        });

        // Wait for the logo fade-out animation to complete before showing the checkbox.
        // This ensures the UI elements appear in a logical sequence.
        const showCheckboxOnAnimationEnd = () => {
            noLeadinContainer.style.display = 'grid';
            logoBigBg.removeEventListener('animationend', showCheckboxOnAnimationEnd);
        };
        logoBigBg.addEventListener('animationend', showCheckboxOnAnimationEnd);
    }

    // Mark that the user has now seen the lead-in screen for future visits.
    settingsManager.updateSetting('hasVisited', true);

    // We must wait for the next animation frame to ensure the screen is visible in the DOM
    // before we try to initialize the swipers on its elements.
    requestAnimationFrame(() => {
        let activeSwiperId = null;
        let hiddenElements = [];

        // Initialize swipers FIRST, but without the callback yet.
        const leadinVSwiper = createLeadInSwiper({
            id: 'leadin-v',
            elementSelector: '#leadin-v-swiper',
            direction: 'vertical',
            itemSize: 50.8, // Height of a rect + spacing
            playSlideId: 'leadin-v-play',
            throwMultiplier: 0.7, // Slower swipe on release
            dragFactor: 0.4, // Slower movement during drag
            initialOverlapIndex: 3, // Start one slide down to avoid initial overlap
        });

        const leadinHSwiper = createLeadInSwiper({
            id: 'leadin-h',
            elementSelector: '#leadin-h-swiper',
            direction: 'horizontal',
            itemSize: 69.320833, // Width of a rect + spacing
            playSlideId: 'leadin-h-play',
            throwMultiplier: 0.7, // Slower swipe on release
            dragFactor: 0.4, // Slower movement during drag
            initialOverlapIndex: 3, // Start one slide down to avoid initial overlap
        });

        if (!leadinVSwiper || !leadinHSwiper) {
            console.error("Failed to initialize one or more lead-in swipers. Aborting lead-in screen setup.");
            return;
        }

        const handleSwiperActiveStateChange = (isActive, swiperId) => {
            if (isActive) {
                playButtonRect.style.visibility = 'hidden';
                hiddenElements = []; // Clear previous state on new drag start
                const activeSwiper = (swiperId === 'leadin-v') ? leadinVSwiper : leadinHSwiper;

                // Bring the active swiper to the front by appending it to its parent.
                // In SVG, the last element in the document order is rendered on top.
                const activeElement = activeSwiper.getElement();
                if (activeElement.parentElement) {
                    // This moves the active swiper's <g> element to be the last child of its container,
                    // ensuring it draws on top of the inactive swiper.
                    activeElement.parentElement.appendChild(activeElement);
                }
                activeSwiperId = swiperId;
                const inactiveSwiper = (swiperId === 'leadin-v') ? leadinHSwiper : leadinVSwiper;
                if (inactiveSwiper) {
                    // The overlapping slide is the one currently at the intersection, not the static "play" slide.
                    const inactivePlaySlideId = inactiveSwiper.getOverlappingSlideId();

                    // Use querySelectorAll to hide ALL instances of the overlapping slide (original and clones).

                    // This implements the specific instruction for the horizontal swipe.
                    if (swiperId === 'leadin-h' && inactivePlaySlideId === 'leadin-v-play') {
                        inactiveSwiper.getElement().querySelectorAll(`[id="rect130"],[id="rect47"], [id="rect247"], [id="play-button-bg"], [data-slide-id="leadin-v-play"]`).forEach(el => {
                                el.style.visibility = 'hidden';
                                hiddenElements.push(el);
                        });
                    } else {
                        // Use the existing logic for the vertical swipe, as it was working correctly.
                        inactiveSwiper.getElement().querySelectorAll(`[data-slide-id="${inactivePlaySlideId}"]`).forEach(slideGroup => {
                            slideGroup.style.visibility = 'hidden';
                            hiddenElements.push(slideGroup);
                        });
                    }
                }
            } else {
                playButtonRect.style.visibility = 'visible';
                // Only reset visibility if the swiper that just finished was the active one.
                // This prevents a rapid sequence of drags from prematurely showing the other swiper.
                if (activeSwiperId === swiperId) {
                    activeSwiperId = null;
                    // Restore visibility only for the elements that were hidden during this specific interaction.
                    hiddenElements.forEach(element => {
                        element.style.visibility = 'visible';
                    });
                    hiddenElements = []; // Clear the array after use
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
            () => {
                // This is the onDragStartCallback for the lead-in screen.
                // It's primarily for visual feedback, similar to the game screen.
                screen.style.cursor = 'grabbing';
                screen.classList.add('is-dragging');

                // A swipe has started, so permanently disable the idle handling.
                clearTimeout(idleTimer);
                screen.removeEventListener('pointerdown', handleInteraction);
                screen.removeEventListener('keydown', handleInteraction);
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
            clearTimeout(idleTimer);
            idleTimer = setTimeout(showIdleIndicators, 8000); // 2 minutes
        }

        function handleInteraction() {
            resetIdleTimer();
            // The indicators are hidden inside the drag start callback now,
            // this function is just for resetting the timer on non-swipe interactions.
        }

        // Add a class to the screen to trigger the initial animations via CSS
        screen.classList.add('start-animation');

        // Set up idle timer
        resetIdleTimer();

        screen.addEventListener('pointerdown', handleInteraction);
        screen.addEventListener('keydown', handleInteraction);

        leadinPlayButton.addEventListener('click', navigateToStartScreen);
    });
}
