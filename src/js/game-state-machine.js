/**
 * Creates and manages the state of the active game screen.
 * This includes handling transitions between idle states, animations,
 * and managing UI interactivity to prevent race conditions.
 *
 * @param {object} callbacks - Functions provided by the main app to allow
 *                             the state machine to interact with the game world.
 * @param {function} callbacks.getGame - Returns the activeGame object.
 * @param {function} callbacks.updateSwiperVisibility - Shows/hides swipers based on context.
 * @param {function} callbacks.snapSwipersToState - Moves swipers to their correct positions.
 * @param {function} callbacks.updateNavigationControls - Enables/disables nav buttons.
 * @param {function} callbacks.updatePuzzleStatusIndicator - Shows/hides the "SOLVED" badge.
 * @param {object} callbacks.matchVisualizer - The match visualizer instance.
 * @param {function} callbacks.getActivePuzzle - Function that returns the puzzle at the current location, or null.
 * @param {function} callbacks.checkPuzzleSolved - Function to check if the current puzzle is solved.
 * @param {function} callbacks.checkGameWin - Function to check if the entire game is won.
 * @param {object} callbacks.domElements - A collection of frequently used DOM elements.
 * @param {object} callbacks.interactionHandlers - { gameDragAndTapHandler, navigationHandler }
 */
