/**
 * Creates an SVG visualization of the puzzle layout
 * @param {object} layout - The layout configuration.
 * @param {Array} slideGroups - The array of all slide groups.
 * @param {object} options - Visualization options.
 * @param {boolean} options.showNames - Whether to display slide names.
 * @param {function} options.onSlotClick - Callback for when a slot is clicked.
 * @returns {SVGElement|null} The SVG element or null if not possible.
 */
export function createLayoutVisualizer(layout, slideGroups, options = { showNames: false, onSlotClick: null }) {
    const { showNames, onSlotClick, playerState, existingSvg } = options;

    const SVG_NS = "http://www.w3.org/2000/svg";

    const puzzleSlots = layout?.puzzle_slots || [];

    if (puzzleSlots.length === 0) {

        return null;
    }

    // --- Constants for SVG rendering ---
    const svgWidth = 960;
    const svgHeight = 544;
    const slideWidth = 80;
    const slideHeight = 50;
    const gap = 10;

    // --- Logic ported from React component ---
    const allGroupsInLayout = new Map();

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

    const slideElements = document.createDocumentFragment();
    const highlightElements = document.createDocumentFragment();
    const currentPosHighlightElements = document.createDocumentFragment();
    const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    // Store the coordinates of the player's current slide to use for centering.
    let currentPlayerSlideX = null;
    let currentPlayerSlideY = null;
    // Store the coordinates of the active puzzle slot for centering.
    let activePuzzleSlotX = null;
    let activePuzzleSlotY = null;

    const visited = new Set();

    const calculateLayoutRecursive = (groupId, currentX, currentY) => {

        if (visited.has(groupId)) return;

        visited.add(groupId);

        const groupInfo = allGroupsInLayout.get(groupId);
        const slideGroup = slideGroups.find(g => g.group_id === groupId);

        if (!slideGroup) return;

        const isHorizontal = groupInfo.direction === 'horizontal';
        const guests = puzzleSlots.filter(slot => slot.host_group_id === groupId);

        const sliderWidthCalc = isHorizontal ? slideGroup.slides.length * (slideWidth + gap) - gap : slideWidth;
        const sliderHeightCalc = isHorizontal ? slideHeight : slideGroup.slides.length * (slideHeight + gap) - gap;
        bounds.minX = Math.min(bounds.minX, currentX);
        bounds.minY = Math.min(bounds.minY, currentY);
        bounds.maxX = Math.max(bounds.maxX, currentX + sliderWidthCalc);
        bounds.maxY = Math.max(bounds.maxY, currentY + sliderHeightCalc);

        slideGroup.slides.forEach((slide, index) => {

            const x = isHorizontal ? currentX + index * (slideWidth + gap) : currentX;
            const y = isHorizontal ? currentY : currentY + index * (slideHeight + gap);

            const g = document.createElementNS(SVG_NS, 'g');
            const rect = document.createElementNS(SVG_NS, 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', slideWidth);
            rect.setAttribute('height', slideHeight);
            rect.setAttribute('class', `slide-rect ${isHorizontal ? 'horizontal-slide' : 'vertical-slide'}`);
            g.appendChild(rect);

            if (showNames) {

                const text = document.createElementNS(SVG_NS, 'text');
                text.setAttribute('x', x + slideWidth / 2);
                text.setAttribute('y', isHorizontal ? y + slideHeight / 2 + 5 : y + slideHeight - 5);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('class', 'slide-text');
                text.textContent = slide.name.substring(0, 10);
                g.appendChild(text);
            }

            // If this slide is the player's current position, add a highlight for it.
            if (playerState && groupId === playerState.currentSwiperId && index === playerState.currentIndex) {
                const currentPosRect = document.createElementNS(SVG_NS, 'rect');
                currentPosRect.setAttribute('x', x);
                currentPosRect.setAttribute('y', y);
                currentPosRect.setAttribute('width', slideWidth);
                currentPosRect.setAttribute('height', slideHeight);
                currentPosRect.setAttribute('class', 'current-position-highlight');
                currentPosHighlightElements.appendChild(currentPosRect);
                currentPlayerSlideX = x;
                currentPlayerSlideY = y;
            }
            slideElements.appendChild(g);
        });

        guests.forEach(slot => {

            const atIndex = slot.at_index || 0;
            const guestAlignIndex = slot.guest_align_index || 0;

            const highlightX = isHorizontal ? currentX + atIndex * (slideWidth + gap) : currentX;
            const highlightY = isHorizontal ? currentY : currentY + atIndex * (slideHeight + gap);

            const highlightRect = document.createElementNS(SVG_NS, 'rect');
            highlightRect.setAttribute('x', highlightX);
            highlightRect.setAttribute('y', highlightY);
            highlightRect.setAttribute('width', slideWidth);
            highlightRect.setAttribute('height', slideHeight);
            highlightRect.setAttribute('class', 'highlight-slot');

            // Check if this is the currently active puzzle slot
            if (playerState && slot.host_group_id === playerState.currentSwiperId && slot.at_index === playerState.currentIndex) {
                highlightRect.classList.add('is-active-puzzle-slot');
                activePuzzleSlotX = highlightX;
                activePuzzleSlotY = highlightY;
            }

            if (onSlotClick) {

                highlightRect.classList.add('clickable');
                highlightRect.addEventListener('click', () => onSlotClick(slot));
            }

            highlightElements.appendChild(highlightRect);

            let nextX, nextY;

            if (isHorizontal) {

                nextX = currentX + atIndex * (slideWidth + gap);
                nextY = currentY - (guestAlignIndex * (slideHeight + gap));

            } else {

                nextY = currentY + atIndex * (slideHeight + gap);
                nextX = currentX - (guestAlignIndex * (slideWidth + gap));
            }

            calculateLayoutRecursive(slot.guest_group_id, nextX, nextY);
        });
    };

    if (rootGroups.length === 0 && puzzleSlots.length > 0) {

        calculateLayoutRecursive(puzzleSlots[0].host_group_id, 0, 0);

    } else {

        rootGroups.forEach(root => calculateLayoutRecursive(root.id, 0, 0));
    }

    const finalGroup = document.createElementNS(SVG_NS, 'g');
    finalGroup.appendChild(slideElements);
    finalGroup.appendChild(currentPosHighlightElements);
    finalGroup.appendChild(highlightElements);

    let targetTransform;

    if (playerState && activePuzzleSlotX !== null) {
        // Center the view on the active puzzle slot, shifted to the right.
        const targetScreenX = svgWidth * (5 / 8);
        const offsetX = targetScreenX - (activePuzzleSlotX + slideWidth / 2);
        const offsetY = (svgHeight / 2) - (activePuzzleSlotY + slideHeight / 2);
        targetTransform = `translate(${offsetX}px, ${offsetY}px)`;
    } else {
        // Fallback to centering the whole layout.
        const contentWidth = bounds.maxX - bounds.minX;
        const contentHeight = bounds.maxY - bounds.minY;
        const offsetX = (svgWidth - contentWidth) / 2 - bounds.minX;
        const offsetY = (svgHeight - contentHeight) / 2 - bounds.minY;
        targetTransform = `translate(${offsetX}px, ${offsetY}px)`;
    }
    console.log('targetTransform:', targetTransform)

    // Check if an old visualizer group exists and get its transform
    const oldGroup = existingSvg ? existingSvg.querySelector('g') : null; // Use the passed-in element
    const oldTransform = oldGroup ? oldGroup.getAttribute('transform') : targetTransform;
    console.log('oldTransform:', oldTransform)

    // Only animate if the transform has actually changed. This prevents no-op
    // animations that can interfere with other browser events like 'transitionend'.
    if (oldTransform !== targetTransform) {
        finalGroup.animate(
            [
                { transform: oldTransform, easing: 'ease-out' },
                { transform: targetTransform }
            ], 
            { duration: 400, easing: 'ease-in-out', fill: 'forwards' }
        );
    } else {
        // If there's no change, just apply the transform directly without animation.
        console.log('finalGroup.setAttribute(transform:', finalGroup.getAttribute('transform'))
        finalGroup.setAttribute('transform', targetTransform);
    }

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', svgWidth);
    svg.setAttribute('height', svgHeight);
    svg.setAttribute('class', 'layout-svg');
    svg.appendChild(finalGroup);

    return svg;
}
