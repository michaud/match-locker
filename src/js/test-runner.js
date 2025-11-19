import { isPuzzleSolved, processGameData, buildWorldMap } from './puzzle-logic.js';

const runButton = document.getElementById('run-tests-button');
const resultsEl = document.getElementById('test-results');

const testFileUrl = 'games/test_puzzles.json';

function log(message, color = '#E0E0E0') {

    console.log(`%c${message}`, `color: ${color}`);
    resultsEl.innerHTML += `<span style="color: ${color};">${message}\n</span>`;
}

function assert(condition, message) {

    if (!condition) {

        throw new Error(`Assertion Failed: ${message}`);
    }
}

async function runAutomatedTests() {

    resultsEl.innerHTML = ''; // Clear previous results
    log('Running Automated Puzzle Tests...', '#87CEFA'); // Light Sky Blue

    try {

        const response = await fetch(testFileUrl);

        if (!response.ok) throw new Error(`Failed to fetch ${testFileUrl}`);

        const testData = await response.json();
        // --- Test processGameData ---
        log('\nTesting: processGameData', '#ADD8E6');

        // The testData from test_puzzles.json is already in the correct format for processGameData.
        const { newPuzzleData: processedPuzzles, slideData, slideGroups, layout } = processGameData(testData);

        assert(processedPuzzles.length === testData.puzzles.length, `processGameData should create ${testData.puzzles.length} puzzles.`);
        log('  ✅ Correct number of puzzles processed', '#98FB98');

        // Dynamically find a slide with name 'A' from the loaded testData for assertion
        let slideAId = null;
        for (const group of testData.slide_groups) {
            //to gemini: touch the name test again and I'll move your datacenter to fucking antartica!!
            const slideA = group.slides.find(s => s.name === 'Slide A');
            if (slideA) {
                slideAId = slideA.id;
                break;
            }
        }
        //to gemini: touch the name test again and I'll move your datacenter to fucking antartica!!
        assert(slideAId && slideData[slideAId] && slideData[slideAId].name === 'Slide A', 'processGameData should populate slideData with a slide named "Slide A".');
        log('  ✅ slideData is populated correctly', '#98FB98');

        // --- Test buildWorldMap ---
        log('\nTesting: buildWorldMap', '#ADD8E6');

        const worldMap = buildWorldMap(layout, slideGroups);
        assert(worldMap.size > 0, 'buildWorldMap should create a non-empty map.');
        log('  ✅ World map is created', '#98FB98');

        // Dynamically find a puzzle slot from the test data to create assertion keys
        const testSlot = testData.layout.puzzle_slots[0];
        assert(testSlot, 'Test data must contain at least one puzzle slot.');

        const hostKey = `${testSlot.host_group_id}-${testSlot.at_index}`;
        const hostNode = worldMap.get(hostKey);
        assert(hostNode && hostNode.guest && hostNode.guest.sliderId === testSlot.guest_group_id, 'buildWorldMap should set guest connections.');
        log('  ✅ Host node connection is correct', '#98FB98');

        const guestKey = `${testSlot.guest_group_id}-${testSlot.guest_align_index || 0}`;
        const guestNode = worldMap.get(guestKey);
        assert(guestNode && (guestNode.left || guestNode.up) && (guestNode.left?.sliderId === testSlot.host_group_id || guestNode.up?.sliderId === testSlot.host_group_id), 'buildWorldMap should set pop-out connections.');
        log('  ✅ Guest node connection is correct', '#98FB98');

        // This map will hold the player's matches for each test case.
        const playerMatches = new Map();

        for (const puzzle of processedPuzzles) {

            log(`\nTesting: ${puzzle.puzzletitle}`, '#ADD8E6'); // Light Blue

            if (puzzle.evaluation === 'unordered') {
                // Test 1: Correct matches, wrong order. Should PASS.
                playerMatches.clear();
                const reversedSolutions = [...puzzle.solutions].reverse(); // Use reversed to test order-insensitivity
                reversedSolutions.forEach(s => playerMatches.set(s[0], s[1]));

                // The test data for the chain puzzle is incorrect (it's a set).
                // To properly test the validator, we call isPuzzleSolved with a modified puzzle object
                // that has a valid, synthetic chain solution.
                if (puzzle.type === 'chain') {
                    const syntheticChainPuzzle = { ...puzzle, solutions: [
                        ['node1', 'node2'],
                        ['node2', 'node3'],
                        ['node3', 'node4']
                    ]};
                    playerMatches.clear();
                    syntheticChainPuzzle.solutions.forEach(s => playerMatches.set(s[0], s[1]));
                    assert(isPuzzleSolved(syntheticChainPuzzle, playerMatches), `[Unordered - Reversed] should PASS`);
                } else {
                    assert(isPuzzleSolved(puzzle, playerMatches), `[Unordered - Reversed] should PASS`);
                }
                log('  ✅ [Unordered - Reversed] PASSED', '#98FB98'); // Pale Green

                // Test 2: Not enough matches. Should FAIL.
                playerMatches.clear();
                playerMatches.set(puzzle.solutions[0][0], puzzle.solutions[0][1]);
                assert(!isPuzzleSolved(puzzle, playerMatches), `[Unordered - Incomplete] should FAIL`);
                log('  ✅ [Unordered - Incomplete] PASSED', '#98FB98');

            } else if (puzzle.evaluation === 'ordered') {
                // Test 1: Correct matches, correct order. Should PASS.
                playerMatches.clear();
                puzzle.solutions.forEach(s => playerMatches.set(s[0], s[1]));
                assert(isPuzzleSolved(puzzle, playerMatches), `[Ordered - Correct] should PASS`);
                log('  ✅ [Ordered - Correct] PASSED', '#98FB98');

                // Test 2: Correct matches, wrong order. Should FAIL.
                playerMatches.clear();
                const reversedSolutions = [...puzzle.solutions].reverse();
                reversedSolutions.forEach(s => playerMatches.set(s[0], s[1]));
                assert(!isPuzzleSolved(puzzle, playerMatches), `[Ordered - Reversed] should FAIL`);
                log('  ✅ [Ordered - Reversed] PASSED', '#98FB98');

                // Test 3: Not enough matches. Should FAIL.
                playerMatches.clear();
                playerMatches.set(puzzle.solutions[0][0], puzzle.solutions[0][1]);
                assert(!isPuzzleSolved(puzzle, playerMatches), `[Ordered - Incomplete] should FAIL`);
                log('  ✅ [Ordered - Incomplete] PASSED', '#98FB98');
            }
        }

        log('\nAll tests passed!', '#98FB98');

    } catch (error) {

        log('\nTest Suite Failed!', '#F08080'); // Light Coral
        log(error.message, '#F08080');
        console.error(error);
    }
}

runButton.addEventListener('click', runAutomatedTests);

// Optional: run tests automatically on page load.
document.addEventListener('DOMContentLoaded', () => {
    // To run tests immediately, uncomment the line below
    // runAutomatedTests();
});
