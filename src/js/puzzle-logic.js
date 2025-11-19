import { validateSet, validateStar, validateChain, validateRing } from './puzzle-validators.js';
/**
 * Parses the raw game data into structured formats needed by the application.
 * @param {object} gameData - The raw JSON data for the game.
 * @returns {{slideData: object, newPuzzleData: Array, layoutSliders: Map, slideGroups: Array, layout: object}}
 */
export const processGameData = (gameData) => {
    // Use properties directly from the passed gameData object to avoid destructuring issues.
    const slideGroups = gameData.slide_groups || [];
    const layout = gameData.layout || { puzzle_slots: [] };
    const rawPuzzles = gameData.puzzles || [];

    //generate a virtual sliders list for the game engine directly from `puzzle_slots`.
    const virtualSliders = new Map();

    if (layout && layout.puzzle_slots) {

        layout.puzzle_slots.forEach(slot => {

            if (slot.host_group_id && !virtualSliders.has(slot.host_group_id)) {

                virtualSliders.set(slot.host_group_id, {
                    id: slot.host_group_id,
                    direction: slot.host_direction || 'horizontal', // Default direction
                    populates_from_group: slot.host_group_id
                });
            }

            if (slot.guest_group_id && !virtualSliders.has(slot.guest_group_id)) {

                virtualSliders.set(slot.guest_group_id, {
                    id: slot.guest_group_id,
                    direction: slot.guest_direction || 'vertical', // Default direction
                    populates_from_group: slot.guest_group_id
                });
            }
        });
    }

    // Ensure slideGroups contains entries for all groups mentioned in the layout,
    // including virtual ones that might not have explicit slide definitions.
    // This prevents errors in downstream functions like buildWorldMap.
    const allGroupIds = new Set(slideGroups.map(g => g.group_id));
    virtualSliders.forEach((slider, groupId) => {
        if (!allGroupIds.has(groupId)) {
            slideGroups.push({
                group_id: groupId,
                group_name: `Virtual Group ${groupId}`, // Provide a default name
                slides: [] // Virtual groups might not have slides initially
            });
        }
    });

    const slideData = {};

    slideGroups.forEach(group => {

        group.slides.forEach(slide => {

            if (!slide.id) {

                console.error('Slide is missing an ID in game data:', slide);

                return;
            }

            slideData[slide.id] = { img: slide.img, name: slide.name };
        });
    });

    const newPuzzleData = [];

    rawPuzzles.forEach(rawPuzzle => {

        newPuzzleData.push({
            id: rawPuzzle.puzzle_id,
            puzzletitle: rawPuzzle.puzzletitle,
            instructions: rawPuzzle.instructions,
            type: rawPuzzle.type || 'set',
            evaluation: rawPuzzle.evaluation || 'unordered',
            solutions: (rawPuzzle.matches || []).map(m => m.match)
        });
    });

    // We pass the virtual sliders to the game engine, but the core layout object remains clean.
    const layoutForEngine = { ...layout, sliders: Array.from(virtualSliders.values()) };

    return { slideData, newPuzzleData, slideGroups, layout: layoutForEngine };
}

/**
 * Builds the world map for navigation between sliders.
 * @param {object} layout - The layout configuration.
 * @param {Array} slideGroups - The array of slide groups.
 * @param {Map} layoutSliders - A map of layout sliders.
 * @returns {Map} The constructed world map.
 */
export const buildWorldMap = (layout, slideGroups) => {

    const map = new Map();
    const layoutSliders = new Map((layout.sliders || []).map(s => [s.id, s]));
    
    (layout.sliders || []).forEach(slider => {

        const slideGroup = slideGroups.find(g => g.group_id === slider.populates_from_group);

        if (!slideGroup) return;

        const slideCount = slideGroup.slides.length;

        for (let i = 0; i < slideCount; i++) {

            const key = `${slider.id}-${i}`;
            const prevIndex = (i - 1 + slideCount) % slideCount;
            const nextIndex = (i + 1) % slideCount;

            map.set(key, {
                up: slider.direction === 'vertical' ? { sliderId: slider.id, index: prevIndex } : null,
                down: slider.direction === 'vertical' ? { sliderId: slider.id, index: nextIndex } : null,
                left: slider.direction === 'horizontal' ? { sliderId: slider.id, index: prevIndex } : null,
                right: slider.direction === 'horizontal' ? { sliderId: slider.id, index: nextIndex } : null,
                guest: null,
                isConnection: false
            });
        }
    });

    (layout.puzzle_slots || []).forEach(slot => {

        const hostKey = `${slot.host_group_id}-${slot.at_index}`;
        const hostSlider = layoutSliders.get(slot.host_group_id);
        const guestSlider = layoutSliders.get(slot.guest_group_id);

        if (!hostSlider || !guestSlider) return;

        const guestConnectionIndex = slot.guest_align_index || 0;
        const guestKey = `${slot.guest_group_id}-${guestConnectionIndex}`;

        if (map.has(hostKey)) {

            const hostNode = map.get(hostKey);
            const guestSlideGroup = slideGroups.find(g => g.group_id === guestSlider.populates_from_group);

            if (!guestSlideGroup) return;

            const guestSlideCount = guestSlideGroup.slides.length;

            const guestPrevIndex = (guestConnectionIndex - 1 + guestSlideCount) % guestSlideCount;
            const guestNextIndex = (guestConnectionIndex + 1) % guestSlideCount;

            if (guestSlider.direction === 'vertical') {
                // When on the host, 'up' goes to the previous slide on the guest, 'down' to the next.
                hostNode.up = { sliderId: slot.guest_group_id, index: guestPrevIndex };
                hostNode.down = { sliderId: slot.guest_group_id, index: guestNextIndex };

            } else {
                // When on the host, 'left' goes to the previous slide on the guest, 'right' to the next.
                hostNode.left = { sliderId: slot.guest_group_id, index: guestPrevIndex };
                hostNode.right = { sliderId: slot.guest_group_id, index: guestNextIndex };
            }

            hostNode.guest = { sliderId: slot.guest_group_id, index: guestConnectionIndex };
        }

        if (map.has(guestKey)) {

            const guestNode = map.get(guestKey);
            guestNode.isConnection = true;

            if (guestSlider.direction === 'vertical') {

                guestNode.left = { sliderId: slot.host_group_id, index: slot.at_index };
                guestNode.right = { sliderId: slot.host_group_id, index: slot.at_index };

            } else {

                guestNode.up = { sliderId: slot.host_group_id, index: slot.at_index };
                guestNode.down = { sliderId: slot.host_group_id, index: slot.at_index };
            }
        }
    });

    return map;
};

/**
 * Checks if the current puzzle is solved based on the game state.
 * @param {Array} puzzleData - The array of puzzle data for the current game.
 * @param {object} gameState - The current state of the player's game.
 * @returns {boolean} True if the puzzle is solved, false otherwise. 
 */
export const isPuzzleSolved = (puzzle, playerMatches) => {

    if (!puzzle || !playerMatches) return false;
    
    switch (puzzle.type) {
        case 'star':
            return validateStar(puzzle.solutions, playerMatches, puzzle.evaluation);

        case 'chain':
            return validateChain(puzzle.solutions, playerMatches, puzzle.evaluation);

        case 'ring':
            return validateRing(puzzle.solutions, playerMatches, puzzle.evaluation);

        case 'set':
        default:
            return validateSet(puzzle.solutions, playerMatches, puzzle.evaluation);
    }
};
