import { wait } from '../../Utils/UtilFunctions.js';

export class PanelFinal {

    constructor() {
        this.visualElement = document.getElementById("final-visual");
        this.inputElement = document.getElementById("inputCode-final");
        this.buttonElement = document.getElementById("btnValider-final");
        this.triesElement = document.getElementById("final-tries");
        this.timeElement = document.getElementById("final-time");
        this.resultElement = document.getElementById("final-result");
    }

    /**
     * Each team gets its own picture. If the file is missing we hide the frame instead of showing a broken image.
     */
    showVisual(source) {
        if (!this.visualElement) return;

        this.visualElement.onerror = () => {
            console.log(`DEBUG PanelFinal : le visuel '${source}' est introuvable`);
            this.visualElement.style.display = "none";
        };

        this.visualElement.style.display = "block";
        this.visualElement.src = source;
    }

    /**
     * Waits for the player to send a code (click on the button or Enter key), then returns what was typed.
     */
    waitUserCode() {
        return new Promise(resolve => {
            const bouton = this.buttonElement;
            const input = this.inputElement;

            const send = () => {
                const code = input.value;
                if (code === "") return;

                input.value = "";
                bouton.removeEventListener("click", clic);
                input.removeEventListener("keydown", enter);

                resolve(code);
            };

            const clic = () => send();
            const enter = (e) => { if (e.key === "Enter") send(); };

            bouton.addEventListener("click", clic);
            input.addEventListener("keydown", enter);
        });
    }

    /**
     * Closes the input while the players are not allowed to try (during the countdown, and once the game is over).
     */
    setInputEnabled(enabled) {
        if (this.inputElement) this.inputElement.disabled = !enabled;
        if (this.buttonElement) this.buttonElement.disabled = !enabled;
    }

    showTriesLeft(numberOfTries) {
        if (!this.triesElement) return;

        if (numberOfTries > 1) {
            this.triesElement.textContent = `${numberOfTries} tentatives restantes`;
            this.triesElement.className = "final-tries";
        } else if (numberOfTries === 1) {
            this.triesElement.textContent = "1 tentative restante";
            this.triesElement.className = "final-tries last";
        } else {
            this.triesElement.textContent = "Plus de tentatives. Vous avez malheureusement échoué la mission !";
            this.triesElement.className = "final-tries failed";
        }
    }

    /**
     * Locks the players out for a few seconds after a wrong code.
     */
    async runCountdown(seconds) {
        if (!this.timeElement) return;

        for (let i = seconds; i >= 0; i--) {
            this.timeElement.textContent = `Attention, la prochaine tentative sera la dernière. ${i} secondes`;
            await wait(1000);
        }

        this.timeElement.textContent = "";
    }

    showSuccess() {
        if (this.resultElement) {
            this.resultElement.textContent = "Bravo !";
            this.resultElement.className = "final-result success";
        }
        if (this.triesElement) {
            this.triesElement.textContent = "";
        }
    }
}
