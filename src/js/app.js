// Gemini: Don't remove, just hide lead-in for now
import { initLeadInScreen } from './leadin-screen.js';
import { createGameStateMachine } from './game-state-machine.js';
import { createSwiper } from './swiper.js';
import { processGameData, buildWorldMap, isPuzzleSolved } from './puzzle-logic.js';
import { createLayoutVisualizer } from './visualiser.js';
import { createNavigationHandler } from './navigation-handler.js';
import { createMatchVisualizer } from './match-visualizer.js';
import { createDragAndTapHandler } from './drag-and-tap-handler.js';
import { createSettingsManager } from './settings-manager.js';
import { createDragHandler } from './drag.js';
import { createScreenStateMachine } from './screen-state-machine.js';

const start = () => {

    const gamesFilePath ='games/games.json';
    const GAME_SLIDE_WIDTH = 960;
    const GAME_SLIDE_HEIGHT = 680;
    const GAME_CLONE_COUNT = 10;

    const GAME_MENU_SLIDE_WIDTH = 240;
    const GAME_MENU_SLIDE_HEIGHT = 160;
    const GAME_MENU_CLONE_COUNT = 10;

    let menuDragHandler = null;
    let gameStateMachine = null;

    const settingsManager = createSettingsManager();
    let currentSettings = settingsManager.getSettings();

    const defaultStartScreen = currentSettings.skipLeadin ? 'start' : 'leadin';
    
    const leadInScreen = document.querySelector('.leadin-screen'); 
    const mainScreen = document.querySelector('.screen');
    const startScreen = mainScreen.querySelector('.start-screen');
    const gameScreen = mainScreen.querySelector('.game-screen');
    const settingsScreen = mainScreen.querySelector('.settings-screen');
    const infoScreen = mainScreen.querySelector('.info-screen');
    const aboutScreen = mainScreen.querySelector('.about-screen');

    const gameMenu = startScreen.querySelector('.game-menu ol');
    const topNav = mainScreen.querySelector('.sub-nav.game');
    const puzzleNav = mainScreen.querySelector('.sub-nav.puzzle');
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
    const aboutButton = menuPopout.querySelector('#button-about');
    const quitGameButton = menuPopout.querySelector('#button-quit');
    const infoButton = puzzleNav.querySelector('.button-info'); 
    const infoPuzzleSection = infoScreen.querySelector('.info-puzzle');
    const infoContentSection = infoScreen.querySelector('.info-content');

    // Toaster elements
    const toaster = document.querySelector('.toaster');
    const toasterBackButton = document.querySelector('.toaster-back-button');
    const skipLeadinSettingsCheckbox = document.getElementById('no-leadin');

    // --- App Settings ---
    const puzzleCompletionSelect = document.getElementById('puzzle-completion');
    const showSlideNamesCheckbox = document.getElementById('show-slide-names');
    const matchVisualizationSelect = document.getElementById('match-visualization-strategy');
    const showPuzzleMatchCountCheckbox = document.getElementById('show-puzzle-match-count');
    const showMatchCountCheckbox = document.getElementById('show-match-count');
    const showMatchCorrectCountCheckbox = document.getElementById('show-match-correct-count');
    const showInGameNavCheckbox = document.getElementById('show-in-game-nav');
    
    // Sync UI elements with loaded/default settings
    puzzleCompletionSelect.value = currentSettings.puzzleCompletion;
    showSlideNamesCheckbox.checked = currentSettings.showSlideNames;
    matchVisualizationSelect.value = currentSettings.matchVisualization;
    showPuzzleMatchCountCheckbox.checked = currentSettings.showPuzzleMatchCount !== false;
    showMatchCountCheckbox.checked = currentSettings.showMatchCount !== false;
    showMatchCorrectCountCheckbox.checked = currentSettings.showMatchCorrectCount || false;
    if (showInGameNavCheckbox) showInGameNavCheckbox.checked = currentSettings.showInGameNav;

    // --- Centralized Visualizer Instance ---
    let layoutVisualizerInstance = null;

    // Encapsulate all game-related state into a single object.
    // This object will be replaced entirely when a new game is loaded.
    let activeGame = {
        playerState: null,
        puzzleData: [],
        gameState: null,
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
            const initializedGame = await initializeGame(gameData);

            if (initializedGame) {

                activeGame = initializedGame;

            } else {

                console.error("Game could not be loaded due to initialization errors.");
                // Optionally, show a user-facing error or navigate back to the start screen.
            }
        } catch (error) {

            console.error("Could not load game:", error);
        }
    }

    const getActivePuzzleForCurrentLocation = (game = activeGame) => {

        if (!game.playerState) return null;

        const { currentSwiperId, currentIndex } = game.playerState;

        const currentSlot = game.layout.puzzle_slots.find(slot => 
            (slot.host_group_id === currentSwiperId && slot.at_index === currentIndex) ||
            (slot.guest_group_id === currentSwiperId && (slot.guest_align_index || 0) === currentIndex)
        );

        if (!currentSlot) return null;

        return game.puzzleData.find(p => p.id === currentSlot.activates_puzzle_id) || null;
    };

    // --- Centralized Visualizer ---
    const matchVisualizer = createMatchVisualizer({
        getGame: () => activeGame,
        getActivePuzzle: getActivePuzzleForCurrentLocation,
    });

    // Set the initial strategy from loaded settings
    matchVisualizer.setStrategy(currentSettings.matchVisualization);

    const updateSwiperVisibility = (game = activeGame) => {

        if (!game.playerState) return;

        let visibleSwipers = new Set();
        const activePuzzle = getActivePuzzleForCurrentLocation(game);

        if (activePuzzle) {
            // If we are at a puzzle, find the host and guest from the puzzle slot data.
            const { currentSwiperId, currentIndex } = game.playerState;
            const currentSlot = game.layout.puzzle_slots.find(slot => 
                (slot.host_group_id === currentSwiperId && slot.at_index === currentIndex) ||
                (slot.guest_group_id === currentSwiperId && (slot.guest_align_index || 0) === currentIndex)
            );

            if (currentSlot) {
                if (game.swiperInstances.has(currentSlot.host_group_id)) {
                    visibleSwipers.add(game.swiperInstances.get(currentSlot.host_group_id));
                }
                if (game.swiperInstances.has(currentSlot.guest_group_id)) {
                    visibleSwipers.add(game.swiperInstances.get(currentSlot.guest_group_id));
                }
            }
        } else {
            // If not at a puzzle, only the current swiper is visible.
            if (game.swiperInstances.has(game.playerState.currentSwiperId)) {
                visibleSwipers.add(game.swiperInstances.get(game.playerState.currentSwiperId));
            }
        }

        // Set visibility for ALL sliders.
        game.swiperInstances.forEach(swiper => {
            const isVisible = visibleSwipers.has(swiper);
            swiper.getElement().classList.toggle('visually-hidden', !isVisible);
        });
    };

    const snapSwipersToState = (animate = false, game = activeGame, onComplete = null) => {
        if (!game.playerState || !game.playerState.currentSwiperId) {
            if (onComplete) onComplete();
            return;
        }

        // Snap swipers that are part of the *new* active context
        const currentKey = `${game.playerState.currentSwiperId}-${game.playerState.currentIndex}`;
        const currentNode = game.worldMap.get(currentKey);
        if (!currentNode) {
            if (onComplete) onComplete();
            return;
        }

        const hostSwiper = game.swiperInstances.get(game.playerState.currentSwiperId);
        const guestInfo = currentNode.guest;
        const guestSwiper = guestInfo ? game.swiperInstances.get(guestInfo.swiperId) : null;

        if (!animate) {
            if (hostSwiper) hostSwiper.snapTo(game.playerState.currentIndex, true);
            if (guestSwiper && guestInfo) guestSwiper.snapTo(guestInfo.index, true);
            if (onComplete) onComplete();
            return;
        }

        const activeAnimations = new Set();

        const handleSnap = (animationId) => {
            activeAnimations.delete(animationId);
            if (activeAnimations.size === 0 && onComplete) {
                onComplete();
            }
        };

        if (hostSwiper && hostSwiper.getVisualIndex() !== game.playerState.currentIndex) {
            const animationId = hostSwiper.snapTo(game.playerState.currentIndex, false, { onComplete: handleSnap });
            if (animationId) activeAnimations.add(animationId);
        }
        if (guestSwiper && guestInfo && guestSwiper.getVisualIndex() !== guestInfo.index) {
            const animationId = guestSwiper.snapTo(guestInfo.index, false, { onComplete: handleSnap });
            if (animationId) activeAnimations.add(animationId);
        }

        // If no animations were started, call onComplete immediately.
        if (activeAnimations.size === 0 && onComplete) {
            onComplete();
        }
    };

    const updateNavigationControls = (game = activeGame) => {

        if (!game.playerState || !game.playerState.currentSwiperId) return;

        const currentKey = `${game.playerState.currentSwiperId}-${game.playerState.currentIndex}`;
        const currentNode = game.worldMap.get(currentKey);

        if (!currentNode) {

            prevButton.disabled = true;
            nextButton.disabled = true;
            upButton.disabled = true;
            downButton.disabled = true;

            return;
        }

        prevButton.disabled = !currentNode.left;
        nextButton.disabled = !currentNode.right;
        upButton.disabled = !currentNode.up;
        downButton.disabled = !currentNode.down;
    };

    /**
     * Removes DOM elements and clears state from any previously running game.
     */
    const teardownCurrentGame = () => {

        // 1. Destroy the state machine to detach its listeners.
        if (gameStateMachine) {
            gameStateMachine.destroy();
            gameStateMachine = null;
        }
    
        // 2. Remove all swiper-related DOM elements from the game screen.
        const swiperContainers = gameScreen.querySelectorAll('.swiper');
        swiperContainers.forEach(container => container.remove());
    
        // 3. Destroy the visualizer instance and clear its DOM.
        layoutVisualizerInstance = null;
        const oldSvg = infoContentSection.querySelector('.layout-svg');
        if (oldSvg) oldSvg.remove();
        infoPuzzleSection.innerHTML = '';

        // 4. Reset the activeGame state object to its initial, empty state.
        activeGame = {
            playerState: null,
            puzzleData: [],
            gameState: null,
            layout: {},
            slideGroups: [],
            worldMap: new Map(),
            swiperInstances: new Map()
        };
    };

    /**
     * Creates and initializes all swiper instances based on the game layout.
     * @param {object} newGame - The new game state object.
     * @returns {Map} A map of the created swiper instances.
     */
    function createSwipersFromLayout(newGame) {
        return new Promise((resolve, reject) => {
            const sliderConfigs = newGame.layout.sliders;
            if (!sliderConfigs || sliderConfigs.length === 0) {
                resolve();
                return;
            }
    
            let swipersToCreate = sliderConfigs.length;
            let failedSwipers = 0;
    
            sliderConfigs.forEach(sliderConfig => {
                // --- NEW STRUCTURE ---
                // 1. Create the dedicated viewport container for this swiper.
                const swiperContainer = document.createElement('div');
                swiperContainer.classList.add('swiper');
                swiperContainer.dataset.groupId = sliderConfig.id;
    
                // 2. Create the list element.
                const listElement = document.createElement('ol');
                const listId = `swiper-list-${sliderConfig.id.replace(/[^a-zA-Z0-9-_]/g, '')}`;
                listElement.id = listId;
    
                const slideGroup = newGame.slideGroups.find(g => g.group_id === sliderConfig.populates_from_group);
    
                if (!slideGroup) {
                    console.warn(`Slide group not found for slider config: ${sliderConfig.id}`);
                    swipersToCreate--;
                    if (swipersToCreate === 0) resolve(); // Continue even if one is missing
                    return;
                }
    
                // 3. Populate the list with slides.
                slideGroup.slides.forEach((slide, index) => {
                    const listItem = document.createElement('li');
                    listItem.dataset.slideId = slide.id;
                    listItem.dataset.index = index;
                    listItem.setAttribute('draggable', 'false');
                    listItem.classList.add('slide');
                    listItem.innerHTML = `<img draggable="false" src="${slide.img}" alt="${slide.name}" />`;
                    listElement.appendChild(listItem);
                });
    
                // 4. Place the list inside its viewport container.
                swiperContainer.appendChild(listElement);
    
                // 5. Add the entire swiper unit to the game screen.
                gameScreen.appendChild(swiperContainer);
    
                // Apply layout classes to the swiper container, NOT the list.
                swiperContainer.classList.add(sliderConfig.direction === 'horizontal' ? 'slider-horizontal' : 'slider-vertical');
                swiperContainer.classList.add('visually-hidden'); // All swipers are hidden initially.
    
                requestAnimationFrame(() => {
                    const swiperOptions = {
                        listSelector: `#${listId}`,
                        direction: sliderConfig.direction,
                        id: sliderConfig.id,
                        slideWidth: sliderConfig.direction === 'horizontal' ? GAME_SLIDE_WIDTH : null,
                        slideHeight: sliderConfig.direction === 'vertical' ? GAME_SLIDE_HEIGHT : null,
                        viewportMatchesSlide: true,
                        cloneCount: GAME_CLONE_COUNT,
                        dragFactor: 0.6, // Slower movement during drag
                    };
    
                    const swiper = createSwiper(swiperOptions);
    
                    if (!swiper) {
                        console.error(`Failed to create swiper for #${listId}.`);
                        failedSwipers++;
                    } else {
                        newGame.swiperInstances.set(sliderConfig.id, swiper);
                    }
    
                    swipersToCreate--;
                    if (swipersToCreate === 0) {
                        if (failedSwipers > 0) reject(new Error("Some swipers failed to initialize."));
                        else resolve();
                    }
                });
            });
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
    async function initializeGame(gameData) {

        teardownCurrentGame();

        const { newPuzzleData, layout, slideGroups } = processGameData(gameData);

        const newGame = {
            playerState: {
                currentSwiperId: null,
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
        try {
            await createSwipersFromLayout(newGame);
        } catch (e) {
            console.error("Game initialization failed:", e.message);
            return null; // Indicate that game initialization failed
        }

        // Create interaction handlers here, AFTER the game state is processed.
        const navigationHandler = createNavigationHandler({
            getGame: () => newGame,
            domElements: { prevButton, nextButton, upButton, downButton },
        });

        const gameDragAndTapHandler = createDragAndTapHandler({
            getGame: () => newGame,
            matchVisualizer: matchVisualizer,
            domElements: { gameScreen },
            // The onTap callback is now provided by the state machine's config
            // to ensure proper decoupling.
            onTap: () => { if (gameStateMachine) gameStateMachine.handleTap(); }
        });

        // Create the game state machine, passing in all necessary callbacks and instances.
        // Note: We pass a function to get the game state (`() => newGame`) so the machine
        // always has access to the correct, current game object.
        gameStateMachine = createGameStateMachine({
            getGame: () => newGame,
            updateSwiperVisibility: () => updateSwiperVisibility(newGame),
            snapSwipersToState,
            updateNavigationControls: () => updateNavigationControls(newGame),
            onNavigationComplete: () => {
                // This is the correct place to re-render the info screen,
                // as it's called after all navigation/swipe animations are complete.
                if (screenStateMachine.currentScreenState === 'info') {
                    renderInfoScreen();
                }
            },
            updatePuzzleStatusIndicator: () => updatePuzzleStatusIndicator(newGame),
            getActivePuzzle: () => getActivePuzzleForCurrentLocation(newGame),
            getSettings: () => settingsManager.getSettings(),
            checkPuzzleSolved: () => checkActivePuzzleSolved(newGame),
            checkGameWin: () => checkGameWinCondition(newGame),
            matchVisualizer: matchVisualizer,
            domElements: { prevButton, nextButton, upButton, downButton, gameScreen },
            interactionHandlers: { gameDragAndTapHandler, navigationHandler }
        });


        // Stop any pointer events that start on the nav from bubbling to the gameScreen
        puzzleNav.addEventListener('pointerdown', (event) => {
            // Prevent the pointerdown from being treated as a drag-start or tap-to-match
            event.stopPropagation();
        });

        // Identify and set the root horizontal slider as the active one.
        const guestIds = new Set((newGame.layout.puzzle_slots || []).map(s => s.guest_group_id));
        const rootSliderConfig = newGame.layout.sliders.find(s => s.direction === 'horizontal' && !guestIds.has(s.id));

        if (rootSliderConfig && newGame.layout.sliders.length > 0) {

            newGame.playerState.currentSwiperId = rootSliderConfig.id;
            newGame.playerState.currentIndex = 0;

        } else {

            console.error("Could not find a root horizontal slider.");
            // Fallback to the first available horizontal slider if no root is found
            const firstHorizontal = newGame.layout.sliders.find(s => s.direction === 'horizontal');
            if (firstHorizontal) {
                newGame.playerState.currentSwiperId = firstHorizontal.id;
                newGame.playerState.currentIndex = 0;

            } else {

                return newGame; // Return partially constructed state to avoid crashing
            }
        }

        // Start the state machine, which will transition to the correct initial state.
        gameStateMachine.start();

        // Return the fully constructed state object for the new game.
        return newGame;
    }

    const renderInfoScreen = () => {

        if (!activeGame.puzzleData || activeGame.puzzleData.length === 0 || !activeGame.layout) {

            // If no puzzle is loaded, ensure the info screen is blank.
            infoPuzzleSection.innerHTML = '';

        // Also clear the content section to remove any old SVG
        const oldSvg = infoContentSection.querySelector('.layout-svg');
        if (oldSvg) oldSvg.remove();

        // If we clear the game, we must also destroy the visualizer instance
        // so it can be recreated with the new game's data.
        if (layoutVisualizerInstance) {
            layoutVisualizerInstance = null;
        }

            return;
        }
        const activePuzzle = getActivePuzzleForCurrentLocation();

        if (activePuzzle) {

            const settings = settingsManager.getSettings();
            const totalMatches = activePuzzle.solutions.length;
            const playerMatchesForPuzzle = activeGame.gameState.playerMatchesByPuzzle.get(activePuzzle.id) || new Map();
            const playerMatchesCount = playerMatchesForPuzzle.size;

            let correctMatchesCount = 0;
            if (settings.showMatchCorrectCount && activePuzzle.solutions && playerMatchesForPuzzle.size > 0) {
                for (const pMatch of playerMatchesForPuzzle.values()) {
                    const pSet = new Set(pMatch);
                    for (const sol of activePuzzle.solutions) {
                        const sSet = new Set(sol);
                        if (pSet.size === sSet.size) {
                            let match = true;
                            for (const id of pSet) {
                                if (!sSet.has(id)) {
                                    match = false;
                                    break;
                                }
                            }
                            if (match) {
                                correctMatchesCount++;
                                break;
                            }
                        }
                    }
                }
            }

            const parts = [];
            const labels = [];

            if (settings.showMatchCorrectCount) {
                parts.push(correctMatchesCount);
                labels.push('correct');
            }
            if (settings.showMatchCount !== false) {
                parts.push(playerMatchesCount);
                labels.push('matched');
            }
            if (settings.showPuzzleMatchCount !== false) {
                parts.push(totalMatches);
                labels.push('matches');
            }
            infoPuzzleSection.innerHTML = `
                <div class="info-panel matches">
                    <table class="match-info-table">
                        <tr>${labels.map(label => `<td class="match-info-labels">${label}</td>`).join(' ')}</tr>
                        <tr>${parts.map(part => `<td class="match-info-counts">${part}</td>` ).join(' ')}</tr>
                    </table>
                </div>
                <div class="info-panel description">
                    <h3>${activePuzzle.puzzletitle}</h3>
                    <p><strong>Type:</strong> ${activePuzzle.type} (${activePuzzle.evaluation})</p>
                    ${activePuzzle.instructions ? `<p><strong>Instructions:</strong> ${activePuzzle.instructions}` : ''}</p>
                </div>
            `;

        } else {

            infoPuzzleSection.innerHTML = `<div class="info-panel description"><h3>Nice slide</h3><p>no puzzle</p></div>`;
        }

        // Add the layout visualizer
        const handleVisualizerSlotClick = (slot) => {
            // Navigate to the game screen if not already there.
            if (screenStateMachine.currentScreenState !== 'game') {
                screenStateMachine.transitionTo('game');
            }

            // Create a destination object for the state machine.
            const destination = {
                swiperId: slot.host_group_id,
                index: slot.at_index, // Corrected from 'slideIndex'
                source: 'visualizer-jump'
            };

            // Tell the game state machine to handle the transition.
            if (gameStateMachine) {
                gameStateMachine.transitionTo('NAVIGATING', { destination });
            }
        };

        // Initialize the visualizer if it doesn't exist for the current game.
        if (!layoutVisualizerInstance) {
            // Specifically remove any old SVG, but leave other content (like the puzzle description) intact.
            const oldSvg = infoContentSection.querySelector('.layout-svg');
            if (oldSvg) {
                oldSvg.remove();
            }
            layoutVisualizerInstance = createLayoutVisualizer(infoContentSection, {
                showNames: currentSettings.showSlideNames,
                onSlotClick: handleVisualizerSlotClick,
            });
        }

        if (layoutVisualizerInstance) {
            // Update the existing visualizer instance with the current state.
            layoutVisualizerInstance.update(activeGame.layout, activeGame.slideGroups, activeGame.playerState, {
                showNames: currentSettings.showSlideNames,
                onSlotClick: handleVisualizerSlotClick
            });

            if (activePuzzle) {
                const clearMatchesButton = document.createElement('button');
                clearMatchesButton.textContent = 'clear matches';
                clearMatchesButton.className = 'button--action';
                clearMatchesButton.addEventListener('click', clearActivePuzzleMatches);
                const matchesPanel = infoPuzzleSection.querySelector('.info-panel.matches');
                if (matchesPanel) {
                    matchesPanel.appendChild(clearMatchesButton);
                }
            }
        }
    };

    // --- State-based Screen Navigation ---

    const screenStateMachine = createScreenStateMachine({
        domElements: {
            leadInScreen,
            startScreen,
            gameScreen,
            settingsScreen,
            infoScreen,
            aboutScreen,
            topNav,
            puzzleNav,
            skipLeadinSettingsCheckbox,
            prevButton,
            nextButton,
            upButton,
            downButton
        },
        callbacks: {
            initLeadInScreen,
            getMenuDragHandler: () => menuDragHandler,
            settingsManager,
            renderInfoScreen
        },
    });

    menuButton.addEventListener('click', () => {

        const isVisible = menuPopout.style.display === 'flex';
        menuPopout.style.display = isVisible ? 'none' : 'flex';

        // Default all buttons to hidden, then show them based on the current state.
        backButton.style.display = 'none';
        quitGameButton.style.display = 'none';
        submitButton.style.display = 'none';

        if (screenStateMachine.currentScreenState === 'game') {

            quitGameButton.style.display = 'block';

            // Show submit button only if the setting is correct and there's at least one match
            if (currentSettings.puzzleCompletion === 'user-submits' && getActivePuzzleForCurrentLocation() && (activeGame.gameState.playerMatchesByPuzzle.get(getActivePuzzleForCurrentLocation().id)?.size || 0) > 0) {

                submitButton.style.display = 'block';
            }

        } else if (screenStateMachine.currentScreenState === 'info') {

            quitGameButton.style.display = 'block';
        
        } else if (screenStateMachine.currentScreenState === 'settings' || screenStateMachine.currentScreenState === 'about') {

            backButton.style.display = 'block';
        }
    });

    quitGameButton.addEventListener('click', () => {

        menuPopout.style.display = 'none';

        // Completely tear down the current game session.
        teardownCurrentGame();

        screenStateMachine.transitionTo('start');
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

        screenStateMachine.transitionTo('settings');
        menuPopout.style.display = 'none';
    });

    aboutButton.addEventListener('click', () => {

        screenStateMachine.transitionTo('about');
        menuPopout.style.display = 'none';
    });

    infoButton.addEventListener('click', () => {

        if (screenStateMachine.currentScreenState === 'info') {
            // If we are already on the info screen, go back.
            // The most logical "back" is to the game if active, otherwise start.
            const targetState = activeGame.playerState ? 'game' : 'start';
            screenStateMachine.transitionTo(targetState);
        } else {
            screenStateMachine.transitionTo('info');
        }

        // Also ensure the main menu popout is closed when toggling info.
        menuPopout.style.display = 'none';
    });

    const handleBackButton = () => {
        menuPopout.style.display = 'none';
        // 'back' from settings/info/about should return to the game if a game is active, otherwise to start.
        const targetState = activeGame.playerState ? 'game' : 'start';
        screenStateMachine.transitionTo(targetState);
    };

    // Add listeners for all back buttons
    mainScreen.querySelectorAll('.back-button').forEach(button => {
        button.addEventListener('click', handleBackButton);
    });

    backButton.addEventListener('click', () => {
        // This is the back button in the popout menu
        handleBackButton();
    });

    toasterBackButton.addEventListener('click', () => {

        toaster.classList.remove('is-visible');
        gameScreen.classList.remove('disabled'); // Re-enable game interaction
        // When leaving the win screen, the game is over.
        teardownCurrentGame();
        screenStateMachine.transitionTo('start');
    });

    // --- Settings Logic ---
    puzzleCompletionSelect.addEventListener('change', (event) => {
        settingsManager.updateSetting('puzzleCompletion', event.target.value);
    });

    showSlideNamesCheckbox.addEventListener('change', (event) => {
        settingsManager.updateSetting('showSlideNames', event.target.checked);
        // If we are on the info screen, re-render it to show/hide slide names
        if (screenStateMachine.currentScreenState === 'info') {
            renderInfoScreen();
        }
    });

    if (showPuzzleMatchCountCheckbox) {
        showPuzzleMatchCountCheckbox.addEventListener('change', (event) => {
            settingsManager.updateSetting('showPuzzleMatchCount', event.target.checked);
            currentSettings = settingsManager.getSettings();
            if (screenStateMachine.currentScreenState === 'info') renderInfoScreen();
        });
    }

    if (showMatchCountCheckbox) {
        showMatchCountCheckbox.addEventListener('change', (event) => {
            settingsManager.updateSetting('showMatchCount', event.target.checked);
            currentSettings = settingsManager.getSettings();
            if (screenStateMachine.currentScreenState === 'info') renderInfoScreen();
        });
    }

    if (showMatchCorrectCountCheckbox) {
        showMatchCorrectCountCheckbox.addEventListener('change', (event) => {
            settingsManager.updateSetting('showMatchCorrectCount', event.target.checked);
            currentSettings = settingsManager.getSettings();
            if (screenStateMachine.currentScreenState === 'info') renderInfoScreen();
        });
    }

    if (showInGameNavCheckbox) {
        showInGameNavCheckbox.addEventListener('change', (event) => {
            settingsManager.updateSetting('showInGameNav', event.target.checked);
        });
    }

    matchVisualizationSelect.addEventListener('change', (event) => {
        const newStrategy = event.target.value;
        settingsManager.updateSetting('matchVisualization', newStrategy);
        matchVisualizer.setStrategy(newStrategy);
        // Immediately update the visuals to reflect the new strategy
        // This is necessary if the user changes the setting while at a puzzle.
        matchVisualizer.synchronizeVisuals();
    });

    skipLeadinSettingsCheckbox.addEventListener('change', (event) => {
        const shouldSkip = event.target.checked;
        settingsManager.updateSetting('skipLeadin', shouldSkip);
        // Changing this setting implies they've seen the lead-in.
        settingsManager.updateSetting('hasVisited', true);
    });

    // Set initial state
    leadInScreen.style.display = 'none';
    startScreen.style.display = 'none';
    gameScreen.style.display = 'none';
    settingsScreen.style.display = 'none';
    infoScreen.style.display = 'none';
    aboutScreen.style.display = 'none';

    async function initializeStartScreen() {

        try {

            const response = await fetch(gamesFilePath);

            if (!response.ok) {

                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const games = await response.json();

            gameMenu.innerHTML = ''; // Clear static content

            games.forEach(game => {

                const li = document.createElement('li');
                const button = document.createElement('div');
                button.className = 'game-button';
                button.dataset.gameFile = game.file;

                button.innerHTML = `
                    <div class="title">${game.title}</div>
                    <div class="game-description">
                        <div class="action-buttons">
                            <button class="button--action info">info</button>
                            <button class="button--action play">
                                <svg width="35" version="1.1" viewBox="0 0 23.918 12.641" xmlns="http://www.w3.org/2000/svg">
                                    <path d="m2.7079 10.765q-0.48261 0-0.50942-0.63006 0-0.63007 0.50942-0.63007h1.354q0.49601 0 0.69709-0.28151 0.21449-0.28152 0.21449-0.60325v-3.7804q0-0.33514-0.21449-0.61666-0.20108-0.29492-0.71049-0.26811h-2.5739v8.0568q0 0.63006-0.73731 0.63006t-0.73731-0.64346v-8.5126q0-0.4692 0.24131-0.63006 0.2413-0.16087 0.58984-0.16087h3.472q0.34855 0 0.69709 0.12065 0.36195 0.12065 0.73731 0.33514 0.32174 0.2279 0.50941 0.64347 0.20109 0.40217 0.20109 0.9518v3.968q0 1.0993-0.7105 1.5685-0.75071 0.4826-1.4344 0.4826zm6.5155-0.52282q0 0.63007-0.73731 0.63007-0.75071 0-0.75071-0.63007v-9.6118q0-0.63007 0.75071-0.63007 0.73731 0 0.73731 0.63007zm3.4456 0.52282q-0.41558 0-0.79093-0.10724-0.37536-0.12065-0.72391-0.33514v0.0134q-0.65687-0.41557-0.65687-1.5282v-0.65687q0-0.54963 0.18768-0.9518 0.20108-0.41557 0.54963-0.65687h-0.01341q0.33514-0.2279 0.7105-0.33514 0.37536-0.12065 0.7239-0.12065h2.9626v-1.2467q0-0.33514-0.21449-0.60326-0.20108-0.28151-0.69709-0.28151h-1.5685q-0.50941 0-0.71049 0.2547-0.18768 0.2413-0.18768 0.57644v0.10725q0 0.69709-0.75072 0.69709-0.75071 0-0.75071-0.69709v-0.12065q0-0.54963 0.18768-0.92499 0.20108-0.37536 0.53622-0.63006h-0.0134q0.34854-0.2279 0.7239-0.37536 0.38876-0.14746 0.73731-0.14746h2.0376q0.33514 0 0.7105 0.14746 0.38876 0.14746 0.7239 0.37536h-0.01341q0.34855 0.2547 0.53623 0.67028 0.18768 0.40217 0.18768 0.93839v5.3756q0 0.64346-0.73731 0.64346-0.14746 0-0.28152-0.0134-0.12065-0.01341-0.2279-0.06703-0.09383-0.06703-0.16086-0.17427-0.05363-0.12065-0.05363-0.30833l-0.0134-2.9358h-2.7079q-0.29493 0-0.45579 0.06703-0.16087 0.06703-0.25471 0.21449-0.10724 0.2279-0.16087 0.36195-0.04021 0.12065-0.04021 0.28152v0.52282q0 0.34854 0.20108 0.53622 0.21449 0.17427 0.7239 0.17427h1.5014q0.49601 0 0.49601 0.63007 0 0.26811-0.12065 0.45579-0.12065 0.17427-0.37536 0.17427zm6.1535 1.8768q-0.4692 0-0.49601-0.63006 0-0.63006 0.49601-0.63006h0.58985q0.46919 0 0.61665-0.28152l0.18768-0.49601 0.06703-0.21449-2.6141-6.8503v0.01341q-0.10725-0.32174 0.04021-0.54963 0.16087-0.2279 0.48261-0.33514 0.2413-0.06703 0.38876-0.06703 0.38876 0 0.4826 0.45579l1.059 2.6409 0.89818 2.1985 1.4344-4.8126q0.12065-0.4826 0.56303-0.4826 0.10725 0 0.34855 0.06703 0.32173 0.09384 0.45579 0.30833 0.14746 0.21449 0.06703 0.50941-0.60326 2.0511-1.2333 4.1289-0.61666 2.0779-1.2199 4.1155-0.06703 0.14747-0.21449 0.29493-0.13405 0.16086-0.36195 0.29492-0.22789 0.14746-0.56303 0.2279-0.33514 0.09383-0.77753 0.09383z" style="fill:#fff"/>
                                </svg>
                            </button>
                        </div>
                        <div class="description">
                            <p>${game.description}</p>
                        </div>
                    </div>
                `;

                li.appendChild(button);
                gameMenu.appendChild(li);
            });

            const gameMenuContainer = startScreen.querySelector('.game-menu');

            const cleanInfoPanel = () => {

                const allDescriptionPanels = gameMenuContainer.querySelectorAll('.game-description .description');
                allDescriptionPanels.forEach(panel => panel.classList.remove('show'));
            };

            const menuSwiper = createSwiper({
                listSelector: '.game-menu ol',
                direction: 'horizontal',
                id: 'game-menu-swiper',
                slideWidth: GAME_MENU_SLIDE_WIDTH,
                slideHeight: GAME_MENU_SLIDE_HEIGHT,
                cloneCount: GAME_MENU_CLONE_COUNT,
                throwMultiplier: 0.85,
            });

            const onMenuTap = async (event) => {

                const playButton = event.target.closest('.button--action.play');
                const infoButton = event.target.closest('.button--action.info');

                if (infoButton) {

                    const gameDescriptionPanel = infoButton.closest('.game-description');
                    const descriptionElement = gameDescriptionPanel.querySelector('.description');
                    const wasVisible = descriptionElement.classList.contains('show');

                    cleanInfoPanel();
                    if (!wasVisible) {
                        descriptionElement.classList.add('show');
                    }
                }

                if (playButton) {
                    // Find the parent .game-button to get the data-game-file attribute.
                    const gameButton = playButton.closest('.game-button');
                    if (gameButton && gameButton.dataset.gameFile && !playButton.disabled) {
                        const gameFile = gameButton.dataset.gameFile;
                        playButton.disabled = true;
                        await loadGame(gameFile);
                        screenStateMachine.transitionTo('game');
                        // Re-enable after a short delay to prevent double-clicks during screen transition
                        setTimeout(() => { playButton.disabled = false; }, 500);
                    }
                }
            };

            const onMenuDragStart = (dragSwiper) => {
                // This function is called by drag.js when a drag gesture is confirmed.
                // We use it to set up a one-time listener for when the eventual snap completes.
                const handleSnap = () => {

                    gameMenuContainer.style.cursor = 'grab';
                    gameMenuContainer.classList.remove('is-dragging');
                    // Clean up the listener to prevent it from firing again.
                    dragSwiper.off('snapComplete', handleSnap);
                };

                dragSwiper.on('snapComplete', handleSnap);
            };

            menuDragHandler = createDragHandler(
                gameMenuContainer,
                () => ({ hostSwiper: menuSwiper, guestSwiper: null }), // Only this swiper is draggable
                onMenuTap,
                onMenuDragStart
            );

            menuDragHandler.attach();

            gameMenuContainer.addEventListener('pointerdown', () => {

                gameMenuContainer.style.cursor = 'grabbing';
            });

        } catch (error) {

            console.error("Could not initialize start screen:", error);
        }
    }

    // Initialize the start screen and its handlers, then enter the initial state.
    initializeStartScreen().then(() => {

        screenStateMachine.transitionTo(defaultStartScreen);
    });
}

document.addEventListener('DOMContentLoaded', () => {

    start();
});