export function createGameStateMachine(callbacks) {

    let debug = false;
    let currentState = null;

    // Unpack callbacks for easier access
    const {
        getGame,
        updateSwiperVisibility,
        snapSwipersToState,
        updateNavigationControls,
        updatePuzzleStatusIndicator,
        matchVisualizer,
        getActivePuzzle,
        getSettings,
        checkPuzzleSolved,
        checkGameWin,
        interactionHandlers
    } = callbacks;

    const states = {
        /**
         * The player is at a location that is NOT a puzzle slot.
         * - A single swiper is visible and interactive.
         * - Navigation and dragging are enabled.
         * - Tapping does nothing.
         */
        IDLE_ON_PATH: {
            onEnter() {

                debug && console.log("GameStateMachine: Entering IDLE_ON_PATH");
                // Ensure all visuals and controls are correctly set for the current state.
                matchVisualizer.synchronizeVisuals();
                updateNavigationControls();
                updatePuzzleStatusIndicator();
                // Enable user interaction.
                getGame().swiperInstances.forEach(swiper => {
                    swiper.on('endDrag', handleSwiperEndDrag);
                });

                interactionHandlers.navigationHandler.on('navigate', handleNavigationRequest);
                interactionHandlers.gameDragAndTapHandler.attach();
                interactionHandlers.navigationHandler.attach();
            },
            onExit() {

                getGame().swiperInstances.forEach(swiper => {
                    swiper.off('endDrag', handleSwiperEndDrag);
                });
                interactionHandlers.navigationHandler.off('navigate', handleNavigationRequest);
            },
            // Taps are ignored when not at a puzzle.
            handleTap: () => { /* Tap is ignored on path */ },
        },
        /**
         * The player is at a location that IS a puzzle slot.
         * - Host and guest swipers are visible and interactive.
         * - Navigation and dragging are enabled.
         * - Tapping triggers a match attempt.
         */
        IDLE_AT_PUZZLE: {
            onEnter() {
                debug && console.log("GameStateMachine: Entering IDLE_AT_PUZZLE");
                debug && console.log('getGame().worldMap:', JSON.stringify(Array.from(getGame().worldMap.entries())))

                // Ensure all visuals and controls are correctly set for the current state.
                matchVisualizer.synchronizeVisuals();
                updateNavigationControls();
                updatePuzzleStatusIndicator();
                // Enable user interaction.
                getGame().swiperInstances.forEach(swiper => {
                    swiper.on('endDrag', handleSwiperEndDrag);
                });
                interactionHandlers.navigationHandler.on('navigate', handleNavigationRequest);
                interactionHandlers.gameDragAndTapHandler.attach();
                interactionHandlers.navigationHandler.attach();
            },
            onExit() {
                getGame().swiperInstances.forEach(swiper => {
                    swiper.off('endDrag', handleSwiperEndDrag);
                });
                interactionHandlers.navigationHandler.off('navigate', handleNavigationRequest);
            },
            // Taps trigger a match attempt.
            handleTap: () => {
                handleMatchAttempt();
            }
        },
        /**
         * The game is animating a slide change within a single swiper after a drag/fling.
         * - All user input (drag, tap, navigation) is disabled to prevent race conditions.
         * - This state does NOT change swiper visibility.
         */
        SWIPING: {
            onEnter(context) {
                debug && console.log("GameStateMachine: Entering SWIPING with context:", context);
                const game = getGame();
                const { destination } = context;

                // Lock UI and clean up drag visuals
                interactionHandlers.gameDragAndTapHandler.detach();
                interactionHandlers.navigationHandler.detach();
                matchVisualizer.onDragEnd();

                if (!destination || !game.playerState) {
                    transitionTo('IDLE_ON_PATH'); // Failsafe
                    return;
                }

                const handleSnapComplete = () => {
                    const swiper = game.swiperInstances.get(destination.swiperId);
                    if (swiper) swiper.off('snapComplete', handleSnapComplete);

                    // After a swipe, the player is still at the same slot, so the puzzle status doesn't change.
                    const isAtPuzzle = !!getActivePuzzle();
                    transitionTo(isAtPuzzle ? 'IDLE_AT_PUZZLE' : 'IDLE_ON_PATH');
                };

                const targetSwiper = game.swiperInstances.get(destination.swiperId);
                if (targetSwiper) {
                    targetSwiper.on('snapComplete', handleSnapComplete);
                    // A swipe uses the fling calculation.
                    targetSwiper.snapTo(destination.index, false, { useFling: true });
                } else {
                    transitionTo('IDLE_ON_PATH'); // Failsafe
                }
            },
            onExit() { /* No action needed on exit */ }
        },
        /**
         * The game is animating a move between different slots (e.g., after a nav click).
         * - All user input is disabled.
         * - This state IS responsible for updating swiper visibility.
         */
        NAVIGATING: {
            onEnter(context) {
                debug && console.log("GameStateMachine: Entering NAVIGATING with context:", context);
                const game = getGame();
                const { destination } = context;

                // Lock UI
                interactionHandlers.gameDragAndTapHandler.detach();
                interactionHandlers.navigationHandler.detach();

                if (!destination || !game.playerState) {
                    transitionTo('IDLE_ON_PATH'); // Failsafe
                    return;
                }

                // A navigation click can change the active swiper and its index.
                game.playerState.currentSwiperId = destination.swiperId;
                game.playerState.currentIndex = destination.index;

                debug && console.log(`%c[DEBUG] NAVIGATING: Destination Swiper ID: ${destination.swiperId}`, 'color: #FFD700;');
                debug && console.log(`%c[DEBUG] NAVIGATING: New Player State Swiper ID: ${game.playerState.currentSwiperId}`, 'color: #FFD700;');

                // Update visibility for the new location.
                const done = updateSwiperVisibility();

                const handleSnapComplete = () => {
                    debug && console.log('%c[DEBUG] NAVIGATING: handleSnapComplete called!', 'color: #98FB98;');

                    const swiper = game.swiperInstances.get(destination.swiperId);
                    if (swiper) swiper.off('snapComplete', handleSnapComplete);

                    // Determine the new stable state based on the destination.
                    const isAtPuzzle = !!getActivePuzzle();
                    transitionTo(isAtPuzzle ? 'IDLE_AT_PUZZLE' : 'IDLE_ON_PATH');
                };
                // Force the browser to render the visibility change before starting the animation.
                // This prevents a race condition where the transitionend event might not fire.
                requestAnimationFrame(() => {
                    snapSwipersToState(true, handleSnapComplete);
                });
            },
            onExit() { /* No action needed on exit */ }
        }
    };

    const handleMatchAttempt = () => {
        const game = getGame();
        const settings = getSettings();
        const activePuzzle = getActivePuzzle();

        if (!activePuzzle) return;

        const currentKey = `${game.playerState.currentSwiperId}-${game.playerState.currentIndex}`;
        const currentNode = game.worldMap.get(currentKey);

        if (!currentNode) return;

        const hostSwiper = game.swiperInstances.get(game.playerState.currentSwiperId);
        const guestSwiper = currentNode.guest ? game.swiperInstances.get(currentNode.guest.swiperId) : null;

        if (!hostSwiper || !guestSwiper) return;

        const hId = hostSwiper.getCurrentSlideId();
        const vId = guestSwiper.getCurrentSlideId();

        if (!game.gameState.playerMatchesByPuzzle.has(activePuzzle.id)) {
            game.gameState.playerMatchesByPuzzle.set(activePuzzle.id, new Map());
        }

        const puzzleMatches = game.gameState.playerMatchesByPuzzle.get(activePuzzle.id);
        const existingMatch = puzzleMatches.get(hId);

        if (existingMatch === vId) {
            puzzleMatches.delete(hId);
        } else {
            puzzleMatches.set(hId, vId);
        }

        // Always synchronize visuals after a match attempt.
        matchVisualizer.synchronizeVisuals();

        // If auto-completion is on, check for solved status.
        if (settings.puzzleCompletion === 'game-finishes') {
            checkPuzzleSolved();
            checkGameWin();
        }
    };

    const handleSwiperEndDrag = ({ swiper, finalIndex }) => {
        const destination = {
            swiperId: swiper.swiperId,
            index: finalIndex,
            source: 'drag'
        };
        // A drag has ended, so we transition to the SWIPING state.
        transitionTo('SWIPING', { destination });
    };

    const handleNavigationRequest = ({ direction }) => {
        const game = getGame();

        if (!game || !game.playerState || !game.playerState.currentSwiperId) return;

        const currentKey = `${game.playerState.currentSwiperId}-${game.playerState.currentIndex}`;
        const currentNode = game.worldMap.get(currentKey);

        if (!currentNode) return;

        const destination = currentNode[direction];

        if (!destination) return;

        // A navigation request has been received, so we transition to the NAVIGATING state.
        transitionTo('NAVIGATING', { destination });
    };

    /**
     * Starts the state machine by determining and transitioning to the initial state.
     */
    function start() {
        const game = getGame();
        if (!game || !game.playerState) {
            console.error("GameStateMachine: Cannot start without a game and playerState.");
            return;
        }

        const isAtPuzzle = !!getActivePuzzle();

        snapSwipersToState(false); // Perform the initial, non-animated snap.
        updateSwiperVisibility(); // Set initial visibility.
        transitionTo(isAtPuzzle ? 'IDLE_AT_PUZZLE' : 'IDLE_ON_PATH');
    }

    function transitionTo(newState, context = {}) {
        if (!states[newState]) {
            console.error(`Unknown state: ${newState}`);
            return;
        }

        if (currentState && states[currentState].onExit) {
            states[currentState].onExit();
        }

        currentState = newState;

        if (states[currentState].onEnter) {
            states[currentState].onEnter(context);
        }
    }

    function destroy() {
        // Explicitly detach all handlers when the game is torn down.
        interactionHandlers.gameDragAndTapHandler.detach();
        interactionHandlers.navigationHandler.detach();
        debug && console.log("GameStateMachine destroyed.");
    }

    function handleTap() {
        if (currentState && states[currentState].handleTap) {
            states[currentState].handleTap();
        }
    }

    // Public API
    return {
        start,
        transitionTo,
        destroy,
        handleTap,
    };
}
