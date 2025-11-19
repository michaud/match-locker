import { createSwiper } from './swiper.js';
import { processGameData, buildWorldMap, isPuzzleSolved } from './puzzle-logic.js';
import { createLayoutVisualizer } from './visualiser.js';
import { createNavigationHandler } from './navigation-handler.js';
import { createMatchVisualizer } from './match-visualizer.js';
import { createDragAndTapHandler } from './drag-and-tap-handler.js';

const start = () => {

    const mainScreen = document.querySelector('.screen');
    const startScreen = mainScreen.querySelector('.start-screen');
    const gameScreen = mainScreen.querySelector('.game-screen');
    const settingsScreen = mainScreen.querySelector('.settings-screen');
    const infoScreen = mainScreen.querySelector('.info-screen');

    const gameMenu = startScreen.querySelector('.game-menu ol');
    const topNav = mainScreen.querySelector('.sub-nav.game');
    const puzzleNav = gameScreen.querySelector('.sub-nav.puzzle');
    const prevButton = puzzleNav.querySelector('.button-left');
    const nextButton = puzzleNav.querySelector('.button-right');
    const puzzleStatusIndicator = gameScreen.querySelector('.puzzle-status-indicator');
    const upButton = puzzleNav.querySelector('.button-up');
    const downButton = puzzleNav.querySelector('.button-down');

    // Menu Popout Elements
    const menuButton = document.querySelector('.menu-button');
    const menuPopout = document.querySelector('.menu-popout');
    const submitButton = menuPopout.querySelector('#button-submit');
    const settingsButton = menuPopout.querySelector('#button-settings');
    const backButton = menuPopout.querySelector('#button-back');
    const quitGameButton = menuPopout.querySelector('#button-quit');
    const infoButton = topNav.querySelector('#info-button');
    const infoPuzzleSection = infoScreen.querySelector('.info-puzzle');

    // Toaster elements
    const toaster = document.querySelector('.toaster');
    const toasterBackButton = document.querySelector('.toaster-back-button');

    // --- App Settings ---
    const puzzleCompletionSelect = document.getElementById('puzzle-completion');
    const showSlideNamesCheckbox = document.getElementById('show-slide-names');
    const matchVisualizationSelect = document.getElementById('match-visualization-strategy');
    const settingsState = {
        puzzleCompletion: puzzleCompletionSelect.value, // Initialize with default
        showSlideNames: showSlideNamesCheckbox.checked,
        matchVisualization: matchVisualizationSelect.value,
        showSlideNames: showSlideNamesCheckbox.checked
    };

    // Encapsulate all game-related state into a single object.
    // This object will be replaced entirely when a new game is loaded.
    let activeGame = {
        playerState: null,
        gameState: null,
        puzzleData: [],
        layout: {},
        slideGroups: [],
        worldMap: new Map(),
        swiperInstances: new Map()
    };

    const showWinToaster = () => {
        toaster.classList.add('is-visible');
        gameScreen.classList.add('disabled'); // Disable game interaction
    };

    async function loadGame(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const gameData = await response.json();
            // Initialize the game and receive the new state, then update the activeGame.
            activeGame = initializeGame(gameData);
        } catch (error) {
            console.error("Could not load game:", error);
        }
    }

    const getActivePuzzleForCurrentLocation = (game = activeGame) => {

        if (!game.playerState) return null;

        const currentSlot = game.layout.puzzle_slots.find(slot =>
            slot.host_group_id === game.playerState.currentSliderId &&
            slot.at_index === game.playerState.currentIndex
        );

        if (!currentSlot) return null;

        return game.puzzleData.find(p => p.id === currentSlot.activates_puzzle_id) || null;
    };

    // --- Centralized Visualizer ---
    const matchVisualizer = createMatchVisualizer({
        getGame: () => activeGame,
        getActivePuzzle: getActivePuzzleForCurrentLocation,
    });

    const updateSwiperVisibility = (game = activeGame) => {

        if (!game.playerState || !game.playerState.currentSliderId) return;

        const currentKey = `${game.playerState.currentSliderId}-${game.playerState.currentIndex}`;
        const currentNode = game.worldMap.get(currentKey);

        if (!currentNode) return;

        const hostSwiper = game.swiperInstances.get(game.playerState.currentSliderId);
        const guestInfo = currentNode.guest;
        const guestSwiper = guestInfo ? game.swiperInstances.get(guestInfo.sliderId) : null;

        // Set visibility for ALL sliders.
        game.swiperInstances.forEach(swiper => {
            // A swiper is visible only if it is the current host or the current guest.
            const isVisible = (swiper === hostSwiper) || (swiper === guestSwiper);
            swiper.getElement().classList.toggle('visually-hidden', !isVisible);
        });
    };

    const snapSwipersToState = (animate = false, game = activeGame, oldPlayerState = null) => {

        if (!game.playerState || !game.playerState.currentSliderId) return;

        // Snap swipers that are part of the *new* active context
        const currentKey = `${game.playerState.currentSliderId}-${game.playerState.currentIndex}`;
        const currentNode = game.worldMap.get(currentKey);

        if (!currentNode) return;

        const hostSwiper = game.swiperInstances.get(game.playerState.currentSliderId);
        hostSwiper.snapTo(game.playerState.currentIndex, !animate);

        const guestInfo = currentNode.guest;
        const guestSwiper = guestInfo ? game.swiperInstances.get(guestInfo.sliderId) : null;
        if (guestSwiper && guestInfo) {
            guestSwiper.snapTo(guestInfo.index, !animate);
        }

        // If this was a jump, check if we left a puzzle slot and need to clean up the old swipers.
        if (oldPlayerState) {
            const oldKey = `${oldPlayerState.currentSliderId}-${oldPlayerState.currentIndex}`;
            const oldNode = game.worldMap.get(oldKey);

            if (oldNode && oldNode.guest) {
                const oldGuestSwiper = game.swiperInstances.get(oldNode.guest.sliderId);
                const oldHostSwiper = game.swiperInstances.get(oldPlayerState.currentSliderId);

                // If the old guest is not part of the new context, snap it back to its puzzle alignment.
                if (oldGuestSwiper && oldGuestSwiper !== hostSwiper && oldGuestSwiper !== guestSwiper) {
                    oldGuestSwiper.snapTo(oldNode.guest.index, !animate);
                }
                // If the old host is not part of the new context, snap it back to its puzzle alignment.
                if (oldHostSwiper && oldHostSwiper !== hostSwiper && oldHostSwiper !== guestSwiper) {
                    oldHostSwiper.snapTo(oldPlayerState.currentIndex, !animate);
                }
            }
        }
    };

    const updateNavigationControls = (game = activeGame) => {

        if (!game.playerState || !game.playerState.currentSliderId) return;

        const currentKey = `${game.playerState.currentSliderId}-${game.playerState.currentIndex}`;
        const currentNode = game.worldMap.get(currentKey);

        if (!currentNode) {

            prevButton.disabled = true;
            nextButton.disabled = true;
            upButton.disabled = true;
            downButton.disabled = true;

            return;
        }

        const guestInfo = currentNode.guest;
        const otherNodeKey = guestInfo ? `${guestInfo.sliderId}-${guestInfo.index}` : (currentNode.isConnection && (currentNode.up || currentNode.left)) ? `${(currentNode.up || currentNode.left).sliderId}-${(currentNode.up || currentNode.left).index}` : null; // prettier-ignore
        const otherNode = otherNodeKey ? game.worldMap.get(otherNodeKey) : null;

        prevButton.disabled = !(currentNode.left || (otherNode && otherNode.left));
        nextButton.disabled = !(currentNode.right || (otherNode && otherNode.right));
        upButton.disabled = !(currentNode.up || (otherNode && otherNode.up));
        downButton.disabled = !(currentNode.down || (otherNode && otherNode.down));
    };

    /**
     * The single source of truth for updating player state and triggering the corresponding UI updates.
     * This replaces the monolithic `renderFromState` function.
     * @param {object} options
     * @param {string} options.currentSliderId - The new slider ID.
     * @param {number} options.currentIndex - The new index on the slider.
     * @param {boolean} [options.isJump=false] - True if this is a jump between sliders, requiring a full re-render.
     */
    const updateStateAndRender = ({ currentSliderId, currentIndex, isJump = false }) => {
        // Determine if the new location is a puzzle slot.
        const newLocationIsPuzzleSlot = !!activeGame.layout.puzzle_slots.find(slot =>
            slot.host_group_id === currentSliderId &&
            slot.at_index === currentIndex
        );

        // A navigation event that lands on a puzzle slot should be treated as a jump
        // to ensure visibility and state are fully re-evaluated.
        const shouldJump = isJump || newLocationIsPuzzleSlot;

        // Store the old state before updating, but only if it's a jump.
        const oldPlayerState = shouldJump ? { ...activeGame.playerState } : null;

        // Update the pure state.
        activeGame.playerState.currentSliderId = currentSliderId;
        activeGame.playerState.currentIndex = currentIndex;

        if (shouldJump) {
            // A jump requires a full re-render of swiper positions and visibility.
            updateSwiperVisibility(); // Update visibility first
            snapSwipersToState(true, activeGame, oldPlayerState); // Then snap, passing old state for cleanup
            matchVisualizer.synchronizeVisuals(); // Also update matches, as the context may have changed.
        }

        // These are needed for both jumps and simple swipes/navs.
        updateNavigationControls();
        updatePuzzleStatusIndicator();
    };

    /**
     * Removes DOM elements and clears state from any previously running game.
     */
    function cleanupPreviousGame() {

        const existingSliderLists = gameScreen.querySelectorAll('ol.slider-horizontal, ol.slider-vertical');
        existingSliderLists.forEach(list => list.remove());
        activeGame.swiperInstances.clear();
        activeGame.worldMap.clear();
    }

    /**
     * Creates and initializes all swiper instances based on the game layout.
     * @param {object} newGame - The new game state object.
     * @returns {Map} A map of the created swiper instances.
     */
    function createSwipersFromLayout(newGame) {

        newGame.layout.sliders.forEach(sliderConfig => {

            const listElement = document.createElement('ol');
            const listSelector = `slider-${sliderConfig.id.replace(/[^a-zA-Z0-9-_]/g, '')}`;
            listElement.classList.add(listSelector);
            const slideGroup = newGame.slideGroups.find(g => g.group_id === sliderConfig.populates_from_group);
            listElement.classList.add('visually-hidden');

            // Add direction-specific classes immediately to ensure they are styled correctly
            // (and thus hidden by default via CSS) before being added to the DOM.
            if (sliderConfig.direction === 'horizontal') {

                listElement.classList.add('slider-horizontal');

            } else {

                listElement.classList.add('slider-vertical');
            }

            if (!slideGroup) return;

            listElement.innerHTML = slideGroup.slides.map(slide =>
                `<li data-slide-id="${slide.id}"><div class="slide"><img src="${slide.img}" draggable="false" alt="${slide.name}"/></div></li>`
            ).join('');

            gameScreen.insertBefore(listElement, puzzleNav);

            const swiper = createSwiper({
                listSelector: `.${listSelector}`,
                direction: sliderConfig.direction,
                id: sliderConfig.id,
                cloneCount: 10,
                throwMultiplier: 0.7,
            });

            // When a swiper snaps due to a navigation action, update the application state.
            // This is the correct place for this logic, as it separates navigation from visual swipes.
            swiper.on('snapComplete', (event) => {

                if (event.source === 'navigation') {
                    // A navigation click updates the application state.
                    updateStateAndRender({ currentSliderId: swiper.id, currentIndex: event.index });

                } else if (event.source === 'drag') {
                    // A drag is a purely visual action. It does not update the application state,
                    // but we must re-evaluate the match visuals based on the new slide positions.
                    matchVisualizer.synchronizeVisuals();
                }
            });

            newGame.swiperInstances.set(sliderConfig.id, swiper);
        });
    }

    const updatePuzzleStatusIndicator = (game = activeGame) => {

        const activePuzzle = getActivePuzzleForCurrentLocation(game);
        const isSolved = activePuzzle && game.gameState.solvedPuzzles.has(activePuzzle.id);

        if (puzzleStatusIndicator) {

            puzzleStatusIndicator.classList.toggle('is-visible', isSolved);
        }
    };

    const checkActivePuzzleSolved = (game = activeGame) => {

        const activePuzzle = getActivePuzzleForCurrentLocation(game);

        if (!activePuzzle || game.gameState.solvedPuzzles.has(activePuzzle.id)) {

            return; // No puzzle here, or it's already solved.
        }

        const playerMatches = game.gameState.playerMatchesByPuzzle.get(activePuzzle.id) || new Map();

        if (isPuzzleSolved(activePuzzle, playerMatches)) {

            game.gameState.solvedPuzzles.add(activePuzzle.id);
            updatePuzzleStatusIndicator(game);
        }
    };

    const checkGameWinCondition = (game = activeGame) => {

        const allPuzzles = game.puzzleData;

        if (allPuzzles.length > 0 && game.gameState.solvedPuzzles.size === allPuzzles.length) {

            showWinToaster();
        }
    };

    const clearActivePuzzleMatches = () => {

        const activePuzzle = getActivePuzzleForCurrentLocation();

        if (!activePuzzle) return;

        const puzzleMatches = activeGame.gameState.playerMatchesByPuzzle.get(activePuzzle.id);

        if (puzzleMatches) {

            puzzleMatches.clear();
        }

        // If the puzzle was marked as solved, un-solve it.
        if (activeGame.gameState.solvedPuzzles.has(activePuzzle.id)) {

            activeGame.gameState.solvedPuzzles.delete(activePuzzle.id);
        }

        // Update visuals to reflect the cleared matches and puzzle status.
        matchVisualizer.synchronizeVisuals();
        updatePuzzleStatusIndicator();

        // Re-render the info screen to update the match count display.
        renderInfoScreen();
    };

    /**
     * Processes raw game data, creates all necessary state and instances for a new game,
     * and returns it as a single encapsulated object.
     * @param {object} gameData - The raw JSON data for the game.
     * @returns {object} The complete state object for the newly initialized game.
     */
    function initializeGame(gameData) {

        cleanupPreviousGame();

        const { newPuzzleData, layout, slideGroups } = processGameData(gameData);

        const newGame = {
            playerState: {
                currentSliderId: null,
                currentIndex: 0
            },
            puzzleData: newPuzzleData,
            layout: layout,
            slideGroups: slideGroups,
            worldMap: buildWorldMap(layout, slideGroups),
            swiperInstances: new Map(),
            gameState: {
                playerMatchesByPuzzle: new Map(),
                solvedPuzzles: new Set(),
            }
        };

        // Create swipers and add them to the new game state. This function also modifies the DOM.
        createSwipersFromLayout(newGame);

        // Stop any pointer events that start on the nav from bubbling to the gameScreen
        puzzleNav.addEventListener('pointerdown', (event) => {
            // Prevent the pointerdown from being treated as a drag-start or tap-to-match
            // by the gameScreen listener.
            event.stopPropagation();
            event.preventDefault();
        });

        // Identify and set the root horizontal slider as the active one.
        const guestIds = new Set((newGame.layout.puzzle_slots || []).map(s => s.guest_slider_id));
        const rootSliderConfig = newGame.layout.sliders.find(s => s.direction === 'horizontal' && !guestIds.has(s.id));

        if (rootSliderConfig && newGame.layout.sliders.length > 0) {

            newGame.playerState.currentSliderId = rootSliderConfig.id;
            newGame.playerState.currentIndex = 0;

        } else {

            console.error("Could not find a root horizontal slider.");
            // Fallback to the first available horizontal slider if no root is found
            const firstHorizontal = newGame.layout.sliders.find(s => s.direction === 'horizontal');
            if (firstHorizontal) {

                newGame.playerState.currentSliderId = firstHorizontal.id;
                newGame.playerState.currentIndex = 0;

            } else {

                return newGame; // Return partially constructed state to avoid crashing
            }
        }

        // Perform the initial render using the targeted functions.
        // This replaces the final call to the old renderFromState.
        updateSwiperVisibility(newGame);
        snapSwipersToState(false, newGame);
        updateNavigationControls(newGame);
        updatePuzzleStatusIndicator(newGame);

        // Return the fully constructed state object for the new game.
        return newGame;
    }

    async function initializeStartScreen() {

        try {

            const response = await fetch('games/games.json');

            if (!response.ok) {

                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const games = await response.json();

            gameMenu.innerHTML = ''; // Clear static content

            games.forEach(game => {

                const li = document.createElement('li');
                const button = document.createElement('button');
                button.className = 'game-button';
                button.dataset.gameFile = game.file;

                button.innerHTML = `
                    <div class="title">${game.title}</div>
                    <div class="description">${game.description}</div>
                `;

                button.addEventListener('click', () => {
                    navigateTo(gameScreen);
                    menuPopout.style.display = 'none';
                    loadGame(game.file);
                });

                li.appendChild(button);
                gameMenu.appendChild(li);
            });

        } catch (error) {

            console.error("Could not initialize start screen:", error);
        }
    }

    const renderInfoScreen = () => {

        if (!activeGame.puzzleData || activeGame.puzzleData.length === 0 || !activeGame.layout) {

            // If no puzzle is loaded, ensure the info screen is blank.
            infoPuzzleSection.innerHTML = '';

            return;
        }

        const activePuzzle = getActivePuzzleForCurrentLocation();

        if (activePuzzle) {

            const totalMatches = activePuzzle.solutions.length;
            const playerMatchesForPuzzle = activeGame.gameState.playerMatchesByPuzzle.get(activePuzzle.id) || new Map();
            const playerMatchesCount = playerMatchesForPuzzle.size;

            infoPuzzleSection.innerHTML = `
            <div>
                <h3>${activePuzzle.puzzletitle}</h3>
                ${activePuzzle.instructions ? `<p><strong>Instructions:</strong> ${activePuzzle.instructions}` : ''}</p>
                <ul>
                    <li><strong>Type:</strong> ${activePuzzle.type} (${activePuzzle.evaluation})</li>
                    <li><strong>Matches:</strong> ${playerMatchesCount} / ${totalMatches}</li>
                </ul>
            </div>
            `;

        } else {

            infoPuzzleSection.innerHTML = `<p>Navigate to a puzzle slot to see puzzle information.</p>`;
        }



        // Add the layout visualizer
        const handleVisualizerSlotClick = (slot) => {

            // Navigate to the game screen if not already there.
            if (activeScreen !== gameScreen) {

                navigateTo(gameScreen);
            }
            // Update player context to the clicked slot.
            activeGame.playerState.currentSliderId = slot.host_group_id;
            activeGame.playerState.currentIndex = slot.at_index;

            // Re-render the game from the new state. This will handle updating swiper visibility and position.
            updateStateAndRender({ currentSliderId: slot.host_group_id, currentIndex: slot.at_index, isJump: true });
        };

        const visualizerSvg = createLayoutVisualizer(
            activeGame.layout,
            activeGame.slideGroups,
            {
                showNames: settingsState.showSlideNames,
                onSlotClick: handleVisualizerSlotClick,
                playerState: activeGame.playerState
            });

        if (visualizerSvg) {

            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'info-actions';
            const clearMatchesButton = document.createElement('button');
            clearMatchesButton.textContent = 'clear matches';
            clearMatchesButton.className = 'button--action';
            clearMatchesButton.addEventListener('click', clearActivePuzzleMatches);

            const layoutContainer = document.createElement('div');
            layoutContainer.className = 'layout-svg-container';
            layoutContainer.appendChild(visualizerSvg);
            buttonContainer.appendChild(clearMatchesButton);
            layoutContainer.appendChild(buttonContainer);
            infoPuzzleSection.appendChild(layoutContainer);
        }

    };

    // --- State-based Screen Navigation ---
    let activeScreen = startScreen;
    let previousScreen = null;

    function navigateTo(targetScreen) {

        if (activeScreen) {

            previousScreen = activeScreen;
            activeScreen.style.display = 'none';
        }

        targetScreen.style.display = targetScreen.classList.contains('settings-screen') ? 'flex' : 'block';
        activeScreen = targetScreen;

        // When navigating to the game screen, ensure the puzzle nav is visible.
        if (targetScreen === gameScreen) {

            puzzleNav.style.display = 'grid';
        }

        // The top navigation containing the menu button should always be visible.
        topNav.style.display = 'grid';
    }

    menuButton.addEventListener('click', () => {

        const isVisible = menuPopout.style.display === 'flex';
        menuPopout.style.display = isVisible ? 'none' : 'flex';

        // Default all buttons to hidden, then show them based on the current screen state.
        submitButton.style.display = 'none';
        quitGameButton.style.display = 'none';
        settingsButton.style.display = 'none';
        backButton.style.display = 'none';

        if (activeScreen === startScreen) {

            settingsButton.style.display = 'block';

        } else if (activeScreen === gameScreen) {

            quitGameButton.style.display = 'block';
            settingsButton.style.display = 'block';
            puzzleNav.style.display = 'grid';
            // Show submit button only if the setting is correct and there's at least one match
            if (settingsState.puzzleCompletion === 'user-submits' && getActivePuzzleForCurrentLocation() && (activeGame.gameState.playerMatchesByPuzzle.get(getActivePuzzleForCurrentLocation().id)?.size || 0) > 0) {

                submitButton.style.display = 'block';
            }

        } else if (activeScreen === settingsScreen) {

            backButton.style.display = 'block';

        } else if (activeScreen === infoScreen) {

            backButton.style.display = 'block';
        }
    });

    quitGameButton.addEventListener('click', () => {

        menuPopout.style.display = 'none';
        puzzleNav.style.display = 'none';

        // Clear all data associated with the game session.
        activeGame = {
            playerState: null,
            gameState: {
                playerMatchesByPuzzle: new Map(),
                solvedPuzzles: new Set()
            },
            puzzleData: [],
            layout: {},
            slideGroups: [],
            worldMap: new Map(),
            swiperInstances: new Map()
        };

        cleanupPreviousGame(); // Also remove DOM elements and swiper instances.

        navigateTo(startScreen);
    });

    submitButton.addEventListener('click', () => {

        const activePuzzle = getActivePuzzleForCurrentLocation();

        if (!activePuzzle) return;

        menuPopout.style.display = 'none';
        const playerMatchesForPuzzle = activeGame.gameState.playerMatchesByPuzzle.get(activePuzzle.id) || new Map();

        checkActivePuzzleSolved(); // First, check and mark the current puzzle as solved if it is.

        if (isPuzzleSolved(activePuzzle, playerMatchesForPuzzle)) {

            checkGameWinCondition(); // Then, check if the entire game is won.
        } else {

            // Provide feedback for an incorrect submission
            const toasterText = toaster.querySelector('p');
            const originalText = 'all matches complete!'; // Store original text
            toasterBackButton.style.display = 'none'; // Hide the back button for this message
            toasterText.textContent = 'Not quite...';
            toaster.classList.add('is-visible');

            // Hide the toaster after a short delay
            setTimeout(() => {

                toaster.classList.remove('is-visible');
                // Reset the toaster content after the transition out
                setTimeout(() => {

                    toasterText.textContent = originalText;
                    toasterBackButton.style.display = 'block';

                }, 500); // 500ms matches the CSS transition duration

            }, 1500);
        }
    });

    settingsButton.addEventListener('click', () => {

        navigateTo(settingsScreen);
        menuPopout.style.display = 'none';
    });

    infoButton.addEventListener('click', () => {

        menuPopout.style.display = 'none';

        if (activeScreen === infoScreen) {
            // If we are already on the info screen, go back.
            if (previousScreen) {

                navigateTo(previousScreen);
            }

        } else {

            // Otherwise, render and navigate to the info screen.
            renderInfoScreen();
            navigateTo(infoScreen);
        }
    });

    backButton.addEventListener('click', () => {

        menuPopout.style.display = 'none';

        // Explicitly handle back navigation to avoid stale previousScreen references.
        // This logic assumes 'back' from settings/info always returns to the game screen if a game is active.
        if (activeScreen === settingsScreen || activeScreen === infoScreen) {
            navigateTo(gameScreen);
        }
    });

    toasterBackButton.addEventListener('click', () => {

        toaster.classList.remove('is-visible');
        gameScreen.classList.remove('disabled'); // Re-enable game interaction
        puzzleNav.style.display = 'none';
        navigateTo(startScreen);
    });

    // --- Settings Logic ---
    puzzleCompletionSelect.addEventListener('change', (event) => {

        settingsState.puzzleCompletion = event.target.value;
    });

    showSlideNamesCheckbox.addEventListener('change', (event) => {

        settingsState.showSlideNames = event.target.checked;
    });

    matchVisualizationSelect.addEventListener('change', (event) => {

        settingsState.matchVisualization = event.target.value;
        matchVisualizer.setStrategy(settingsState.matchVisualization);
    });

    // --- Initialize Interaction Handlers ---
    // These are done once. The modules will internally get the latest `activeGame` state when needed.
    const navigationHandler = createNavigationHandler({
        getGame: () => activeGame,
        domElements: { prevButton, nextButton, upButton, downButton },
        onStateUpdate: (newState) => {
            updateStateAndRender({ ...newState, isJump: true });
        },
    });

    navigationHandler.attach();

    const dragAndTapHandler = createDragAndTapHandler({
        getGame: () => activeGame,
        getSettings: () => settingsState,
        checkPuzzleSolved: checkActivePuzzleSolved,
        checkGameWin: checkGameWinCondition,
        getActivePuzzle: getActivePuzzleForCurrentLocation,
        matchVisualizer: matchVisualizer,
        domElements: { gameScreen },
        // For swipes and same-slider nav, it's not a jump.
        onStateUpdate: (newState) => updateStateAndRender(newState),
    });
    // The drag handler is attached when a game is loaded, as it depends on game-specific elements.
    // For now, we will attach it here. A more advanced implementation might attach/detach per game.
    dragAndTapHandler.attach();

    // Set initial state
    startScreen.style.display = 'block';
    gameScreen.style.display = 'none';
    settingsScreen.style.display = 'none';
    infoScreen.style.display = 'none';

    // --- Screen and Menu Navigation Logic ---
    previousScreen = startScreen;

    // Start the application by initializing the start screen
    initializeStartScreen();
}

document.addEventListener('DOMContentLoaded', () => {

    start();
});
