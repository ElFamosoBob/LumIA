import { Enigma } from './Enigma.js';
import { ENIGMA_IDS, CURRENT_TEAM } from '../../Utils/Constant.js';

import { showConfirmAlert } from '../../UI/AlertManager.js';

const MAX_TRIES = 2;
const SECONDS_BETWEEN_TRIES = 5;

const VISUAL_FOLDER = "Utils/Pictures/FinalEnigma";

const CODE_BY_TEAM = {
    A: "157-086-066-146",
    B: "168-055-147-097",
    C: "193-027-119-082",
    D: "165-211-073-091",
    E: "189-067-225-137",
    F: "141-147-088-026"
};

/**
 * Only the digits matter : the players can type the separators they want, or none at all.
 */
const keepOnlyDigits = (code) => code.replace(/\D/g, "");

/**
 * The players read a code on the picture of their team and type it here. Two tries only,
 * with a few seconds of lockout between them.
 */
export class FinalEnigma extends Enigma {

    constructor(context, equipe = CURRENT_TEAM) {
        super(context, ENIGMA_IDS.FINAL, "Énigme finale");

        this.equipe = equipe;
        this.correctCode = keepOnlyDigits(CODE_BY_TEAM[equipe]);
        this.triesLeft = MAX_TRIES;
        this.hasStarted = false; // the loop must not be launched twice

        this.panel = this.ui.panelManager.panelFinal;
    }

    start() {
        super.start();

        if (this.hasStarted) return;
        this.hasStarted = true;

        this.panel.showVisual(`${VISUAL_FOLDER}/visuel_equipe${this.equipe}.png`);
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
