import { wait } from '../../Utils/UtilFunctions.js';

export class PanelGuilty {

    constructor({ inputId = "inputMessage-guilty", buttonId = "btnAccuser-guilty",
        feedbackId = "feedback-guilty", cooldownId = "cooldown-guilty" } = {}) {
        this.inputElement = document.getElementById(inputId);
        this.buttonElement = document.getElementById(buttonId);
        this.feedbackElement = document.getElementById(feedbackId);
        this.cooldownElement = document.getElementById(cooldownId);
    }

    /**
     * Waits for the player to submit an accusation (click on the button or Enter key), then returns
     * what was typed. Same pattern as PanelFinal.waitUserCode().
     */
    waitAccusation() {
        return new Promise(resolve => {
            const bouton = this.buttonElement;
            const input = this.inputElement;

            const send = () => {
                const name = input.value;
                if (name === "") return;

                input.value = "";
                bouton.removeEventListener("click", clic);
                input.removeEventListener("keydown", enter);

                resolve(name);
            };

            const clic = () => send();
            const enter = (e) => { if (e.key === "Enter") send(); };

            bouton.addEventListener("click", clic);
            input.addEventListener("keydown", enter);
        });
    }

    /**
     * Closes the input while the players are not allowed to try (during the cooldown).
     */
    setInputEnabled(enabled) {
        if (this.inputElement) this.inputElement.disabled = !enabled;
        if (this.buttonElement) this.buttonElement.disabled = !enabled;
    }

    showEmptyAccusation() {
        this.showFeedback("Entre le prénom de la personne que tu accuses.", "wrong");
    }

    showWrongAccusation(nameTyped) {
        this.showFeedback(`"${nameTyped}" n'est pas le coupable.`, "wrong");
    }

    showRightAccusation(nameOfCulprit) {
        this.showFeedback(`Accusation confirmée : ${nameOfCulprit} est bien le coupable.`, "right");
        if (this.cooldownElement) this.cooldownElement.textContent = "";
    }

    showFeedback(text, classe) {
        this.feedbackElement.textContent = text;
        this.feedbackElement.className = `feedback-guilty ${classe}`;
    }

    /**
     * Locks the players out for a few seconds after a wrong guess. The duration grows with each
     * mistake (decided by the enigma), this panel only displays whatever duration it is given.
     */
    async runCooldown(seconds) {
        if (!this.cooldownElement) return;

        for (let i = seconds; i >= 0; i--) {
            this.cooldownElement.textContent = `Prochaine tentative possible dans ${i} seconde${i > 1 ? "s" : ""}...`;
            await wait(1000);
        }

        this.cooldownElement.textContent = "";
    }
}
