import { wait } from '../../Utils/UtilFunctions.js';

export class PanelChatbot {

    constructor({ chatId = "chat-aide", inputId = "inputMessage-aide", buttonId = "btnEnvoyer-aide" } = {}) {
        this.chatElement = document.getElementById(chatId);
        this.inputElement = document.getElementById(inputId);
        this.buttonElement = document.getElementById(buttonId);
    }

    async addMessage(text, classe = "bot") {
        const div = document.createElement("div");
        div.className = "message " + classe;
        this.chatElement.appendChild(div);

        for (const caractere of text) {
            div.textContent += caractere;
            this.chatElement.scrollTop = this.chatElement.scrollHeight;
            await wait(30);
        }
        await wait(250);
    }

    /**
    * Attend que l'utilisateur envoie un message (clic ou touche Entrée) et retourne le texte brut saisi.
    */
    waitUserInput() {
        return new Promise(resolve => {
            const bouton = this.buttonElement;
            const input = this.inputElement;

            const send = () => {
                const textOriginal = input.value;
                if (textOriginal === "") return;

                input.value = "";
                bouton.removeEventListener("click", clic);
                input.removeEventListener("keydown", enter);

                resolve(textOriginal);
            };

            const clic = () => send();
            const enter = (e) => { if (e.key === "Enter") send(); };

            bouton.addEventListener("click", clic);
            input.addEventListener("keydown", enter);
        });
    }
}
