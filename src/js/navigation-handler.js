/**
 * Encapsulates all player navigation logic via UI buttons.
 */
export function createNavigationHandler(callbacks) {

    const { domElements } = callbacks;
    const listeners = new Map();

    const emit = (eventName, payload) => {
        if (listeners.has(eventName)) {
            listeners.get(eventName).forEach(callback => callback(payload));
        }
    };

    const navigate = (navKey) => {
        // Simply emit an event that a navigation action was requested.
        // The state machine will be responsible for handling it.
        emit('navigate', { direction: navKey });
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

    const on = (eventName, callback) => {
        if (!listeners.has(eventName)) {
            listeners.set(eventName, []);
        }
        listeners.get(eventName).push(callback);
    };

    const off = (eventName, callback) => {
        if (listeners.has(eventName)) {
            const eventListeners = listeners.get(eventName);
            const index = eventListeners.indexOf(callback);
            if (index > -1) {
                eventListeners.splice(index, 1);
            }
        }
    };

    return {
        attach,
        detach,
        on,
        off,
    };
}
