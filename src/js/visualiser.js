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
    const { showNames, onSlotClick, playerState } = options;

    const SVG_NS = "http://www.w3.org/2000/svg";

    const puzzleSlots = layout?.puzzle_slots || [];

    if (puzzleSlots.length === 0) {

        return null;
    }

    // --- Constants for SVG rendering ---
    const svgWidth = 397;
    const svgHeight = 298;
    const slideWidth = 40;
    const slideHeight = 25;
    const gap = 5;

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
    const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
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
            if (playerState && slot.host_group_id === playerState.currentSliderId && slot.at_index === playerState.currentIndex) {
                highlightRect.classList.add('is-active-puzzle-slot');
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

    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    const offsetX = (svgWidth - contentWidth) / 2 - bounds.minX;
    const offsetY = (svgHeight - contentHeight) / 2 - bounds.minY;

    const finalGroup = document.createElementNS(SVG_NS, 'g');
    finalGroup.setAttribute('transform', `translate(${offsetX}, ${offsetY})`);
    finalGroup.appendChild(slideElements);
    finalGroup.appendChild(highlightElements);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', svgWidth);
    svg.setAttribute('height', svgHeight);
    svg.setAttribute('class', 'layout-svg');
    svg.appendChild(finalGroup);

    return svg;
}
