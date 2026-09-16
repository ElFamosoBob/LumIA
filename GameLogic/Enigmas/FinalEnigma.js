import { Enigma } from './Enigma.js';
import { ENIGMA_IDS } from '../../Utils/Constant.js';

import { showConfirmAlert } from '../../UI/AlertManager.js';

const MAX_TRIES = 2;
const SECONDS_BETWEEN_TRIES = 5;

// The picture the players read the code from
const VISUAL_PATH = "assets/pictures/visuel_final.png";

const CORRECT_CODE = "157-086-066-146";

/**
 * Only the digits matter : the players can type the separators they want, or none at all.
 */
const keepOnlyDigits = (code) => code.replace(/\D/g, "");

/**
 * The players read a code on the picture and type it here. Two tries only,
 * with a few seconds of lockout between them.
 */
export class FinalEnigma extends Enigma {

    constructor(context) {
        super(context, ENIGMA_IDS.FINAL, "Énigme finale");

        this.correctCode = keepOnlyDigits(CORRECT_CODE);
        this.triesLeft = MAX_TRIES;
        this.hasStarted = false; // the loop must not be launched twice

        this.panel = this.ui.panelManager.panelFinal;
    }

    start() {
        super.start();

        if (this.hasStarted) return;
        this.hasStarted = true;

        this.panel.showVisual(VISUAL_PATH);
        this.runEnigma();
    }

    /**
     * Nothing to poll : the enigma waits for the player instead of being driven by the GameEngine loop.
     */
    update() { }

    async runEnigma() {
        this.panel.setInputEnabled(true);
        this.panel.showTriesLeft(this.triesLeft);

        while (this.triesLeft > 0) {
            const code = await this.panel.waitUserCode();

            // On fait confirmer le code avant de compter la tentative : une erreur de lecture sur
            // l'adresse IP ne doit pas coûter l'une des deux seules chances de l'équipe.
            const confirmed = await showConfirmAlert(
                `Vous êtes sur le point de valider l'adresse IP "${code}". Vérifiez qu'elle correspond bien, vous n'avez le droit qu'à 2 essais.`
            );
            if (!confirmed) continue;

            this.triesLeft--;

            if (keepOnlyDigits(code) === this.correctCode) {
                this.panel.showTriesLeft(this.triesLeft);
                this.panel.showSuccess();
                this.panel.setInputEnabled(false);
                this.onSuccess();
                return;
            }

            this.panel.showTriesLeft(this.triesLeft);

            if (this.triesLeft > 0) {
                this.panel.setInputEnabled(false);
                await this.panel.runCountdown(SECONDS_BETWEEN_TRIES);
                this.panel.setInputEnabled(true);
            }
        }

        this.panel.setInputEnabled(false);
    }
}
