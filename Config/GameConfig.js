/**
 * The content of the game : what can be changed from one session to the next without touching any
 * logic (you could change a location unlockable for example).
 *
 * The true/false card enigma has its own file, Config/ArucoBoard.js, since it also describes the
 * physical board.
 */

/**
 * The physical object the team earns, named by the place where it is hidden in the building.
 *
 *   V_... : earned by solving an enigma on the website
 *   R_... : earned by solving an enigma in the room ; the team then types a code into the terminal
 *           (see UI/TerminalManager.js), which can unlock an enigma, reveal an object, or both
 */
export const IRL_REWARDS = {
    R_AFTER_DATE: "BUREAU",
    V_AFTER_COLORS: "TABLEAU",
    V_AFTER_ARUCO: "PORTE",
    V_AFTER_LSF: "TOILETTES",
    V_AFTER_GUILTY: "FENETRE",
    R_AFTER_MOVIES: "COULOIR"
};

// How long the right letters must stay detected to solve the LSF enigma. Shared by the enigma (the
// rule) and its panel (the progress bar and the length of the crescendo), so the two stay in step.
export const LSF_HOLD_MS = 870;

/**
 * The ten suspects of the investigation.
 * The order matters : the culprit is always the FIRST name of the list, and the enigmas
 * (chatbot, guilty) rely on the index of each suspect to describe them.
 */
export const SUSPECTS = ["Elise", "Oliver", "Michael", "Ines", "Theo", "Juliette", "Charlotte", "Antoine", "Maureen", "Ryan"];
