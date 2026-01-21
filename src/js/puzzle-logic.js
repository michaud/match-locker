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

    const { description, gametitle, licences } = gameData;
 
    // Ensure slideGroups contains entries for all groups mentioned in the layout,
    // including virtual ones that might not have explicit slide definitions.
    // This prevents errors in downstream functions like buildWorldMap.
    const allGroupIds = new Set(slideGroups.map(g => g.group_id));
    if (layout && layout.sliders) {
        layout.sliders.forEach(slider => {
            const groupId = slider.populates_from_group;
            if (groupId && !allGroupIds.has(groupId)) {
                slideGroups.push({
                    group_id: groupId,
                    group_name: `Virtual Group ${groupId}`, // Provide a default name
                    slides: [] // Virtual groups might not have slides initially
                });
                allGroupIds.add(groupId);
            }
        });
    }

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

        let solutions = (rawPuzzle.matches || []).map(m => m.match);

        // If a subset count is defined for a 'set' puzzle, randomly select that many matches.
        if (rawPuzzle.type === 'set' && rawPuzzle.subset_count > 0 && solutions.length > rawPuzzle.subset_count) {
            // Fisher-Yates shuffle to randomize the solutions array
            for (let i = solutions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [solutions[i], solutions[j]] = [solutions[j], solutions[i]];
            }
            // Slice the array to the desired count
            solutions = solutions.slice(0, rawPuzzle.subset_count);
        }

        newPuzzleData.push({
            id: rawPuzzle.puzzle_id,
            puzzletitle: rawPuzzle.puzzletitle,
            instructions: rawPuzzle.instructions,
            type: rawPuzzle.type || 'set',
            evaluation: rawPuzzle.evaluation || 'unordered',
            subset_count: rawPuzzle.subset_count || 0,
            solutions: solutions
        });
    });

    // Collect all slide IDs that are part of the active solutions in the processed puzzles.
    const activeSlideIds = new Set();
    newPuzzleData.forEach(puzzle => {
        puzzle.solutions.forEach(match => {
            match.forEach(slideId => activeSlideIds.add(slideId));
        });
    });

    // Process slide groups: filter based on active puzzle subset and shuffle if requested.
    const filteredSlideGroups = slideGroups.map(group => {
        let slides = group.slides ? [...group.slides] : [];

        if (activeSlideIds.size > 0) {
            slides = slides.filter(slide => activeSlideIds.has(slide.id));
        }

        if (group.scramble !== false) {
            for (let i = slides.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [slides[i], slides[j]] = [slides[j], slides[i]];
            }
        }
        return { ...group, slides };
    });

    // The layout object from the game data is now the source of truth.
    return { slideData, newPuzzleData, slideGroups: filteredSlideGroups, layout, description, gametitle, licences };
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
                up: slider.direction === 'vertical' ? { swiperId: slider.id, index: prevIndex } : null,
                down: slider.direction === 'vertical' ? { swiperId: slider.id, index: nextIndex } : null,
                left: slider.direction === 'horizontal' ? { swiperId: slider.id, index: prevIndex } : null,
                right: slider.direction === 'horizontal' ? { swiperId: slider.id, index: nextIndex } : null,
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
                // Only assign guest navigation if the host doesn't have its own in that direction.
                if (hostNode.up === null) hostNode.up = { swiperId: slot.guest_group_id, index: guestPrevIndex };
                if (hostNode.down === null) hostNode.down = { swiperId: slot.guest_group_id, index: guestNextIndex };

            } else {
                // Only assign guest navigation if the host doesn't have its own in that direction.
                if (hostNode.left === null) hostNode.left = { swiperId: slot.guest_group_id, index: guestPrevIndex };
                if (hostNode.right === null) hostNode.right = { swiperId: slot.guest_group_id, index: guestNextIndex };
            }

            hostNode.guest = { swiperId: slot.guest_group_id, index: guestConnectionIndex };
        }

        if (map.has(guestKey)) {

            const guestNode = map.get(guestKey);
            const hostNode = map.get(hostKey);
            guestNode.isConnection = true;

            if (hostSlider.direction === 'horizontal') { // If host is horizontal, guest must be vertical

                guestNode.left = (hostNode && hostNode.left) ? hostNode.left : { swiperId: slot.host_group_id, index: slot.at_index };
                guestNode.right = (hostNode && hostNode.right) ? hostNode.right : { swiperId: slot.host_group_id, index: slot.at_index };

            } else {

                guestNode.up = (hostNode && hostNode.up) ? hostNode.up : { swiperId: slot.host_group_id, index: slot.at_index };
                guestNode.down = (hostNode && hostNode.down) ? hostNode.down : { swiperId: slot.host_group_id, index: slot.at_index };
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
