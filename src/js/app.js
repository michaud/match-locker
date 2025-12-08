// Gemini: Don't remove, just hide lead-in for now
//import { initLeadInScreen } from './leadin-screen.js';
import { createSwiper } from './swiper.js';
import { processGameData, buildWorldMap, isPuzzleSolved } from './puzzle-logic.js';
import { createLayoutVisualizer } from './visualiser.js';
import { createNavigationHandler } from './navigation-handler.js';
import { createMatchVisualizer } from './match-visualizer.js';
import { createDragAndTapHandler } from './drag-and-tap-handler.js';
import { createDragHandler } from './drag.js';

const start = () => {

    const GAME_SLIDE_WIDTH = 960;
    const GAME_SLIDE_HEIGHT = 680;
    const GAME_CLONE_COUNT = 10;

    const GAME_MENU_SLIDE_WIDTH = 240;
    const GAME_MENU_SLIDE_HEIGHT = 160;
    const GAME_MENU_CLONE_COUNT = 10;

    let menuDragHandler = null;
    let gameDragAndTapHandler = null;
    let navigationHandler = null;

    const DisplayStyle = Object.freeze({
        BLOCK: 'block',
        FLEX: 'flex',
        GRID: 'grid',
        NONE: 'none'
    });

    const leadInScreen = document.querySelector('.leadin-screen'); 
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
        puzzleData: [],
        gameState: null,
        layout: {},
        slideGroups: [],
        worldMap: new Map(),
        swiperInstances: new Map()
    };

    const screenDisplayMap = new Map([
        [leadInScreen, DisplayStyle.BLOCK],
        [startScreen, DisplayStyle.GRID],
        [gameScreen, DisplayStyle.BLOCK],
        [settingsScreen, DisplayStyle.FLEX],
        [infoScreen, DisplayStyle.BLOCK]
    ]);

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

        const currentSlot = game.layout.puzzle_slots.find(slot =>
            slot.host_group_id === game.playerState.currentSwiperId &&
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

        if (!game.playerState || !game.playerState.currentSwiperId) return;

        const currentKey = `${game.playerState.currentSwiperId}-${game.playerState.currentIndex}`;
        const currentNode = game.worldMap.get(currentKey);

        if (!currentNode) return;

        const hostSwiper = game.swiperInstances.get(game.playerState.currentSwiperId);
        const guestInfo = currentNode.guest;
        const guestSwiper = guestInfo ? game.swiperInstances.get(guestInfo.swiperId) : null;

        // Set visibility for ALL sliders.
        game.swiperInstances.forEach(swiper => {
            // A swiper is visible only if it is the current host or the current guest.
            const isVisible = (swiper === hostSwiper) || (swiper === guestSwiper);
            swiper.getElement().classList.toggle('visually-hidden', !isVisible);
        });
    };

    const snapSwipersToState = (animate = false, game = activeGame, oldPlayerState = null) => {
        if (!game.playerState || !game.playerState.currentSwiperId) return;

        // Snap swipers that are part of the *new* active context
        const currentKey = `${game.playerState.currentSwiperId}-${game.playerState.currentIndex}`;
        const currentNode = game.worldMap.get(currentKey);

        if (!currentNode) return;
        const hostSwiper = game.swiperInstances.get(game.playerState.currentSwiperId);
        hostSwiper.snapTo(game.playerState.currentIndex, !animate, { source: animate ? 'jump' : 'initialization' });

        const guestInfo = currentNode.guest;
        const guestSwiper = guestInfo ? game.swiperInstances.get(guestInfo.swiperId) : null;

        if (guestSwiper && guestInfo)
        {
            guestSwiper.snapTo(guestInfo.index, !animate, { source: animate ? 'jump' : 'initialization' });
        }

        // If this was a jump, check if we left a puzzle slot and need to clean up the old swipers.
        if (oldPlayerState)
        {
            const oldKey = `${oldPlayerState.currentSwiperId}-${oldPlayerState.currentIndex}`;
            const oldNode = game.worldMap.get(oldKey);

            if (oldNode && oldNode.guest)
            {
                const oldGuestSwiper = game.swiperInstances.get(oldNode.guest.swiperId);
                const oldHostSwiper = game.swiperInstances.get(oldPlayerState.currentSwiperId);

                // If the old guest is not part of the new context, snap it back to its puzzle alignment.
                if (oldGuestSwiper && oldGuestSwiper !== hostSwiper && oldGuestSwiper !== guestSwiper) {

                    oldGuestSwiper.snapTo(oldNode.guest.index, !animate, { source: animate ? 'jump' : 'initialization' });
                }
                // If the old host is not part of the new context, snap it back to its puzzle alignment.
                if (oldHostSwiper && oldHostSwiper !== hostSwiper && oldHostSwiper !== guestSwiper) {
                    oldHostSwiper.snapTo(oldPlayerState.currentIndex, !animate, { source: animate ? 'jump' : 'initialization' });
                }
            }
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
     * The single source of truth for updating player state and triggering the corresponding UI updates.
     * This replaces the monolithic `renderFromState` function.
     * @param {object} options
     * @param {string} options.currentSwiperId - The new swiper ID.
     * @param {number} options.currentIndex - The new index on the slider.
     * @param {boolean} [options.isJump=false] - True if this is a jump between sliders, requiring a full re-render.
     */
    const updateStateAndRender = ({ currentSwiperId, currentIndex, isJump = false }) => {
        // Determine if the new location is a puzzle slot.
        const newLocationIsPuzzleSlot = !!activeGame.layout.puzzle_slots.find(slot =>
            slot.host_group_id === currentSwiperId &&
            slot.at_index === currentIndex
        );

        // A navigation event that lands on a puzzle slot should be treated as a jump
        // to ensure visibility and state are fully re-evaluated.
        const shouldJump = isJump || newLocationIsPuzzleSlot;

        // Store the old state before updating, but only if it's a jump.
        const oldPlayerState = shouldJump ? { ...activeGame.playerState } : null;

        // Update the pure state.
        activeGame.playerState.currentSwiperId = currentSwiperId;
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
    const teardownCurrentGame = () => {
    
        // 2. Remove all swiper-related DOM elements from the game screen.
        const swiperContainers = gameScreen.querySelectorAll('.swiper');
        swiperContainers.forEach(container => container.remove());
    
        // 3. Reset the activeGame state object to its initial, empty state.
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
    function createSwipersFromLayout(newGame, onSnapComplete) {
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
                    listItem.classList.add('slide');
                    listItem.innerHTML = `<img src="${slide.img}" alt="${slide.name}" />`;
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
                    };
    
                    const swiper = createSwiper(swiperOptions);
    
                    if (!swiper) {
                        console.error(`Failed to create swiper for #${listId}.`);
                        failedSwipers++;
                    } else {
                        swiper.on('snapComplete', onSnapComplete);
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

    const onGameSwiperSnapComplete = (event) => {

        const { source, swiperId, index } = event;

        // Ignore snaps that happen during the initial setup of the game.
        if (source === 'initialization' || source === 'jump') return;

        if (source === 'navigation') {
            // A programmatic navigation (prev/next button) happened.
            // We need to update the central state to reflect the new position.
            updateStateAndRender({ currentSwiperId: swiperId, currentIndex: index, isJump: true });
        } else if (source === 'drag') {
            // A user drag finished. The swiper is visually in the right place,
            // but we need to synchronize the match visuals based on the new slide alignment.
            // The central state doesn't change here, as a swipe doesn't change the "active" puzzle slot.
            matchVisualizer.synchronizeVisuals();
        }
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
            await createSwipersFromLayout(newGame, onGameSwiperSnapComplete);
        } catch (e) {
            console.error("Game initialization failed:", e.message);
            return null; // Indicate that game initialization failed
        }

        // Stop any pointer events that start on the nav from bubbling to the gameScreen
        puzzleNav.addEventListener('pointerdown', (event) => {
            // Prevent the pointerdown from being treated as a drag-start or tap-to-match
            // by the gameScreen listener.
            event.stopPropagation();
            event.preventDefault();
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
                const button = document.createElement('div');
                button.className = 'game-button';
                button.dataset.gameFile = game.file;

                button.innerHTML = `
                    <div class="title">${game.title}</div>
                    <div class="game-description">
                        <div class="action-buttons">
                            <button class="button--action info">info</button>
                            <button class="button--action play">play</button>
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

            const menuSwiper = createSwiper({
                listSelector: '.game-menu ol',
                direction: 'horizontal',
                id: 'game-menu-swiper',
                slideWidth: GAME_MENU_SLIDE_WIDTH,
                slideHeight: GAME_MENU_SLIDE_HEIGHT,
                cloneCount: GAME_MENU_CLONE_COUNT,
                throwMultiplier: 0.85,
            });

            const onMenuTap = async (event) => { // This is the onTapCallback
                // This callback is only executed by drag.js if no drag occurred (it was a tap).
                const playButton = event.target.closest('.button--action.play');

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

            const menuDragHandler = createDragHandler(
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
            activeGame.playerState.currentSwiperId = slot.host_group_id;
            activeGame.playerState.currentIndex = slot.at_index;

            // Re-render the game from the new state. This will handle updating swiper visibility and position.
            updateStateAndRender({ currentSwiperId: slot.host_group_id, currentIndex: slot.at_index, isJump: true });
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
    // Gemini: Don't remove, just hide lead-in for now
    // let activeScreen = leadInScreen;
    let activeScreen = startScreen;
    let previousScreen = null;

    const screenStateMachine = {
        currentState: null,
        states: {
            start: {
                onEnter: () => {
                    startScreen.style.display = screenDisplayMap.get(startScreen);
                    topNav.style.display = DisplayStyle.GRID;
                    puzzleNav.style.display = DisplayStyle.NONE;
                    if (menuDragHandler) menuDragHandler.attach();
                },
                onExit: () => {
                    startScreen.style.display = DisplayStyle.NONE;
                    if (menuDragHandler) menuDragHandler.detach();
                },
            },
            game: {
                onEnter: () => {
                    gameScreen.style.display = screenDisplayMap.get(gameScreen);
                    topNav.style.display = DisplayStyle.GRID;
                    puzzleNav.style.display = DisplayStyle.GRID;
                    if (gameDragAndTapHandler) gameDragAndTapHandler.attach();
                    if (navigationHandler) navigationHandler.attach();
                },
                onExit: () => {
                    gameScreen.style.display = DisplayStyle.NONE;
                    if (gameDragAndTapHandler) gameDragAndTapHandler.detach();
                    if (navigationHandler) navigationHandler.detach();
                },
            },
            settings: {
                onEnter: () => {
                    settingsScreen.style.display = screenDisplayMap.get(settingsScreen);
                    topNav.style.display = DisplayStyle.GRID;
                    puzzleNav.style.display = DisplayStyle.NONE;
                },
                onExit: () => {
                    settingsScreen.style.display = DisplayStyle.NONE;
                },
            },
            info: {
                onEnter: () => {
                    infoScreen.style.display = screenDisplayMap.get(infoScreen);
                    topNav.style.display = DisplayStyle.GRID;
                    puzzleNav.style.display = DisplayStyle.NONE;
                },
                onExit: () => {
                    infoScreen.style.display = DisplayStyle.NONE;
                },
            },
        },
        transitionTo(newState) {
            if (this.currentState && this.states[this.currentState] && this.states[this.currentState].onExit) {
                this.states[this.currentState].onExit();
            }
            this.currentState = newState;
            if (this.states[this.currentState] && this.states[this.currentState].onEnter) {
                this.states[this.currentState].onEnter();
            }
        },
    };

    menuButton.addEventListener('click', () => {

        const isVisible = menuPopout.style.display === 'flex';
        menuPopout.style.display = isVisible ? 'none' : 'flex';

        // Default all buttons to hidden, then show them based on the current state.
        submitButton.style.display = 'none';
        quitGameButton.style.display = 'none';
        settingsButton.style.display = 'none';
        backButton.style.display = 'none';

        if (screenStateMachine.currentState === 'start') {

            settingsButton.style.display = 'grid';

        } else if (screenStateMachine.currentState === 'game') {

            quitGameButton.style.display = 'block';
            settingsButton.style.display = 'block';
            // Show submit button only if the setting is correct and there's at least one match
            if (settingsState.puzzleCompletion === 'user-submits' && getActivePuzzleForCurrentLocation() && (activeGame.gameState.playerMatchesByPuzzle.get(getActivePuzzleForCurrentLocation().id)?.size || 0) > 0) {

                submitButton.style.display = 'block';
            }

        } else if (screenStateMachine.currentState === 'settings') {

            backButton.style.display = 'block';

        } else if (screenStateMachine.currentState === 'info') {

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

    infoButton.addEventListener('click', () => {

        menuPopout.style.display = 'none';
        
        if (screenStateMachine.currentState === 'info') {
            // If we are already on the info screen, go back.
            // The most logical "back" is to the game if active, otherwise start.
            const targetState = activeGame.playerState ? 'game' : 'start';
            screenStateMachine.transitionTo(targetState);
        } else {
            // Otherwise, render and navigate to the info screen.
            renderInfoScreen();
            screenStateMachine.transitionTo('info');
        }
    });

    backButton.addEventListener('click', () => {

        menuPopout.style.display = 'none';
        
        // 'back' from settings/info should return to the game if a game is active, otherwise to start.
        if (screenStateMachine.currentState === 'settings' || screenStateMachine.currentState === 'info') {
            const targetState = activeGame.playerState ? 'game' : 'start';
            screenStateMachine.transitionTo(targetState);
        }
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
    navigationHandler = createNavigationHandler({
        getGame: () => activeGame,
        domElements: { prevButton, nextButton, upButton, downButton },
        onStateUpdate: (newState) => {
            updateStateAndRender({ ...newState, isJump: true });
        },
    });
    gameDragAndTapHandler = createDragAndTapHandler({
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

    // Initialize the lead-in screen after all other setup is complete and just before showing it.
    // Gemini: Don't remove, just hide lead-in for now
    //initLeadInScreen(leadInScreen, () => navigateTo(startScreen));

    // Set initial state
    // Gemini: Don't remove, just hide lead-in for now
    // startScreen.style.display = 'none';
    // leadInScreen.style.display = 'block';
    leadInScreen.style.display = 'none';
    gameScreen.style.display = 'none';
    settingsScreen.style.display = 'none';
    infoScreen.style.display = 'none';

    // --- Screen and Menu Navigation Logic ---
    previousScreen = startScreen;

    // Initialize the start screen and its handlers, then enter the initial state.
    initializeStartScreen().then(() => {
        screenStateMachine.transitionTo('start');
    });
}

document.addEventListener('DOMContentLoaded', () => {

    start();
});
