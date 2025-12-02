/**
 * Creates a single, controllable swipe list instance.
 * This component does NOT handle pointer events directly. It is controlled
 * by an external controller via its public API.
 *
 * @param {object} options - The configuration for the swiper.
 * @param {string} options.listSelector - The CSS selector for the list element.
 * @param {'horizontal' | 'vertical'} options.direction - The swipe direction.
 * @param {string} [options.id] - An optional unique identifier for the swiper instance.
 * @returns {object} A public API to control the swiper instance.
 */
export function createSwiper(options) {

    const {
        listSelector,
        direction,
        slideWidth = null,
        slideHeight = null,
        throwMultiplier = 0.7,
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

            currentTranslate = targetTranslate;
            // Call the completion handler first, so any listeners (like state updates)
            // fire based on the visually correct final position.
            if (onComplete) {

                onComplete();
            }
            // Only perform the wrap check if this animation wasn't already a wrap correction.
            if (!isWrapCorrection) {
                checkWrapAround();
            }
        }

        filmstripElement.addEventListener('transitionend', handleTransitionEnd, { once: true });
    };

    const checkWrapAround = () => {
        const filmstripLength = itemSize * sourceItemCount;
        // The `currentTranslate` includes `centerOffset`. For wrap logic, we must work with the logical position.
        const logicalTranslate = currentTranslate - centerOffset;

        // Define a safe zone around the original block. We check if the viewport has moved
        // beyond one full block length away from the original block's boundaries.
        const rightBoundary = -(CLONE_COUNT - 1) * filmstripLength;
        const leftBoundary = -(CLONE_COUNT + 1) * filmstripLength;

        if (logicalTranslate > rightBoundary) {
            filmstripElement.style.transition = 'none';
            currentTranslate -= filmstripLength; // Silently shift left by one block length
            filmstripElement.style.transform = IS_HORIZONTAL ? `translateX(${currentTranslate}px)` : `translateY(${currentTranslate}px)`;
        } else if (logicalTranslate < leftBoundary) {
            filmstripElement.style.transition = 'none';
            currentTranslate += filmstripLength; // Silently shift right by one block length
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
        viewportElement.style.position = 'relative';
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
        id: id,

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

            currentTranslate = startTranslate + delta;
            const transform = IS_HORIZONTAL ? `translateX(${currentTranslate}px)` : `translateY(${currentTranslate}px)`;
            filmstripElement.style.transform = transform;

            emit('drag');
        },

        /**
         * Ends the drag and initiates the snap animation.
         * @param {function} [onComplete=null] - A callback to execute when the snap animation finishes.
         */
        endDrag(onComplete = null) {

            emit('dragEnd', {
                velocity: velocity,
                currentTranslate: currentTranslate
            });

            const projected = currentTranslate + velocity * itemSize * THROW_MULTIPLIER; // prettier-ignore
            const targetTranslate = Math.round((projected - centerOffset) / itemSize) * itemSize + centerOffset;
            const finalIndex = API.getCurrentIndex(targetTranslate);

            const animationCompletionHandler = () => {

                const finalSlideId = slideIdMap[finalIndex];

                emit('snapComplete', {
                    index: finalIndex,
                    slideId: finalSlideId,
                    source: 'drag'
                });

                if (onComplete) onComplete();
            };

            animateListTo(targetTranslate, animationCompletionHandler);
        },

        /**
         * Snaps the list to a specific item index.
         * @param {number} index - The zero-based index of the target item.
         * @param {boolean} [immediate=false] - If true, jump without animation.
         * @param {object} [options={}] - Additional options.
         * @param {function} [options.onComplete=null] - A callback to execute when the snap animation finishes.
         * @param {string} [options.source='programmatic'] - The source of the snap action.
         */
        snapTo(index, immediate = false, options = {}) {
            // This is the authoritative function to move the slider.
            const targetTranslate = -(index * itemSize) + centerOffset;
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
                const finalSlideId = slideIdMap[finalIndex];
                emit('snapComplete', { index: finalIndex, slideId: finalSlideId, source: options.source || 'programmatic' });

            } else {
                // For an animated snap, we use the standard animation function.
                // The 'transitionend' handler in animateListTo will handle the wrap-around check.
                const animationCompletionHandler = () => {

                    if (options.onComplete) options.onComplete();

                    const finalIndex = API.getCurrentIndex(targetTranslate);
                    const finalSlideId = slideIdMap[finalIndex];

                    emit('snapComplete', { index: finalIndex, slideId: finalSlideId, source: options.source || 'programmatic' });
                };

                animateListTo(
                    targetTranslate,
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

            // Apply the explicit size to all slide elements (li).
            // This ensures the visual size matches the calculated itemSize.
            const slideElements = listElement.querySelectorAll('li');
            slideElements.forEach(li => {
                // Apply both width and height if they are provided.
                if (slideWidth) {
                    li.style.width = `${slideWidth}px`;
                }
                if (slideHeight) {
                    li.style.height = `${slideHeight}px`;
                }
            });

            // Create the filmstrip first.
            setupInfiniteList();

            // Calculate the offset needed to center the active slide.
            const viewportElement = filmstripElement.parentElement;
            const containerSize = IS_HORIZONTAL ? viewportElement.offsetWidth : viewportElement.offsetHeight;
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
