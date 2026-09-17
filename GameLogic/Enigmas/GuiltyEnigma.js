import { Enigma } from './Enigma.js';
import { ENIGMA_IDS } from '../../Utils/Constant.js';
import { IRL_REWARDS, SUSPECTS } from '../../Config/GameConfig.js';
import { normalizeText } from '../../Utils/UtilFunctions.js';

import { showConfirmAlert } from '../../UI/AlertManager.js';

// Le cooldown s'allonge à chaque erreur, puis reste au dernier palier pour toutes les suivantes.
const COOLDOWNS_SECONDS = [10, 40, 60, 180];

/**
 * The player types the name of the person he accuses. Finding the right one unlocks the final enigma.
 * The culprit is the first suspect of the list : a girl, so the chatbot which only kept the boys was biased.
 *
 * There is no hard limit on the number of tries (unlike FinalEnigma) : this is not the last gate of the
 * game, so locking the team out here would strand them before they even reach the finale. Instead, each
 * wrong guess costs a growing cooldown, which is enough to kill brute-forcing the ten known suspects.
 */
export class GuiltyEnigma extends Enigma {

    constructor(context) {
        super(context, ENIGMA_IDS.GUILTY, "L'accusation", [ENIGMA_IDS.FINAL], IRL_REWARDS.V_AFTER_GUILTY);

        this.culprit = SUSPECTS[0];
        this.wrongTries = 0;
        this.hasStarted = false; // the loop must not be launched twice

        this.panel = this.ui.panelManager.panelGuilty;
    }

    start() {
        super.start();

        if (this.hasStarted) return;
        this.hasStarted = true;

        this.runEnigma();
    }

    /**
     * Nothing to poll : the enigma waits for the player instead of being driven by the GameEngine loop.
     */
    update() { }

    async runEnigma() {
        this.panel.setInputEnabled(true);

        while (!this.isResolved) {
            const accusation = await this.panel.waitAccusation();

            if (normalizeText(accusation) === "") {
                this.panel.showEmptyAccusation();
                continue;
            }

            // On fait confirmer l'orthographe avant de compter le coup : une faute de frappe
            // ne doit pas coûter un cooldown de plusieurs minutes.
            const confirmed = await showConfirmAlert(
                `Vous êtes sur le point d'accuser "${accusation}". Vérifiez l'orthographe avant de valider, ne mettez pas d'accents / de trémas dans votre réponse.`
            );
            if (!confirmed) continue;

            if (normalizeText(accusation) === normalizeText(this.culprit)) {
                this.panel.showRightAccusation(this.culprit);
                this.panel.setInputEnabled(false);
                this.onSuccess();
                return;
            }

            this.panel.showWrongAccusation(accusation);

            const cooldown = COOLDOWNS_SECONDS[Math.min(this.wrongTries, COOLDOWNS_SECONDS.length - 1)];
            this.wrongTries++;

            this.panel.setInputEnabled(false);
            await this.panel.runCooldown(cooldown);
            this.panel.setInputEnabled(true);
        }
    }
}
