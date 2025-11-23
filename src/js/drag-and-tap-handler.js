import { createDragHandler } from './drag.js';

/**
 * Encapsulates player drag-to-swipe and tap-to-match logic.
 */
export function createDragAndTapHandler(callbacks) {

    const {
        getGame,
        getSettings,
        checkPuzzleSolved,
        checkGameWin,
        getActivePuzzle,
        matchVisualizer,
        domElements
    } = callbacks;

    let dragHandler = null;

    const handleMatchAttempt = () => {

        const game = getGame();
        const settings = getSettings();
        const activePuzzle = getActivePuzzle();

        if (!activePuzzle) return; // Can't make a match if not on a puzzle slot.

        const currentKey = `${game.playerState.currentSliderId}-${game.playerState.currentIndex}`;
        const currentNode = game.worldMap.get(currentKey);

        if (!currentNode) return;

        const hostSwiper = game.swiperInstances.get(game.playerState.currentSliderId);
        const guestSwiper = currentNode.guest ? game.swiperInstances.get(currentNode.guest.sliderId) : null;

        if (!hostSwiper || !guestSwiper) return;

        const hId = hostSwiper.getCurrentSlideId();
        const vId = guestSwiper.getCurrentSlideId(); // prettier-ignore

        if (!game.gameState.playerMatchesByPuzzle.has(activePuzzle.id)) {

            game.gameState.playerMatchesByPuzzle.set(activePuzzle.id, new Map());
        }

        const puzzleMatches = game.gameState.playerMatchesByPuzzle.get(activePuzzle.id);
        const existingMatch = puzzleMatches.get(hId);

        let isNowMatched;

        if (existingMatch === vId) {

            puzzleMatches.delete(hId);
            isNowMatched = false;

        } else {

            puzzleMatches.set(hId, vId);
            isNowMatched = true;
        }

        if (settings.puzzleCompletion === 'game-finishes') {

            matchVisualizer.synchronizeVisuals(); // Update visuals before checking for solved status
            checkPuzzleSolved();
            checkGameWin();
        }
    };

    const attach = () => {

        const getSwipersForDragHandler = () => {

            const game = getGame();

            if (!game.playerState) return { hostSwiper: null, guestSwiper: null };

            const currentKey = `${game.playerState.currentSliderId}-${game.playerState.currentIndex}`;
            const currentNode = game.worldMap.get(currentKey);
            const hostSwiper = game.swiperInstances.get(game.playerState.currentSliderId);
            const guestSwiper = currentNode?.guest ? game.swiperInstances.get(currentNode.guest.sliderId) : null;

            return { hostSwiper, guestSwiper };
        };

        const onDragStart = (dragSwiper, otherSwiper) => {
            // Delegate all "during drag" visualization logic to the new module.
            matchVisualizer.onDragStart(dragSwiper, otherSwiper);

            // This function is called by drag.js when a drag gesture is confirmed.
            // We use it to set up a one-time listener for when the eventual snap completes.
            const handleSnap = (event) => {

                domElements.gameScreen.style.cursor = 'grab';
                domElements.gameScreen.classList.remove('is-dragging');

                // Delegate all "drag end" cleanup to the new module.
                matchVisualizer.onDragEnd();

                // A drag/swipe is a purely visual action and does not update the application state.
                // The 'navigation' source is now handled directly in app.js.
                // Clean up the listener to prevent it from firing again.
                dragSwiper.off('snapComplete', handleSnap);
            };

            dragSwiper.on('snapComplete', handleSnap);
        };

        dragHandler = createDragHandler(domElements.gameScreen, getSwipersForDragHandler, handleMatchAttempt, onDragStart);
        dragHandler.attach();
    };

    const detach = () => {

        if (dragHandler) {

            dragHandler.detach();
            dragHandler = null;
        }
    };

    return { attach, detach };
}
