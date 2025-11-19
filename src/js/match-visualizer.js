/**
 * Manages the visual representation of slide matches.
 * This module centralizes all logic for how matches are displayed,
 * both at rest and during user interactions like dragging.
 */
export function createMatchVisualizer(callbacks) {

    const { getGame, getActivePuzzle } = callbacks;

    let currentStrategy = 'fade-on-drag'; // Default strategy

    const colorPalette = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#A133FF', '#33FFA1'];

    // State for managing visuals during a drag operation.
    let draggedMatchState = {
        draggedSlideId: null,
        staticSlideId: null,
    };

    const setStrategy = (strategyName) => {
        currentStrategy = strategyName;
        // When strategy changes, immediately update visuals.
        synchronizeVisuals();
    };

    const onDragStart = (dragSwiper, otherSwiper) => {

        if (currentStrategy === 'fade-on-drag') {
            // Reset the temporary state at the start of any drag.
            draggedMatchState = { draggedSlideId: null, staticSlideId: null };

            const game = getGame();
            const activePuzzle = getActivePuzzle();

            if (!activePuzzle || !otherSwiper) return;

            const puzzleMatches = game.gameState.playerMatchesByPuzzle.get(activePuzzle.id);

            if (!puzzleMatches) return;

            const draggedSlideId = dragSwiper.getVisualSlideId();
            const staticSlideId = otherSwiper.getCurrentSlideId();

            // Check if the two slides currently in the puzzle slot form a match.
            if (puzzleMatches.get(draggedSlideId) === staticSlideId || puzzleMatches.get(staticSlideId) === draggedSlideId) {
                // We are dragging one half of a matched pair. Store the state.
                draggedMatchState = { draggedSlideId, staticSlideId };

                // 1. Immediately hide the match on the static (non-dragged) swiper.
                const staticSlideElement = otherSwiper.getElement().querySelector(`[data-slide-id="${staticSlideId}"].is-matched`);

                if (staticSlideElement) {

                    staticSlideElement.classList.remove('is-matched');
                }

                // 2. Add a class to the dragged slide to trigger a fade-out animation via CSS.
                const draggedSlideElement = dragSwiper.getElement().querySelector(`[data-slide-id="${draggedSlideId}"].is-matched`);

                if (draggedSlideElement) {

                    draggedSlideElement.classList.add('is-fading-match');
                }
            }
        }
        // The 'colored-outlines' strategy does nothing during drag.
    };

    const onDragEnd = () => {
        if (currentStrategy === 'fade-on-drag') {
            // Cleanup any fading classes from the drag.
            const fadingElement = document.querySelector('.is-fading-match');

            if (fadingElement) {

                fadingElement.classList.remove('is-fading-match');
            }
            // Reset the temporary drag state for the next interaction.
            draggedMatchState = { draggedSlideId: null, staticSlideId: null };
        }
        // The 'colored-outlines' strategy does nothing during drag.
    };

    const synchronizeFadeOnDrag = (game) => {

        document.querySelectorAll('.is-matched').forEach(el => el.classList.remove('is-matched'));
        const activePuzzle = getActivePuzzle(game);

        if (!activePuzzle) return;

        const currentKey = `${game.playerState.currentSliderId}-${game.playerState.currentIndex}`;
        const currentNode = game.worldMap.get(currentKey);

        if (!currentNode || !currentNode.guest) return;

        const hostSwiper = game.swiperInstances.get(game.playerState.currentSliderId);
        const guestSwiper = game.swiperInstances.get(currentNode.guest.sliderId);
        const puzzleMatches = game.gameState.playerMatchesByPuzzle.get(activePuzzle.id);

        if (!puzzleMatches || !hostSwiper || !guestSwiper) return;

        const currentHostSlideId = hostSwiper.getCurrentSlideId();
        const currentGuestSlideId = guestSwiper.getCurrentSlideId();

        if (puzzleMatches.get(currentHostSlideId) === currentGuestSlideId || puzzleMatches.get(currentGuestSlideId) === currentHostSlideId) {

            document.querySelectorAll(`[data-slide-id="${currentHostSlideId}"], [data-slide-id="${currentGuestSlideId}"]`).forEach(el => el.classList.add('is-matched'));
        }
    };

    const synchronizeColoredOutlines = (game) => {
        // Clear all previous match visualization classes
        document.querySelectorAll('.is-matched, .is-matched-colored').forEach(el => {

            el.classList.remove('is-matched', 'is-matched-colored');
            el.style.setProperty('--match-color', null);
        });

        const activePuzzle = getActivePuzzle(game);

        if (!activePuzzle) return;

        const puzzleMatches = game.gameState.playerMatchesByPuzzle.get(activePuzzle.id);

        if (!puzzleMatches || puzzleMatches.size === 0) return;

        let colorIndex = 0;

        puzzleMatches.forEach((guestId, hostId) => {

            const color = colorPalette[colorIndex % colorPalette.length];
            const hostSwiper = Array.from(game.swiperInstances.values()).find(s => s.getIndexForSlideId(hostId) > -1);
            const guestSwiper = Array.from(game.swiperInstances.values()).find(s => s.getIndexForSlideId(guestId) > -1);

            if (hostSwiper) {

                document.querySelectorAll(`[data-slide-id="${hostId}"]`).forEach(el => {

                    el.classList.add('is-matched-colored');
                    el.style.setProperty('--match-color', color);
                });
            }

            if (guestSwiper) {

                document.querySelectorAll(`[data-slide-id="${guestId}"]`).forEach(el => {

                    el.classList.add('is-matched-colored');
                    el.style.setProperty('--match-color', color);
                });
            }

            colorIndex++;
        });
    };

    const synchronizeVisuals = () => {

        const game = getGame();

        if (currentStrategy === 'fade-on-drag') {

            synchronizeFadeOnDrag(game);

        } else if (currentStrategy === 'colored-outlines') {

            synchronizeColoredOutlines(game);
        }
    };

    return {
        setStrategy,
        onDragStart,
        onDragEnd,
        synchronizeVisuals,
    };
}
