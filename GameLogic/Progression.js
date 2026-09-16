import { ENIGMA_STATUS, ENIGMA_IDS, HELP_IDS } from '../Utils/Constant.js';

/**
 * Everything a team can unlock during a game, in the order the chain normally opens them.
 * The screens that are not unlockable (the welcome page, the defeat screen) are NOT here : they
 * are shown by code, they are never part of what the team has earned.
 */
const UNLOCKABLE_IDS = [
    ENIGMA_IDS.ARUCO,
    ENIGMA_IDS.LSF,
    ENIGMA_IDS.COLORS,
    HELP_IDS.CHATBOT,
    ENIGMA_IDS.GUILTY,
    ENIGMA_IDS.FINAL
];

/**
 * How far a team has got : the one and only place that answers "is this enigma locked, available
 * or resolved ?".
 *
 * ── The three statuses (ENIGMA_STATUS, in Utils/Constant.js) ────────────────────
 *
 *   LOCKED     the team does not know it exists : no button in the navigation bar.
 *              Where every enigma starts, except Aruco which is opened by start().
 *
 *   AVAILABLE  earned and still to be solved : orange button, normal panel, and the enigma
 *              runs in the GameEngine active pool whenever its tab is the one on screen (active).
 *
 *   RESOLVED   done : green button, victory panel instead of the normal one, and the enigma
 *              is out of the active pool of the GameEngine. For the three camera enigmas this is also
 *              what hides the webcam, since there is nothing left to film.
 *
 * The only path is LOCKED → AVAILABLE → RESOLVED, and it never goes back : unlock() refuses to
 * touch anything already unlocked, and nothing ever returns a status to LOCKED. A game starts
 * over by reset(), not by walking statuses backwards.
 */
export class Progression {

    constructor() {
        this.reset();
    }

    reset() {
        this.statuses = {};
        for (const id of UNLOCKABLE_IDS) this.statuses[id] = ENIGMA_STATUS.LOCKED;

        // First of the two conditions that unlock the accusation, the other being the LSF enigma.
        this.chatbotHasFoundCulprit = false;
    }

    // ── Reading ─────────────────────────────────────────────────────────────────

    statusOf(id) {
        return this.statuses[id] ?? ENIGMA_STATUS.LOCKED;
    }

    isLocked(id) {
        return this.statusOf(id) === ENIGMA_STATUS.LOCKED;
    }

    isResolved(id) {
        return this.statusOf(id) === ENIGMA_STATUS.RESOLVED;
    }

    /**
     * Everything the team has already earned, resolved or not. Used when a reloaded page has to
     * be put back the way the team left it.
     * @returns {Array<string>}
     */
    unlockedIds() {
        return UNLOCKABLE_IDS.filter(id => !this.isLocked(id));
    }

    // ── Writing ─────────────────────────────────────────────────────────────────

    /**
     * Only the status is written here : showing the tab and starting the logic is GameEngine.activate().
     *
     * @returns {boolean} true only if it really was locked, so the caller can tell an actual
     *          unlocking from a second call that changes nothing
     */
    unlock(id) {
        if (!this.isLocked(id)) return false;

        this.statuses[id] = ENIGMA_STATUS.AVAILABLE;
        return true;
    }

    markResolved(id) {
        this.statuses[id] = ENIGMA_STATUS.RESOLVED;
    }

    markChatbotFoundCulprit() {
        this.chatbotHasFoundCulprit = true;
    }

    // ── The rules of the chain ──────────────────────────────────────────────────

    /**
     * The accusation needs TWO conditions : the LSF enigma resolved AND the chatbot having named
     * a single culprit. They can happen in either order, which is why this is asked again every
     * time one of them becomes true.
     */
    shouldUnlockGuilty() {
        return this.isLocked(ENIGMA_IDS.GUILTY)
            && this.chatbotHasFoundCulprit
            && this.isResolved(ENIGMA_IDS.LSF);
    }

    /**
     * The final enigma is the last link of the chain : solving it ends the game.
     */
    isGameWon() {
        return this.isResolved(ENIGMA_IDS.FINAL);
    }

    // ── Saving and restoring ────────────────────────────────────────────────────

    /**
     * @param {number|null} timerStartTime - owned by the Timer, carried here so that the whole
     *        save is built in one place
     */
    toSave(timerStartTime) {
        return {
            statuses: { ...this.statuses }, //... does a copy, by security we use this instead of a the real object
            timerStartTime,
            chatbotHasFoundCulprit: this.chatbotHasFoundCulprit
        };
    }

    /**
     * Puts back what toSave() wrote. Unknown ids are ignored : a save written before an enigma
     * was renamed must not be able to create a status nothing will ever read.
     * @param {object} save
     */
    restore(save) {
        this.reset();

        for (const id of UNLOCKABLE_IDS) {
            const status = save.statuses?.[id];
            if (status) this.statuses[id] = status;
        }

        //=== does a copy, by security we use this
        this.chatbotHasFoundCulprit = save.chatbotHasFoundCulprit === true;
    }
}

//Singleton creation :
const progressionInstance = new Progression();
export default progressionInstance;
