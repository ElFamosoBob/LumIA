import { Enigma } from './Enigma.js';
import { ENIGMA_IDS, IRL_REWARDS, LSF_HOLD_MS } from '../../Utils/Constant.js';


// Au-delà de cet écart entre deux frames, on considère qu'on a cessé de regarder (onglet quitté)
// et on repart de zéro plutôt que de compter tout le temps écoulé comme du maintien.
const MAX_GAP_MS = 500;

export class LsfEnigma extends Enigma {
    constructor(context) {

        super(context, ENIGMA_IDS.LSF, "Enigme LSF", [], IRL_REWARDS.V_AFTER_LSF); //this id (ENIGMA_IDS.LSF) is the same in UIManager, it is attached to the tab AND the Enigma

        // Les 4 lettres qui doivent être vues en même temps
        this.lettresRequises = ["P", "L", "A", "N"];

        this.panel = this.ui.panelManager.panelLsf;

        this.holdStartTime = null; // début du maintien en cours, null si les lettres ne sont pas toutes là
        this.lastCheckTime = null;
    }

    update() {
        this.input.update(this.id); //update the sign detected
        const playerState = this.input.getState(); //get the list of signs detected
        this.checkCondition(playerState); //check if we have all the letter required

        this.panel.updateGestureDebugText(playerState.gestures); //we update the box with the letters detected
    }

    // Le GameEngine appelle cette fonction 15 fois par seconde
    checkCondition(playerState) {
        if (this.isResolved) return;

        const actualGestures = playerState.gestures;

        // if we don't see enough hands to form the word it is not useful to look further
        const toutesPresentes = actualGestures.length >= this.lettresRequises.length
            && this.lettresRequises.every(lettre => actualGestures.includes(lettre));

        if (!toutesPresentes) {
            this.cancelHold();
            return;
        }

        const now = Date.now();

        // Reprise après une interruption (onglet quitté) : le maintien doit être continu, on recommence
        if (this.lastCheckTime !== null && now - this.lastCheckTime > MAX_GAP_MS) {
            this.holdStartTime = null;
        }
        this.lastCheckTime = now;

        if (this.holdStartTime === null) this.holdStartTime = now;

        const elapsed = now - this.holdStartTime;
        this.panel.updateHoldProgress(elapsed / LSF_HOLD_MS);

        if (elapsed >= LSF_HOLD_MS) {
            this.cancelHold(); //coupe le crescendo, la fanfare de déverrouillage prend le relais
            this.onSuccess();
        }
    }

    cancelHold() {
        this.holdStartTime = null;
        this.lastCheckTime = null;
        this.panel.updateHoldProgress(0);
    }
}
