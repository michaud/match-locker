/**
 * Encapsulates all player navigation logic via UI buttons.
 */
export function createNavigationHandler(callbacks) {

    const { getGame, onStateUpdate, domElements } = callbacks;

    const navigate = (navKey) => {

        const game = getGame();

        if (!game || !game.playerState || !game.playerState.currentSwiperId) return;

        const currentKey = `${game.playerState.currentSwiperId}-${game.playerState.currentIndex}`;
        const currentNode = game.worldMap.get(currentKey);

        if (!currentNode) return;

        const destination = currentNode[navKey];

        if (!destination) return;

        // If the destination is on the same slider, we can use the swiper's internal navigation.
        // The swiper will animate and then emit a `snapComplete` event, which is handled in app.js.
        if (destination.swiperId === game.playerState.currentSwiperId) {

            const swiper = game.swiperInstances.get(destination.swiperId);

            if (swiper) {
                // The worldMap has already calculated the correct destination index, including wraparound.
                // We can just tell the swiper to go there directly.
                swiper.snapTo(destination.index, false, { source: 'navigation' });
            }

        } else {
            // If it's a jump to a different slider, we must update the application state directly.
            onStateUpdate({ currentSwiperId: destination.swiperId, currentIndex: destination.index });
        }
    };

    // Define the listener functions once to ensure they can be removed correctly.
    const onPrevClick = () => navigate('left');
    const onNextClick = () => navigate('right');
    const onUpClick = () => navigate('up');
    const onDownClick = () => navigate('down');

    const attach = () => {

        domElements.prevButton.addEventListener('click', onPrevClick);
        domElements.nextButton.addEventListener('click', onNextClick);
        domElements.upButton.addEventListener('click', onUpClick);
        domElements.downButton.addEventListener('click', onDownClick);
    };

    const detach = () => {
        domElements.prevButton.removeEventListener('click', onPrevClick);
        domElements.nextButton.removeEventListener('click', onNextClick);
        domElements.upButton.removeEventListener('click', onUpClick);
        domElements.downButton.removeEventListener('click', onDownClick);
    };

    return { attach, detach };
}
