import { wrap } from './utils.js'; // This utility is used by the main swiper as well.

/**
 * Creates a single, controllable swipe instance for SVG <g> elements containing <rect> slides,
 * with infinite scrolling capabilities for the lead-in screen.
 * @param {object} options - The configuration for the swiper.
 * @param {string} options.elementSelector - The CSS selector for the <g> element containing the slides.
 * @param {'horizontal' | 'vertical'} options.direction - The swipe direction.
 * @param {number} options.itemSize - The pre-calculated size (width or height) of a single slide item, including spacing.
 * @param {number} [options.initialIndex=0] - The data-index of the slide that should be initially visible.
 * @param {string} options.playSlideId - The data-slide-id of the slide that represents the "play" position.
 * @param {number} [options.throwMultiplier=0.7] - Multiplier for swipe velocity to determine snap distance.
 * @param {string} [options.id] - An optional unique identifier for the swiper instance.
 * @returns {object} A public API to control the swiper instance.
 */
export function createLeadInSwiper(options) {
    const {
        elementSelector,
        direction,
        itemSize,
        initialIndex = 0,
        playSlideId,
        throwMultiplier = 0.7,
        id = null,
    } = options;

    const element = document.querySelector(elementSelector);
    if (!element) {
        console.error('LeadInSwiper Error: element not found.', { elementSelector });
        return;
    }

    const IS_HORIZONTAL = direction === 'horizontal';
    const THROW_MULTIPLIER = throwMultiplier;

    // --- State Variables (mirroring swiper.js) ---
    let startPos = 0;
    let startTranslate = 0;
    let currentTranslate = 0;
    let lastMoveTime = 0;
    let lastMovePos = 0;
    let velocity = 0;
    let sourceItemCount = 0; // The real number of unique items
    let slideIdMap = []; // Maps original index to slide ID
    const listeners = new Map();

    // --- Private Methods (adapted from swiper.js) ---

    const emit = (eventName, payload) => {
        if (listeners.has(eventName)) {
            listeners.get(eventName).forEach(callback => {
                try { callback(payload); } catch (e) { console.error(`Error in leadin-swiper event listener for '${eventName}':`, e); }
            });
        }
    };

    const checkWrapAround = () => {
        const currentIndex = Math.round(-currentTranslate / itemSize);
        const filmstripLength = itemSize * sourceItemCount;

        // If the current translation has moved outside the bounds of the original middle group,
        // wrap it back around.
        // The "safe" area is between 0 and -2 * filmstripLength. If we go past that, we wrap.
        if (currentTranslate > 0 || currentTranslate < -2 * filmstripLength) {
            element.style.transition = 'none';
            // Use modulo to find the position within a single filmstrip length and offset it back into the 'safe' area.
            currentTranslate = (currentTranslate % filmstripLength) - filmstripLength;
            element.style.transform = IS_HORIZONTAL ? `translateX(${currentTranslate}px)` : `translateY(${currentTranslate}px)`;
            void element.offsetWidth; // Force reflow
        }
    };

    const animateListTo = (targetTranslate, onComplete = null) => {
        const distance = Math.abs(targetTranslate - currentTranslate);
        const duration = Math.min(0.3 + distance / 4000, 0.8); // Use same timing as main swiper

        element.style.transition = `transform ${duration}s cubic-bezier(0.2, 0.8, 0.2, 1)`;
        element.style.transform = IS_HORIZONTAL ? `translateX(${targetTranslate}px)` : `translateY(${targetTranslate}px)`;

        const handleTransitionEnd = () => {
            element.removeEventListener('transitionend', handleTransitionEnd);
            currentTranslate = targetTranslate;
            if (onComplete) onComplete();
            // Perform the silent wrap-around check AFTER the snap is complete.
            checkWrapAround();
        };
        element.addEventListener('transitionend', handleTransitionEnd, { once: true });
    };

    const setupInfiniteList = (originalSlidesGroup) => {
        const originalSlides = Array.from(originalSlidesGroup.children);
        sourceItemCount = originalSlides.length;

        if (sourceItemCount === 0) return;

        // Sort slides by data-index to ensure slideIdMap is correct
        originalSlides.sort((a, b) => parseInt(a.dataset.index) - parseInt(b.dataset.index));
        slideIdMap = originalSlides.map(item => item.dataset.slideId);

        // Create four clones of the entire slide group for a [C, C, O, C, C] structure
        const clones = Array.from({ length: 4 }, () => {
            const clone = originalSlidesGroup.cloneNode(true);
            clone.classList.add('swiper-clone');
            return clone;
        });

        // Clear the main swiper element and append the groups in order
        element.innerHTML = '';
        element.appendChild(clones[0]); // Prepend clone 1
        element.appendChild(clones[1]); // Prepend clone 2
        element.appendChild(originalSlidesGroup);
        element.appendChild(clones[2]); // Append clone 1
        element.appendChild(clones[3]); // Append clone 2

        // Position the five groups to form a continuous filmstrip
        const filmstripLength = itemSize * sourceItemCount;
        const transformProp = IS_HORIZONTAL ? 'translateX' : 'translateY';
        clones[0].style.transform = `${transformProp}(${-2 * filmstripLength}px)`;
        clones[1].style.transform = `${transformProp}(${-filmstripLength}px)`;
        originalSlidesGroup.style.transform = `${transformProp}(0px)`; // The original is our reference point
        clones[2].style.transform = `${transformProp}(${filmstripLength}px)`;
        clones[3].style.transform = `${transformProp}(${2 * filmstripLength}px)`;

        // Set initial position to the start of the "middle" block of real slides
        // We offset by one filmstrip length to start on the original group, not a clone.
        currentTranslate = -filmstripLength - (itemSize * initialIndex);
        element.style.transform = IS_HORIZONTAL ? `translateX(${currentTranslate}px)` : `translateY(${currentTranslate}px)`;
    };

    // --- Public API (mirroring swiper.js) ---

    const API = {
        id: id,
        startDrag(position) {
            element.style.transition = 'none';
            const matrix = new DOMMatrix(window.getComputedStyle(element).transform);
            currentTranslate = IS_HORIZONTAL ? matrix.m41 : matrix.m42;
            startPos = position;
            startTranslate = currentTranslate;
            lastMoveTime = performance.now();
            lastMovePos = startPos;
            velocity = 0;
        },
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
            element.style.transform = IS_HORIZONTAL ? `translateX(${currentTranslate}px)` : `translateY(${currentTranslate}px)`;
            emit('drag');
        },
        endDrag(onComplete = null) {
            emit('dragEnd', { velocity: velocity, currentTranslate: currentTranslate });
            const projected = currentTranslate + velocity * itemSize * THROW_MULTIPLIER;
            const targetTranslate = Math.round(projected / itemSize) * itemSize;
            animateListTo(targetTranslate, () => {
                emit('snapComplete', { slideId: API.getCurrentSlideId(), source: 'drag' });
                if (onComplete) onComplete();
            });
        },
        snapTo(slideId, immediate = false, options = {}) {
            const index = slideIdMap.indexOf(slideId);
            if (index === -1) {
                console.warn(`LeadInSwiper: Slide with ID ${slideId} not found.`);
                return;
            }
            const targetTranslate = -filmstripLength - (index * itemSize);
            if (immediate) {
                element.style.transition = 'none';
                element.style.transform = IS_HORIZONTAL ? `translateX(${targetTranslate}px)` : `translateY(${targetTranslate}px)`;
                currentTranslate = targetTranslate;
                if (options.onComplete) options.onComplete();
                emit('snapComplete', { slideId: API.getCurrentSlideId(), source: options.source || 'programmatic' });
            } else {
                animateListTo(targetTranslate, () => {
                    if (options.onComplete) options.onComplete();
                    emit('snapComplete', { slideId: API.getCurrentSlideId(), source: options.source || 'programmatic' });
                });
            }
        },
        getCurrentSlideId() {
            const filmstripLength = itemSize * sourceItemCount;
            const rawIndex = Math.round((-currentTranslate - filmstripLength) / itemSize);
            const logicalIndex = wrap(rawIndex, sourceItemCount);
            return slideIdMap[logicalIndex];
        },
        getDirection() { return direction; },
        getElement() { return element; },
        on(eventName, callback) {
            if (!listeners.has(eventName)) listeners.set(eventName, []);
            listeners.get(eventName).push(callback);
        },
        off(eventName, callback) {
            if (listeners.has(eventName)) {
                const eventListeners = listeners.get(eventName);
                const index = eventListeners.indexOf(callback);
                if (index > -1) eventListeners.splice(index, 1);
            }
        },
        init() {
            // Clear any existing clones before setup
            const clones = element.querySelectorAll('.swiper-clone');
            clones.forEach(clone => clone.remove());

            // Find the original group of slides. There should only be one non-clone group.
            const originalSlidesGroup = element.querySelector('g:not(.swiper-clone)');
            if (!originalSlidesGroup) {
                console.error('LeadInSwiper Error: Original slide group not found in', elementSelector);
                return;
            }
            const slides = originalSlidesGroup.children;
            if (slides.length === 0) return; // Guard against no slides

            setupInfiniteList(originalSlidesGroup);
        },
        getPlaySlideId() { return playSlideId; }
    };

    API.init();
    return API;
}
