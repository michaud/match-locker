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
 * @param {function} callbacks.checkPuzzleSolved - Function to check if the current puzzle is solved.
 * @param {function} callbacks.checkGameWin - Function to check if the entire game is won.
 * @param {object} callbacks.domElements - A collection of frequently used DOM elements.
 * @param {object} callbacks.interactionHandlers - { gameDragAndTapHandler, navigationHandler }
 */
export function createGameStateMachine(callbacks) {

    let currentState = null;

    // Unpack callbacks for easier access
    const {
        getGame,
        updateSwiperVisibility,
        snapSwipersToState,
        updateNavigationControls,
        updatePuzzleStatusIndicator,
        matchVisualizer,
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
                console.log("GameStateMachine: Entering IDLE_ON_PATH");
                // Ensure all visuals and controls are correctly set for the current state.
                matchVisualizer.synchronizeVisuals();
                updateSwiperVisibility();
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
                console.log("GameStateMachine: Entering IDLE_AT_PUZZLE");
                // Ensure all visuals and controls are correctly set for the current state.
                matchVisualizer.synchronizeVisuals();
                updateSwiperVisibility();
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
         * The game is animating between states (e.g., after a drag or nav click).
         * - All user input (drag, tap, navigation) is disabled to prevent race conditions.
         * - This state is responsible for running the animation and transitioning
         *   to the correct new IDLE state upon completion.
         */
        TRANSITIONING: {
            onEnter(context) {
                console.log("GameStateMachine: Entering TRANSITIONING with context:", context);
                const game = getGame();
                const { destination } = context;

                matchVisualizer.onDragEnd(); // Clean up any drag-specific visuals.
                // CRITICAL: Lock all user input upon entering the transition.
                interactionHandlers.gameDragAndTapHandler.detach();
                interactionHandlers.navigationHandler.detach();

                if (!destination || !game.playerState) {
                    // If there's no destination, it might be a failed drag or other issue.
                    // Just go back to a stable state to be safe.
                    transitionTo('IDLE_ON_PATH');
                    return;
                }

                const oldPlayerState = { ...game.playerState };

                // A drag doesn't change the "active" swiper, only its index.
                // A navigation click can change both.
                if (destination.source !== 'drag') {
                    game.playerState.currentSwiperId = destination.swiperId;
                }
                game.playerState.currentIndex = destination.index; // Always update the index

                const handleSnapComplete = () => {
                    // The animation is done. Now, determine the new stable state.
                    const isAtPuzzle = !!game.layout.puzzle_slots.find(slot =>
                        slot.host_group_id === game.playerState.currentSwiperId &&
                        slot.at_index === game.playerState.currentIndex
                    );

                    // Clean up the listener from the swiper that just finished.
                    const swiper = game.swiperInstances.get(destination.swiperId);
                    if (swiper) {
                        swiper.off('snapComplete', handleSnapComplete);
                    }

                    transitionTo(isAtPuzzle ? 'IDLE_AT_PUZZLE' : 'IDLE_ON_PATH');
                };

                const targetSwiper = game.swiperInstances.get(destination.swiperId);
                if (targetSwiper) {
                    targetSwiper.on('snapComplete', handleSnapComplete);

                    // A drag has already moved the swiper visually, so we just need to snap it.
                    // A navigation click needs to snap all swipers from their previous state.
                    if (destination.source === 'drag') {
                        targetSwiper.snapTo(destination.index, false, { source: 'drag' });
                    } else {
                        snapSwipersToState(true, oldPlayerState); // Animate to the new state
                    }
                } else {
                    // If the target swiper doesn't exist, we can't animate.
                    // Immediately transition back to a safe state to avoid getting stuck.
                    transitionTo('IDLE_ON_PATH');
                }
            },
            onExit() { /* No action needed on exit */ }
        }
    };

    const handleMatchAttempt = () => {
        const game = getGame();
        const settings = getSettings();
        const activePuzzle = callbacks.getActivePuzzle(); // Use the direct callback

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

    const handleSwiperEndDrag = (swiper, finalIndex) => {
        const destination = {
            swiperId: swiper.swiperId,
            index: finalIndex,
            source: 'drag'
        };
        // A drag has ended, so we transition the game state.
        transitionTo('TRANSITIONING', { destination });
    };

    const handleNavigationRequest = ({ direction }) => {
        const game = getGame();

        if (!game || !game.playerState || !game.playerState.currentSwiperId) return;

        const currentKey = `${game.playerState.currentSwiperId}-${game.playerState.currentIndex}`;
        const currentNode = game.worldMap.get(currentKey);

        if (!currentNode) return;

        const destination = currentNode[direction];

        if (!destination) return;

        // A navigation request has been received, so we transition the game state.
        transitionTo('TRANSITIONING', { destination });
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

        const isAtPuzzle = !!game.layout.puzzle_slots.find(slot =>
            slot.host_group_id === game.playerState.currentSwiperId &&
            slot.at_index === game.playerState.currentIndex
        );

        snapSwipersToState(false); // Perform the initial, non-animated snap.
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
        console.log("GameStateMachine destroyed.");
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
