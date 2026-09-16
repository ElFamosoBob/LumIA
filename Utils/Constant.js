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

/**
 * Physical object the team unlock after completing a certain enigma (on the website (V) or an enigma only present physically (R))
 * So V_... means it the items are unlocked after resolving an enigma on the website, R_... means it is obtain after resolving an enigma IRL. 
 * When they do resolve an enigma IRL, they sometimes do have a code to put in TerminalManager which can unlock differents things, an enigma, a
 * location to physical objects or both.
 */
export const IRL_REWARDS = {
    R_AFTER_DATE: "BUREAU",
    V_AFTER_COLORS: "TABLEAU",
    V_AFTER_ARUCO: "PORTE",
    V_AFTER_LSF: "TOILETTES",
    V_AFTER_GUILTY: "FENETRE",
    R_AFTER_MOVIES: "COULOIR"
};

// Combien de temps les bonnes lettres doivent rester détectées pour valider l'énigme LSF.
// Partagé entre l'énigme (la règle) et le panneau (la barre et la durée du crescendo), pour qu'ils ne se désynchronisent pas.
export const LSF_HOLD_MS = 870;

/**
 * The ten suspects of the investigation.
 * The order matters : the culprit is always the FIRST name of the list, and the enigmas
 * (chatbot, guilty) rely on the index of each suspect to describe them.
 */
export const SUSPECTS = ["Elise", "Oliver", "Michael", "Ines", "Theo", "Juliette", "Charlotte", "Antoine", "Maureen", "Ryan"];
