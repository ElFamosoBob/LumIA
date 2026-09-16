import audioManagerInstance from '../../Audio/AudioManager.js';
import { LSF_HOLD_MS } from '../../Utils/Constant.js';

export class PanelLsf {

    constructor() {
        this.lsfTextBox = document.getElementById("lsf-sign-box");
        this.holdBar = document.getElementById("lsf-hold-bar");
    }

    /**
    * Shows what letter we detect
    */
    updateGestureDebugText(currentGestures) {
        if (!currentGestures) {
            console.log("DEBUG : updateGestureDebugText n'a pas le currentState");
            return;
        }
        const gestesValides = currentGestures.filter(g => g && g !== "");

        if (gestesValides.length > 0) {
            this.lsfTextBox.classList.add("detecting");
            this.lsfTextBox.innerText = `Signe(s) : ${gestesValides.join(" + ")}`;
        } else {
            this.lsfTextBox.classList.remove("detecting");
            this.lsfTextBox.innerText = "Aucun signe clair.";
        }
    }

    /**
     * Avancement du maintien des bonnes lettres : remplit la barre et pilote le crescendo.
     * start() et stop() étant sans effet s'ils sont déjà dans l'état demandé, on peut appeler
     * cette méthode à chaque frame sans rien casser.
     * @param {number} ratio - 0 = rien de maintenu, 1 = maintien terminé
     */
    updateHoldProgress(ratio) {
        const clamped = Math.min(1, Math.max(0, ratio));

        if (this.holdBar) this.holdBar.style.width = `${clamped * 100}%`;

        if (clamped > 0) {
            // le crescendo dure exactement le temps du maintien demandé : il culmine pile à la validation
            audioManagerInstance.startCrescendo(LSF_HOLD_MS / 1000);
        } else {
            audioManagerInstance.stopCrescendo();
        }
    }
}
