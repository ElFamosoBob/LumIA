/**
 * The structure of the game : the ids and statuses.
 *
 * What can be changed from one session to the next — rewards, suspects, timings is in Config/GameConfig.js.
 */

export const ENIGMA_STATUS = {
    LOCKED: 'locked',
    AVAILABLE: 'available',
    RESOLVED: 'resolved'
};

export const ENIGMA_IDS = {
    LSF: 'lsf',
    COLORS: 'colors',
    ARUCO: 'aruco',
    GUILTY: 'guilty',
    FINAL: 'final'
};

export const HELP_IDS = {
    CHATBOT: 'chatbot'
};

/**
 * The screens that are not enigmas : the welcome page and the defeat screen (la victoire, elle,
 * est le panneau de victoire de l'énigme finale). They are tabs like the others, but no button in
 * the navigation bar leads to them (the welcome one is left by the big start button, the defeat
 * one opens by code when the timer hits zero).
 */
export const SCREEN_IDS = {
    WELCOME: 'welcome',
    DEFEAT: 'defeat'
};
