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
            statuses: { ...this.statuses },
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

        this.chatbotHasFoundCulprit = save.chatbotHasFoundCulprit === true;
    }
}

//Singleton creation :
const progressionInstance = new Progression();
export default progressionInstance;
