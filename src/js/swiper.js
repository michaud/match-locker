/**
 * Creates a single, controllable swipe list instance.
 * This component does NOT handle pointer events directly. It is controlled
 * by an external controller via its public API.
 *
 * @param {object} options - The configuration for the swiper.
 * @param {string} options.listSelector - The CSS selector for the list element.
 * @param {'horizontal' | 'vertical'} options.direction - The swipe direction.
 * @param {string} [options.id] - An optional unique identifier for the swiper instance.
 * @param {number} [options.dragFactor=1] - Multiplier for drag distance to reduce sensitivity.
 * @returns {object} A public API to control the swiper instance.
 */
export function createSwiper(options) {

    let debug = false;

    const {
        listSelector,
        direction,
        slideWidth = null,
        slideHeight = null,
        throwMultiplier = 0.7,
        dragFactor = 1,
        viewportMatchesSlide = false,
        id = null, // Capture the ID
        cloneCount = 10,
        baseAnimationDuration = 0.3,
        maxAnimationDuration = 0.8,
        animationDistanceFactor = 4000,
    } = options;

    const listElement = document.querySelector(listSelector);
    // The filmstrip is the new container we will create to hold the lists.
    let filmstripElement = null;

    if (!listElement) {

        console.error('Swiper Error: list element not found.', { listSelector });

        return;
    }

    // --- Config & Constants ---
    const IS_HORIZONTAL = direction === 'horizontal';
    const THROW_MULTIPLIER = throwMultiplier;
    const CLONE_COUNT = cloneCount;
    const BASE_ANIMATION_DURATION = baseAnimationDuration;
    const MAX_ANIMATION_DURATION = maxAnimationDuration;
    const ANIMATION_DISTANCE_FACTOR = animationDistanceFactor;

    // --- State Variables ---
    let itemSize = 0;
    let startPos = 0;
    let startTranslate = 0;
    let currentTranslate = 0;
    let lastMoveTime = 0;
    let lastMovePos = 0;
    let velocity = 0;
    let sourceItemCount = 0; // The real number of unique items from the source
    let centerOffset = 0; // Offset to center the snapped slide
    let slideIdMap = [];
    const listeners = new Map(); // For event emitter pattern

    // --- Private Methods ---

    const emit = (eventName, payload) => {

        if (listeners.has(eventName)) {

            listeners.get(eventName).forEach(callback => {

                try {

                    callback(payload);

                } catch (e) {

                    console.error(`Error in swiper event listener for '${eventName}':`, e);
                }
            });
        }
    };

    const animateListTo = (targetTranslate, onComplete = null, isWrapCorrection = false) => {

        const distance = Math.abs(targetTranslate - currentTranslate);
        const duration = Math.min(BASE_ANIMATION_DURATION + distance / ANIMATION_DISTANCE_FACTOR, MAX_ANIMATION_DURATION);

        filmstripElement.style.transition = `transform ${duration}s cubic-bezier(0.2, 0.8, 0.2, 1)`;
        filmstripElement.style.transform = IS_HORIZONTAL ? `translateX(${targetTranslate}px)` : `translateY(${targetTranslate}px)`;

        const handleTransitionEnd = () => {

            // Set the final translate value before calling any callbacks.
            currentTranslate = targetTranslate;

            if (onComplete) onComplete();

            checkWrapAround(); // Ensure currentTranslate is normalized after animation.
        }

        filmstripElement.addEventListener('transitionend', handleTransitionEnd, { once: true });
    };

    const checkWrapAround = () => {
        // This function ensures the swiper's position is always within a predictable range
        // to create the infinite loop effect.
        const filmstripBlockLength = itemSize * sourceItemCount;
        const logicalStartPosition = -(filmstripBlockLength * CLONE_COUNT) + centerOffset;
    
        // If the current position has drifted too far from the central "original" block,
        // silently jump it back to the equivalent position within that block.
        if (Math.abs(currentTranslate - logicalStartPosition) > filmstripBlockLength) {
            filmstripElement.style.transition = 'none';
            currentTranslate = logicalStartPosition + ((currentTranslate - logicalStartPosition) % filmstripBlockLength);
            filmstripElement.style.transform = IS_HORIZONTAL ? `translateX(${currentTranslate}px)` : `translateY(${currentTranslate}px)`;
        }
    };

    const setupInfiniteList = () => {

        const initialItems = Array.from(listElement.children);
        sourceItemCount = initialItems.length;

        if (sourceItemCount === 0) return;

        slideIdMap = initialItems.map(item => item.dataset.slideId);

        // The list's parent is now the `.swiper` container, which acts as our viewport.
        const viewportElement = listElement.parentElement;

        // Create a new filmstrip container and insert it between the viewport and the list.
        filmstripElement = document.createElement('div');
        filmstripElement.classList.add('swiper-filmstrip');
        viewportElement.insertBefore(filmstripElement, listElement);

        viewportElement.style.overflow = 'hidden';
        filmstripElement.appendChild(listElement);

        // Create CLONE_COUNT clones before and after the original list.
        // The flexbox layout on the filmstrip will handle their arrangement.
        const clonesToPrepend = Array.from({ length: CLONE_COUNT }, () => listElement.cloneNode(true));
        const clonesToAppend = Array.from({ length: CLONE_COUNT }, () => listElement.cloneNode(true));

        clonesToPrepend.reverse().forEach(clone => filmstripElement.insertBefore(clone, filmstripElement.firstChild));
        clonesToAppend.forEach(clone => filmstripElement.appendChild(clone));
    };

    // --- Public API ---

    const API = {
        /**
         * The unique identifier for this swiper instance.
         */
        swiperId: id,

        /**
         * Initializes the drag sequence.
         * @param {number} position - The starting clientX or clientY.
         */
        startDrag(position) {

            filmstripElement.style.transition = 'none';

            const style = window.getComputedStyle(filmstripElement);
            const matrix = new DOMMatrix(style.transform);
            currentTranslate = IS_HORIZONTAL ? matrix.m41 : matrix.m42;

            startPos = position;
            startTranslate = currentTranslate;

            lastMoveTime = performance.now();
            lastMovePos = startPos;
            velocity = 0;
        },

        /**
         * Updates the list position during a drag.
         * @param {number} position - The current clientX or clientY.
         */
        drag(position) {

            const delta = position - startPos;
            const now = performance.now();
            const elapsed = now - lastMoveTime;

            if (elapsed > 0) {

                velocity = (position - lastMovePos) / elapsed;
            }

            lastMoveTime = now;
            lastMovePos = position;

            currentTranslate = startTranslate + (delta * dragFactor);
            const transform = IS_HORIZONTAL ? `translateX(${currentTranslate}px)` : `translateY(${currentTranslate}px)`;
            filmstripElement.style.transform = transform;

            emit('drag', {
                currentTranslate: currentTranslate,
                visualIndex: API.getVisualIndex()
            });
        },

        /**
         * Ends the drag and initiates the snap animation.
         * @param {function} [onComplete=null] - A callback to execute when the snap animation finishes.
         */
        endDrag(onComplete = null) {
            // If there are listeners for 'endDrag', it means an external controller (like the state machine)
            // is managing the animation. In that case, just emit the event with the destination.
            if (listeners.has('endDrag') && listeners.get('endDrag').length > 0) {
                const projected = currentTranslate + velocity * itemSize * THROW_MULTIPLIER;
                const targetTranslate = Math.round((projected - centerOffset) / itemSize) * itemSize + centerOffset;
                const finalIndex = API.getCurrentIndex(targetTranslate);
                emit('endDrag', {
                    swiper: API,
                    finalIndex: finalIndex
                });
            } else {
                // If there are no listeners, this is a standalone swiper (like the menu).
                // It should handle its own animation.
                const projected = currentTranslate + velocity * itemSize * THROW_MULTIPLIER;
                const targetTranslate = Math.round((projected - centerOffset) / itemSize) * itemSize + centerOffset;
                animateListTo(targetTranslate, onComplete);
            }
        },
        
        /**
         * Snaps the list to a specific item index.
         * @param {number} index - The zero-based index of the target item.

        /**
         * Snaps the list to a specific item index.
         * @param {number} index - The zero-based index of the target item.
        /**
         * Snaps the list to a specific item index.
         * @param {number} index - The zero-based index of the target item.
         * @param {boolean} [immediate=false] - If true, jump without animation.
         * @param {object} [options={}] - Additional options.
         * @param {function} [options.onComplete=null] - A callback to execute when the snap animation finishes.
         * @param {boolean} [options.useFling=false] - If true, calculate target based on current velocity.
         */
        snapTo(index, immediate = false, options = {}) {
            const filmstripBlockLength = itemSize * sourceItemCount;
            if (sourceItemCount === 0 || itemSize === 0) {
                // If the swiper is not properly initialized, we can't snap.
                if (options.onComplete) options.onComplete();
                emit('snapComplete', {
                    index: 0,
                    swiperId: API.swiperId,
                    actualSlideId: undefined,
                    source: 'snap-fail'
                });
                return;
            }

            // Calculate the canonical position of the target slide within the central "original" block.
            const basePosition = -(filmstripBlockLength * CLONE_COUNT);
            const targetTranslate = basePosition - (index * itemSize) + centerOffset;

            if (immediate) {
                // For an immediate snap, kill any ongoing animation, jump directly,
                // and then ensure the wrap-around state is clean for the next interaction.
                filmstripElement.style.transition = 'none';
                filmstripElement.style.transform = IS_HORIZONTAL ? `translateX(${targetTranslate}px)` : `translateY(${targetTranslate}px)`;
                currentTranslate = targetTranslate;

                if (options.onComplete) {

                    options.onComplete(); // Call local onComplete first
                }
                // Then emit the global event
                const finalIndex = API.getCurrentIndex(targetTranslate);
                emit('snapComplete', {
                    index: finalIndex,
                    swiperId: API.swiperId,
                    actualSlideId: slideIdMap[finalIndex],
                    source: 'immediate-snap'
                });

                // After emitting, ensure the swiper is not in a position that will break the next wrap check.
                checkWrapAround();

            } else {
                // Define the completion handler here so it's in scope for both fling and regular snaps.
                const animationCompletionHandler = () => {

                    debug && console.log(`%c[DEBUG] SWIPER (${API.swiperId}): animationCompletionHandler called.`, 'color: #87CEFA;');

                    if (options.onComplete) {

                        debug && console.log(`%c[DEBUG] SWIPER (${API.swiperId}): Executing options.onComplete callback.`, 'color: #87CEFA;');
                        options.onComplete();
                    }

                    // Use the now-normalized `currentTranslate` to get the definitive final index.
                    const finalIndex = API.getCurrentIndex(currentTranslate);
                    emit('snapComplete', {
                        index: finalIndex,
                        swiperId: API.swiperId,
                        actualSlideId: slideIdMap[finalIndex],
                        source: 'animated-snap'
                    });
                };

                // If useFling is true, we calculate the target based on the last known velocity.
                // This restores the "fling" effect for drags.
                if (options.useFling) {
                    const projected = currentTranslate + velocity * itemSize * THROW_MULTIPLIER;
                    const flingTarget = Math.round((projected - centerOffset) / itemSize) * itemSize + centerOffset;
                    animateListTo(flingTarget, animationCompletionHandler);
                    return; // Exit here to avoid the "closest target" logic below.
                }
                // For an animated snap, find the closest visual representation of the target slide
                // (including clones) to ensure the shortest possible animation path.
                const potentialTargets = [
                    targetTranslate - filmstripBlockLength,
                    targetTranslate,
                    targetTranslate + filmstripBlockLength,
                ];

                // Find the target that is closest to the current position.
                const closestTarget = potentialTargets.reduce((prev, curr) => {
                    return (Math.abs(curr - currentTranslate) < Math.abs(prev - currentTranslate) ? curr : prev);
                });

                animateListTo(
                    closestTarget,
                    animationCompletionHandler
                );
            }
        },

        /**
         * Navigates to the next slide.
         */
        next() {

            const currentIndex = API.getCurrentIndex(currentTranslate);
            const nextIndex = (currentIndex + 1) % sourceItemCount;
            API.snapTo(nextIndex, false, { source: 'navigation' });
        },

        /**
         * Navigates to the previous slide.
         */
        prev() {

            const currentIndex = API.getCurrentIndex(currentTranslate);
            const prevIndex = (currentIndex - 1 + sourceItemCount) % sourceItemCount;
            API.snapTo(prevIndex, false, { source: 'navigation' });
        },

        /**
         * Initializes the component state and DOM.
         */
        init() {

            itemSize = IS_HORIZONTAL
                ? slideWidth || (listElement.firstElementChild ? listElement.firstElementChild.offsetWidth : 0)
                : slideHeight || (listElement.firstElementChild ? listElement.firstElementChild.offsetHeight : 0);

            if (itemSize === 0) {

                console.error(
                    'Swiper Error: item size could not be determined. Please provide slideWidth/slideHeight options or ensure the list has children when initializing.', { listSelector }
                );
                // Prevent further execution if size is invalid
                return false; // Indicate failure
            }

            // Create the filmstrip first.
            setupInfiniteList();

            // Calculate the offset needed to center the active slide.
            const viewportElement = filmstripElement.parentElement;
            let containerSize;

            if (viewportMatchesSlide) {
                // If the viewport is the same size as the slide, use itemSize directly.
                containerSize = itemSize;
            } else {
                // Otherwise, measure the viewport element from the DOM.
                containerSize = IS_HORIZONTAL ? viewportElement.offsetWidth : viewportElement.offsetHeight;
            }
            centerOffset = (containerSize / 2) - (itemSize / 2);

            // Authoritative Initial Position Calculation:
            // Position the filmstrip so the start of the "Original" block is at the beginning of the viewport,
            // then add the offset to center the first slide.
            const filmstripBlockLength = itemSize * sourceItemCount;
            currentTranslate = -(filmstripBlockLength * CLONE_COUNT) + centerOffset;

            filmstripElement.style.transform = IS_HORIZONTAL ? `translateX(${currentTranslate}px)` : `translateY(${currentTranslate}px)`;
            return true; // Indicate success
        },

        /**
         * Gets the initial translate value set during initialization.
         * @returns {number} The initial translate value.
         */
        getInitialTranslate() {
            return -(itemSize * sourceItemCount * CLONE_COUNT) + centerOffset;
        },

        /**
         * Gets the current "real" index of the active slide.
         * @returns {number} The zero-based index of the current slide.
         */
        getCurrentIndex(translate) {
            if (itemSize === 0) return 0;
            // Calculate index relative to the start of the list, accounting for the center offset.
            const rawIndex = Math.round((-translate + centerOffset) / itemSize);
            // Wrap this index within the bounds of the original source items
            return (rawIndex % sourceItemCount + sourceItemCount) % sourceItemCount; // True modulo
        },

        /**
         * Gets the visual index based on the current transform, even during animation.
         * @returns {number} The zero-based index of the visually current slide.
         */
        getVisualIndex() {
            const style = window.getComputedStyle(filmstripElement);
            const matrix = new DOMMatrix(style.transform);
            const liveTranslate = IS_HORIZONTAL ? matrix.m41 : matrix.m42;
            return API.getCurrentIndex(liveTranslate);
        },

        /**
         * Gets the unique ID of the current "real" slide.
         * @returns {string | undefined} The slide ID.
         */
        getCurrentSlideId() {

            const realIndex = API.getCurrentIndex(currentTranslate);

            return slideIdMap[realIndex];
        },

        /**
         * Gets the unique ID of the visually current slide, even during animation.
         * @returns {string | undefined} The slide ID.
         */
        getVisualSlideId() {

            const visualIndex = API.getVisualIndex();

            return slideIdMap[visualIndex];
        },

        /**
         * Gets the original index for a given slide ID.
         * @param {string} slideId The ID of the slide to find.
         * @returns {number} The index, or -1 if not found.
         */
        getIndexForSlideId(slideId) {

            return slideIdMap.indexOf(slideId);
        },

        /**
         * Gets the direction of the swiper.
         */
        getDirection() {

            return direction;
        },

        /**
         * Returns the underlying DOM element for this swiper instance.
         */
        getElement() {

            return filmstripElement.parentElement; // Return the main .swiper container
        },

        /**
         * Registers a listener for a swiper event.
         * @param {'snapComplete' | 'drag' | 'dragEnd'} eventName - The name of the event to listen for.
         * @param {function} callback - The function to call when the event is emitted.
         */
        on(eventName, callback) {

            if (!listeners.has(eventName)) {

                listeners.set(eventName, []);
            }

            listeners.get(eventName).push(callback);
        },

        /**
         * Unregisters a listener for a swiper event.
         * @param {'snapComplete' | 'drag' | 'dragEnd'} eventName - The name of the event.
         * @param {function} callback - The specific callback function to remove.
         */
        off(eventName, callback) {

            if (listeners.has(eventName)) {

                const eventListeners = listeners.get(eventName);
                const index = eventListeners.indexOf(callback);

                if (index > -1) {

                    eventListeners.splice(index, 1);
                }
            }
        },
    };

    if (API.init() === false) { // init returns false on failure
        return null; // Indicate failure to create swiper
    }
    return API; // Return API on success
}
