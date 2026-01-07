export function createScreenStateMachine({ domElements, callbacks }) {
    const {
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
    } = domElements;

    const {
        initLeadInScreen,
        getMenuDragHandler,
        settingsManager,
        renderInfoScreen
    } = callbacks;

    const DisplayStyle = Object.freeze({
        BLOCK: 'block',
        FLEX: 'flex',
        GRID: 'grid',
        NONE: 'none'
    });

    const screenDisplayMap = new Map([
        [leadInScreen, DisplayStyle.BLOCK],
        [startScreen, DisplayStyle.GRID],
        [gameScreen, DisplayStyle.BLOCK],
        [settingsScreen, DisplayStyle.GRID],
        [infoScreen, DisplayStyle.GRID],
        [aboutScreen, DisplayStyle.FLEX]
    ]);

    let currentScreenState = null;

    const setNavButtonsVisibility = (visible) => {
        const display = visible ? '' : DisplayStyle.NONE;
        if (prevButton) prevButton.style.display = display;
        if (nextButton) nextButton.style.display = display;
        if (upButton) upButton.style.display = display;
        if (downButton) downButton.style.display = display;
    };

    const states = {
        leadin: {
            onEnter: () => {
                leadInScreen.style.display = screenDisplayMap.get(leadInScreen);
                topNav.style.display = DisplayStyle.NONE; // No nav on lead-in
                puzzleNav.style.display = DisplayStyle.NONE;
                initLeadInScreen(leadInScreen, () => transitionTo('start'), settingsManager);
            },
            onExit: () => {
                leadInScreen.style.display = DisplayStyle.NONE;
            },
        },
        start: {
            onEnter: () => {
                startScreen.style.display = screenDisplayMap.get(startScreen);
                topNav.style.display = DisplayStyle.GRID;
                puzzleNav.style.display = DisplayStyle.NONE;
                const menuDragHandler = getMenuDragHandler();
                if (menuDragHandler) menuDragHandler.attach();
            },
            onExit: () => {
                startScreen.style.display = DisplayStyle.NONE;
                const menuDragHandler = getMenuDragHandler();
                if (menuDragHandler) menuDragHandler.detach();
            },
        },
        game: {
            onEnter: () => {
                gameScreen.style.display = screenDisplayMap.get(gameScreen);
                // Restore visibility and interactivity when returning to the game screen.
                gameScreen.style.opacity = '1';
                gameScreen.style.pointerEvents = 'auto';
                topNav.style.display = DisplayStyle.GRID;
                puzzleNav.style.display = DisplayStyle.GRID;

                const showNav = settingsManager.getSettings().showInGameNav;
                setNavButtonsVisibility(showNav);
            },
            onExit: (nextState) => {
                if (nextState === 'info') {
                    // When going to the info screen, keep the game screen in the DOM
                    // so its animations can complete, but make it invisible and non-interactive.
                    gameScreen.style.opacity = '0';
                    gameScreen.style.pointerEvents = 'none';
                } else {
                    // For any other transition, hide it completely.
                    gameScreen.style.display = DisplayStyle.NONE;
                }
                // Hide puzzle nav when leaving game screen unless going to info
                if (nextState !== 'info') puzzleNav.style.display = DisplayStyle.NONE;
            },
        },
        settings: {
            onEnter: () => {
                settingsScreen.style.display = screenDisplayMap.get(settingsScreen);
                topNav.style.display = DisplayStyle.GRID;
                puzzleNav.style.display = DisplayStyle.NONE;
                // Sync the checkbox with the current setting when the screen is shown
                skipLeadinSettingsCheckbox.checked = settingsManager.getSettings().skipLeadin;
            },
            onExit: () => {
                settingsScreen.style.display = DisplayStyle.NONE;
            },
        },
        info: {
            onEnter: () => {
                infoScreen.style.display = screenDisplayMap.get(infoScreen);
                renderInfoScreen();
                // Ensure the game screen is not interactive when info is on top.
                gameScreen.style.opacity = '0';
                gameScreen.style.pointerEvents = 'none';

                topNav.style.display = DisplayStyle.GRID;
                puzzleNav.style.display = DisplayStyle.GRID;
                setNavButtonsVisibility(true);
            },
            onExit: (nextState) => {
                infoScreen.style.display = DisplayStyle.NONE;
                // Hide puzzle nav when leaving info screen unless going to game
                if (nextState !== 'game') puzzleNav.style.display = DisplayStyle.NONE;
            },
        },
        about: {
            onEnter: () => {
                aboutScreen.style.display = screenDisplayMap.get(aboutScreen);
                topNav.style.display = DisplayStyle.GRID;
                puzzleNav.style.display = DisplayStyle.NONE;
            },
            onExit: () => {
                aboutScreen.style.display = DisplayStyle.NONE;
            },
        },
    };

    function transitionTo(newState, payload) {
        if (currentScreenState && states[currentScreenState] && states[currentScreenState].onExit) {
            states[currentScreenState].onExit(newState);
        }
        currentScreenState = newState;
        if (states[currentScreenState] && states[currentScreenState].onEnter) {
            states[currentScreenState].onEnter();
        }
    }

    return {
        transitionTo,
        get currentScreenState() { return currentScreenState; }
    };
}
