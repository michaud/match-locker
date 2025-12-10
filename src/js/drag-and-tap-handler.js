import { createDragHandler } from './drag.js';

/**
 * Encapsulates player drag-to-swipe and tap-to-match logic.
 */
export function createDragAndTapHandler(callbacks) {

    const {
        getGame,
        matchVisualizer,
        domElements
    } = callbacks;

    let dragHandler = null;

    const attach = () => {

        const getSwipersForDragHandler = () => {

            const game = getGame();

            if (!game.playerState) return { hostSwiper: null, guestSwiper: null };

            const currentKey = `${game.playerState.currentSwiperId}-${game.playerState.currentIndex}`;
            const currentNode = game.worldMap.get(currentKey);
            const hostSwiper = game.swiperInstances.get(game.playerState.currentSwiperId);
            const guestSwiper = currentNode?.guest ? game.swiperInstances.get(currentNode.guest.swiperId) : null;

            return { hostSwiper, guestSwiper };
        };

        const onDragStart = (dragSwiper, otherSwiper) => {
            // Delegate all "during drag" visualization logic to the new module.
            matchVisualizer.onDragStart(dragSwiper, otherSwiper);
        };

        if (!dragHandler) {
            // The tap callback now delegates to the state machine.
            // The state machine will decide what to do based on the current state.
            // The state machine will now listen for the 'endDrag' event from the swiper directly.
            dragHandler = createDragHandler(domElements.gameScreen, getSwipersForDragHandler, callbacks.onTap, onDragStart);
        }
        dragHandler.attach();
    };

    const detach = () => {

        if (dragHandler) {

            dragHandler.detach(); // Don't nullify, just detach listeners
        }
    };

    return {
        attach,
        detach,
    };
}
