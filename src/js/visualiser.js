/**
 * Creates a stateful SVG visualizer for the puzzle layout.
 * @param {HTMLElement} container - The DOM element to append the SVG to.
 * @param {object} initialOptions - Initial configuration.
 * @returns {object|null} A visualizer instance with an `update` method, or null on failure.
 */
export function createLayoutVisualizer(container, initialOptions = {}) {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const svgWidth = 960;
    const svgHeight = 544;
    const slideWidth = 80;
    const slideHeight = 50;
    const gap = 10;

    let isInitialized = false;
    let currentTransform = null;
    let options = initialOptions;
    let mainGroup = null; // This will hold the <g> element with all the content.
    const slidePositionMap = new Map(); // Persistently stores {x, y} for each slide
    const slideElementsMap = new Map(); // Persistently stores references to slide <g> elements
    const slotElementsMap = new Map(); // Persistently stores references to slot <rect> elements
    const allGroupsInLayout = new Map(); // Persistently stores group directions
    let activeAnimation = null;
    let currentPosHighlightElement = null;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', svgWidth);
    svg.setAttribute('height', svgHeight);
    svg.setAttribute('class', 'layout-svg');
    container.appendChild(svg);

    const initialize = (layout, slideGroups) => {
        const puzzleSlots = layout?.puzzle_slots || [];
        if (puzzleSlots.length === 0) return false;

        mainGroup = document.createElementNS(SVG_NS, 'g');
        svg.appendChild(mainGroup);

        puzzleSlots.forEach(slot => {
            if (slot.host_group_id && !allGroupsInLayout.has(slot.host_group_id)) {
                allGroupsInLayout.set(slot.host_group_id, { id: slot.host_group_id, direction: slot.host_direction });
            }
            if (slot.guest_group_id && !allGroupsInLayout.has(slot.guest_group_id)) {
                allGroupsInLayout.set(slot.guest_group_id, { id: slot.guest_group_id, direction: slot.guest_direction });
            }
        });

        const allGuestGroupIds = new Set(puzzleSlots.map(s => s.guest_group_id));
        const rootGroups = Array.from(allGroupsInLayout.values()).filter(g => !allGuestGroupIds.has(g.id));

        const visited = new Set();
        const calculateLayoutRecursive = (groupId, currentX, currentY) => {
            if (visited.has(groupId)) return;
            visited.add(groupId);

            const groupInfo = allGroupsInLayout.get(groupId);
            const slideGroup = slideGroups.find(g => g.group_id === groupId);
            if (!slideGroup) return;

            const isHorizontal = groupInfo.direction === 'horizontal';
            const guests = puzzleSlots.filter(slot => slot.host_group_id === groupId);

            slideGroup.slides.forEach((slide, index) => {
                const x = isHorizontal ? currentX + index * (slideWidth + gap) : currentX;
                const y = isHorizontal ? currentY : currentY + index * (slideHeight + gap);
                const slideKey = `${groupId}-${index}`;

                // Store position and create elements
                slidePositionMap.set(slideKey, { x, y });

                const g = document.createElementNS(SVG_NS, 'g');
                g.dataset.slideKey = slideKey;
                slideElementsMap.set(slideKey, g);

                const rect = document.createElementNS(SVG_NS, 'rect');
                rect.setAttribute('x', x);
                rect.setAttribute('y', y);
                rect.setAttribute('width', slideWidth);
                rect.setAttribute('height', slideHeight);
                rect.setAttribute('class', `slide-rect ${isHorizontal ? 'horizontal-slide' : 'vertical-slide'}`);
                g.appendChild(rect);

                // if (options.showNames) {

                //     const text = document.createElementNS(SVG_NS, 'text');
                //     text.setAttribute('x', x + slideWidth / 2);
                //     console.log('x + slideWidth / 2:', x + slideWidth / 2)
                //     text.setAttribute('y', y + slideHeight / 2 + 5);
                //     console.log('y + slideHeight / 2 + 5:', y + slideHeight / 2 + 5)
                //     text.setAttribute('text-anchor', 'middle');
                //     text.setAttribute('class', 'slide-text');
                //     text.textContent = slide.name.substring(0, 10);
                //     g.appendChild(text);
                //     console.log('g:', g)
                // }
                mainGroup.appendChild(g);
            });

            guests.forEach(slot => {
                const atIndex = slot.at_index || 0;
                const guestAlignIndex = slot.guest_align_index || 0;
                const hostSlideKey = `${slot.host_group_id}-${atIndex}`;
                const hostPos = slidePositionMap.get(hostSlideKey);
                if (!hostPos) return;

                const highlightRect = document.createElementNS(SVG_NS, 'rect');
                highlightRect.setAttribute('x', hostPos.x);
                highlightRect.setAttribute('y', hostPos.y);
                highlightRect.setAttribute('width', slideWidth);
                highlightRect.setAttribute('height', slideHeight);
                highlightRect.setAttribute('class', 'highlight-slot');
                slotElementsMap.set(slot.slot_id, highlightRect);
                mainGroup.appendChild(highlightRect);

                let nextX, nextY;
                if (isHorizontal) {
                    nextX = hostPos.x;
                    nextY = hostPos.y - (guestAlignIndex * (slideHeight + gap));
                } else {
                    nextY = hostPos.y;
                    nextX = hostPos.x - (guestAlignIndex * (slideWidth + gap));
                }
                calculateLayoutRecursive(slot.guest_group_id, nextX, nextY);
            });
        };

        if (rootGroups.length === 0 && puzzleSlots.length > 0) {
            calculateLayoutRecursive(puzzleSlots[0].host_group_id, 0, 0);
        } else {
            rootGroups.forEach(root => calculateLayoutRecursive(root.id, 0, 0));
        }

        // Create a single highlight element for the player's position.
        currentPosHighlightElement = document.createElementNS(SVG_NS, 'rect');
        currentPosHighlightElement.setAttribute('width', slideWidth);
        currentPosHighlightElement.setAttribute('height', slideHeight);
        currentPosHighlightElement.setAttribute('class', 'current-position-highlight');
        currentPosHighlightElement.style.display = 'none'; // Initially hidden
        mainGroup.appendChild(currentPosHighlightElement);

        isInitialized = true;
        return true;
    };

    const update = (layout, slideGroups, playerState, newOptions = {}) => {
        if (!isInitialized) {
            if (!initialize(layout, slideGroups)) {
                return; // Initialization failed
            }
        }

        options = { ...options, ...newOptions };
        const { showNames, onSlotClick } = options;
        const puzzleSlots = layout?.puzzle_slots || [];

        // --- Update dynamic elements (text, highlights, clicks) ---
        slideElementsMap.forEach((g, key) => {
            const parts = key.split('-');
            const indexStr = parts.pop();
            const groupId = parts.join('-');
            const slideGroup = slideGroups.find(sg => sg.group_id === groupId);
            const slide = slideGroup?.slides[parseInt(indexStr, 10)];
            const textEl = g.querySelector('text');
            if (showNames && slide) {
                if (textEl) {
                    textEl.textContent = slide.name.substring(0, 10);
                } else {
                    const pos = slidePositionMap.get(key);
                    const slideGroupInfo = allGroupsInLayout.get(groupId);
                    const isHorizontal = slideGroupInfo?.direction === 'horizontal';

                    // Adjust y-offset based on swiper direction to prevent overlap.
                    const yOffset = isHorizontal ? 12 : -4;

                    const newText = document.createElementNS(SVG_NS, 'text');
                    newText.setAttribute('x', pos.x + slideWidth / 2);
                    newText.setAttribute('y', (pos.y + slideHeight / 2) + yOffset);
                    newText.setAttribute('text-anchor', 'middle');
                    // Add a class to differentiate labels for styling
                    newText.classList.add(isHorizontal ? 'horizontal-label' : 'vertical-label');
                    newText.setAttribute('class', 'slide-text');
                    newText.textContent = slide.name.substring(0, 10);
                    g.appendChild(newText);
                }
            } else if (textEl) {
                textEl.remove();
            }
        });

        slotElementsMap.forEach((rect, slotId) => {
            const slot = puzzleSlots.find(s => s.slot_id === slotId);
            if (!slot) return;

            const isActive = playerState && (
                (slot.host_group_id === playerState.currentSwiperId && slot.at_index === playerState.currentIndex) ||
                (slot.guest_group_id === playerState.currentSwiperId && (slot.guest_align_index || 0) === playerState.currentIndex)
            );
            rect.classList.toggle('is-active-puzzle-slot', isActive);

            // Remove old listener before adding a new one to prevent duplicates
            if (rect.clickHandler) {
                rect.removeEventListener('click', rect.clickHandler);
            }
            if (onSlotClick) {
                rect.clickHandler = () => onSlotClick(slot);
                rect.classList.add('clickable');
                rect.addEventListener('click', rect.clickHandler);
            } else {
                rect.classList.remove('clickable');
            }
        });

        const playerSlideKey = playerState ? `${playerState.currentSwiperId}-${playerState.currentIndex}` : null;
        const playerSlidePos = playerSlideKey ? slidePositionMap.get(playerSlideKey) : null;

        if (playerSlidePos && currentPosHighlightElement) {
            currentPosHighlightElement.setAttribute('x', playerSlidePos.x);
            currentPosHighlightElement.setAttribute('y', playerSlidePos.y);
            currentPosHighlightElement.style.display = 'block';
        } else if (currentPosHighlightElement) {
            currentPosHighlightElement.style.display = 'none';
        }

        // --- Transform Calculation ---
        let targetTransform;
        if (playerSlidePos) {

            const targetScreenX = svgWidth * (5/8);
            const offsetX = targetScreenX - (playerSlidePos.x + slideWidth / 2);
            const offsetY = (svgHeight / 2) - (playerSlidePos.y + slideHeight / 2);
            targetTransform = `translate(${offsetX}, ${offsetY})`;
        } else {
            // Fallback for initial state or error
            const bounds = { minX: 0, minY: 0, maxX: svgWidth, maxY: svgHeight }; // Simplified fallback
            const contentWidth = bounds.maxX - bounds.minX;
            const contentHeight = bounds.maxY - bounds.minY;
            const offsetX = (svgWidth - contentWidth) / 2 - bounds.minX;
            const offsetY = (svgHeight - contentHeight) / 2 - bounds.minY;
            targetTransform = `translate(${offsetX}, ${offsetY})`;
        }

        // --- Animation and DOM Update ---
        if (!currentTransform) {
            mainGroup.setAttribute('transform', targetTransform);
        } else if (currentTransform !== targetTransform) {
            let startTransform = window.getComputedStyle(mainGroup).transform;
            if (startTransform === 'none') startTransform = currentTransform;

            if (activeAnimation) {
                activeAnimation.cancel();
            }

            // Commit the new position to the DOM immediately.
            mainGroup.setAttribute('transform', targetTransform);

            activeAnimation = mainGroup.animate(
                [{ transform: startTransform }, { transform: targetTransform }],
                { duration: 400, easing: 'ease-in-out' }
            );
            activeAnimation.onfinish = () => {
                activeAnimation = null;
            };
        }

        currentTransform = targetTransform;
    };

    return {
        update
    };
}
