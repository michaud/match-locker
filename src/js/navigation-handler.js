/**
 * Encapsulates all player navigation logic via UI buttons.
 */
export function createNavigationHandler(callbacks) {

    const { getGame, onStateUpdate, domElements } = callbacks;

    const navigate = (navKey) => {

        const game = getGame();
        if (!game || !game.playerState || !game.playerState.currentSliderId) return;

        const currentKey = `${game.playerState.currentSliderId}-${game.playerState.currentIndex}`;
        const currentNode = game.worldMap.get(currentKey);

        if (!currentNode) return;

        const destination = currentNode[navKey];

        if (!destination) return;

        // If the destination is on the same slider, we can use the swiper's internal navigation.
        // The swiper will animate and then emit a `snapComplete` event. The drag-and-tap handler
        // will eventually listen for this to update the state, but for now, this simplifies the nav logic.
        if (destination.sliderId === game.playerState.currentSliderId) {

            const swiper = game.swiperInstances.get(destination.sliderId);

            if (swiper) {

                if (navKey === 'left' || navKey === 'up') {

                    swiper.prev();

                } else {

                    swiper.next();
                }
            }

        } else {
            // If it's a jump to a different slider, we must update the application state directly.
            onStateUpdate({ currentSliderId: destination.sliderId, currentIndex: destination.index });
        }
    };

    const attach = () => {

        domElements.prevButton.addEventListener('click', () => navigate('left'));
        domElements.nextButton.addEventListener('click', () => navigate('right'));
        domElements.upButton.addEventListener('click', () => navigate('up'));
        domElements.downButton.addEventListener('click', () => navigate('down'));
    };

    const detach = () => {
        // In this design, listeners are attached once and live for the app's lifetime.
        // A detach function is included for completeness if needed later.
    };

    return { attach, detach };
}
