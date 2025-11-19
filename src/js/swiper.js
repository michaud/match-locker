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
    let workingItemCount = 0; // The count after initial cloning to ensure the list is long enough
    let sourceItemCount = 0; // The real number of unique items from the source
    let instanceCloneCount = 0;
    let slideIdMap = []; // Maps original index to slide ID
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

    const animateListTo = (targetTranslate, onComplete = null) => {

        const distance = Math.abs(targetTranslate - currentTranslate);
        const duration = Math.min(BASE_ANIMATION_DURATION + distance / ANIMATION_DISTANCE_FACTOR, MAX_ANIMATION_DURATION);

        listElement.style.transition = `transform ${duration}s cubic-bezier(0.2, 0.8, 0.2, 1)`;
        listElement.style.transform = IS_HORIZONTAL ? `translateX(${targetTranslate}px)` : `translateY(${targetTranslate}px)`;

        const handleTransitionEnd = () => {

            currentTranslate = targetTranslate;
            // Call the completion handler first, so any listeners (like state updates)
            // fire based on the visually correct final position.
            if (onComplete) {

                onComplete();
            }
            // THEN, perform the silent wrap-around check to prepare for the next interaction.
            checkWrapAround();
        }

        listElement.addEventListener('transitionend', handleTransitionEnd, { once: true });
    };

    const checkWrapAround = () => {

        const currentIndex = Math.round(-currentTranslate / itemSize);
        const wrappedIndex = (currentIndex - instanceCloneCount) % sourceItemCount;
        const targetIndex = (wrappedIndex < 0) ? wrappedIndex + sourceItemCount : wrappedIndex;
        const safeIndex = targetIndex + instanceCloneCount;

        if (currentIndex !== safeIndex) {

            listElement.style.transition = 'none';
            currentTranslate = -safeIndex * itemSize;
            listElement.style.transform = IS_HORIZONTAL ? `translateX(${currentTranslate}px)` : `translateY(${currentTranslate}px)`;
        }
    };

    const setupInfiniteList = () => {

        let items = Array.from(listElement.children);
        sourceItemCount = items.length;

        if (sourceItemCount === 0) return;

        // Build the map from original index to slide ID
        slideIdMap = items.map(item => item.dataset.slideId);

        // Determine the number of clones needed for a seamless experience.
        // If the source list is very short, we need to duplicate it to create a large enough buffer.
        const duplicationFactor = Math.ceil(CLONE_COUNT / sourceItemCount);

        if (duplicationFactor > 1) {

            const originalItems = [...items];

            for (let i = 1; i < duplicationFactor; i++) {

                originalItems.forEach(item => listElement.appendChild(item.cloneNode(true)));
            }

            items = Array.from(listElement.children);
        }
        workingItemCount = items.length; // This is now the "working set" of items.
        instanceCloneCount = CLONE_COUNT; // We always use the configured clone count.

        // Prepend clones from the end of the list
        for (let i = 0; i < instanceCloneCount; i++) {

            const itemIndex = (workingItemCount - instanceCloneCount + i) % workingItemCount;
            listElement.insertBefore(items[itemIndex].cloneNode(true), listElement.firstChild);
        }
        // Append clones from the start of the list
        for (let i = 0; i < instanceCloneCount; i++) {

            listElement.appendChild(items[i % workingItemCount].cloneNode(true));
        }

        currentTranslate = -itemSize * instanceCloneCount;
        listElement.style.transform = IS_HORIZONTAL ? `translateX(${currentTranslate}px)` : `translateY(${currentTranslate}px)`;
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

            listElement.style.transition = 'none';

            const style = window.getComputedStyle(listElement);
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
            listElement.style.transform = transform;

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
            const targetTranslate = Math.round(projected / itemSize) * itemSize;

            const animationCompletionHandler = () => {

                const finalIndex = API.getCurrentIndex();
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
            // It calculates the correct position within the 'safe' area of clones.
            const targetTranslate = -(index + instanceCloneCount) * itemSize;
            
            if (immediate) {
                // For an immediate snap, kill any ongoing animation, jump directly,
                // and then ensure the wrap-around state is clean for the next interaction.
                listElement.style.transition = 'none';
                listElement.style.transform = IS_HORIZONTAL ? `translateX(${targetTranslate}px)` : `translateY(${targetTranslate}px)`;
                currentTranslate = targetTranslate;

                if (options.onComplete) {

                    options.onComplete(); // Call local onComplete first
                }
                // Then emit the global event
                const finalIndex = API.getCurrentIndex();
                const finalSlideId = slideIdMap[finalIndex];
                emit('snapComplete', { index: finalIndex, slideId: finalSlideId, source: options.source || 'programmatic' });

            } else {
                // For an animated snap, we use the standard animation function.
                // The 'transitionend' handler in animateListTo will handle the wrap-around check.
                const animationCompletionHandler = () => {

                    if (options.onComplete) options.onComplete();

                    const finalIndex = API.getCurrentIndex();
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

            const currentIndex = API.getCurrentIndex();
            const nextIndex = (currentIndex + 1) % sourceItemCount;
            API.snapTo(nextIndex, false, { source: 'navigation' });
        },

        /**
         * Navigates to the previous slide.
         */
        prev() {

            const currentIndex = API.getCurrentIndex();
            const prevIndex = (currentIndex - 1 + sourceItemCount) % sourceItemCount;
            API.snapTo(prevIndex, false, { source: 'navigation' });
        },

        /**
         * Initializes the component state and DOM.
         */
        init() {

            if (IS_HORIZONTAL) {

                itemSize = slideWidth || (listElement.firstElementChild ? listElement.firstElementChild.offsetWidth : 0);
                listElement.style.display = 'flex';

            } else {

                itemSize = slideHeight || (listElement.firstElementChild ? listElement.firstElementChild.offsetHeight : 0);
            }

            if (itemSize === 0) {

                console.error(
                    'Swiper Error: item size could not be determined. Please provide slideWidth/slideHeight options or ensure the list has children when initializing.', { listSelector }
                );
                // Prevent further execution if size is invalid
                return;
            }

            setupInfiniteList();
        },

        /**
         * Gets the current "real" index of the active slide.
         * @returns {number} The zero-based index of the current slide.
         */
        getCurrentIndex() {

            const rawIndex = Math.round(-currentTranslate / itemSize);
            // The raw index includes the prepended clones. We subtract the clone count
            // and then use the modulo operator to wrap the index into the range of original items.
            const wrappedIndex = (rawIndex - instanceCloneCount) % sourceItemCount;

            return (wrappedIndex < 0) ? wrappedIndex + sourceItemCount : wrappedIndex;
        },

        /**
         * Gets the visual index based on the current transform, even during animation.
         * @returns {number} The zero-based index of the visually current slide.
         */
        getVisualIndex() {

            const style = window.getComputedStyle(listElement);
            const matrix = new DOMMatrix(style.transform);
            const liveTranslate = IS_HORIZONTAL ? matrix.m41 : matrix.m42;
            const currentIndex = Math.round(-liveTranslate / itemSize);
            const wrappedIndex = (currentIndex - instanceCloneCount) % workingItemCount;

            return (wrappedIndex < 0) ? wrappedIndex + workingItemCount : wrappedIndex;
        },

        /**
         * Gets the unique ID of the current "real" slide.
         * @returns {string | undefined} The slide ID.
         */
        getCurrentSlideId() {

            const realIndex = API.getCurrentIndex();

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

            return listElement;
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

    API.init();
    return API;
}
