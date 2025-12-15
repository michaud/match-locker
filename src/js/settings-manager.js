const SETTINGS_KEYS = {
    GAME_SETTINGS: 'match-locker-game-settings',
    SKIP_LEADIN: 'match-locker-skip-leadin',
    HAS_VISITED: 'match-locker-has-visited',
};

const defaultSettings = {
    // Game settings
    puzzleCompletion: 'game-finishes',
    showSlideNames: false,
    matchVisualization: 'fade-on-drag',
    // App settings
    skipLeadin: false,
    hasVisited: false,
};

let settingsState = {};
const listeners = new Map();

function loadSettings() {
    const loadedGameSettings = JSON.parse(localStorage.getItem(SETTINGS_KEYS.GAME_SETTINGS)) || {};
    const skipLeadin = localStorage.getItem(SETTINGS_KEYS.SKIP_LEADIN) === 'true';
    const hasVisited = localStorage.getItem(SETTINGS_KEYS.HAS_VISITED) === 'true';

    settingsState = {
        ...defaultSettings,
        ...loadedGameSettings,
        skipLeadin,
        hasVisited,
    };
}

function saveSettings() {
    // Persist app-specific settings
    localStorage.setItem(SETTINGS_KEYS.SKIP_LEADIN, settingsState.skipLeadin);
    localStorage.setItem(SETTINGS_KEYS.HAS_VISITED, settingsState.hasVisited);

    // Persist game-specific settings as a single object
    const gameSettings = {
        puzzleCompletion: settingsState.puzzleCompletion,
        showSlideNames: settingsState.showSlideNames,
        matchVisualization: settingsState.matchVisualization,
    };
    localStorage.setItem(SETTINGS_KEYS.GAME_SETTINGS, JSON.stringify(gameSettings));
}

function emit(eventName, payload) {
    if (listeners.has(eventName)) {
        listeners.get(eventName).forEach(callback => callback(payload));
    }
}

/**
 * Creates a centralized manager for all application settings.
 * Handles loading from and saving to localStorage.
 */
export function createSettingsManager() {
    loadSettings();

    return {
        /**
         * @returns A copy of the current settings state.
         */
        getSettings() {
            return { ...settingsState }; // Return a copy to prevent direct mutation
        },
        /**
         * Updates a setting's value and persists it.
         * @param {string} key The setting key to update.
         * @param {*} value The new value for the setting.
         */
        updateSetting(key, value) {
            if (Object.prototype.hasOwnProperty.call(settingsState, key)) {
                settingsState[key] = value;
                saveSettings();
                emit('change', { key, value, newState: { ...settingsState } });
            } else {
                console.warn(`SettingsManager: Attempted to update unknown setting '${key}'`);
            }
        },
        on(eventName, callback) {
            if (!listeners.has(eventName)) listeners.set(eventName, []);
            listeners.get(eventName).push(callback);
        },
        off(eventName, callback) {
            if (listeners.has(eventName)) {
                const eventListeners = listeners.get(eventName);
                const index = eventListeners.indexOf(callback);
                if (index > -1) eventListeners.splice(index, 1);
            }
        },
    };
}
