import gameEngineInstance from '../GameLogic/GameEngine.js';
import uiManagerInstance from './UIManager.js';
import { ENIGMA_IDS } from '../Utils/Constant.js';
import { HELP_IDS } from '../Utils/Constant.js';
import { IRL_REWARDS } from '../Utils/Constant.js';
import progressionInstance from '../GameLogic/Progression.js';
import { showRewardAlert } from '../UI/AlertManager.js';
import audioManagerInstance from '../Audio/AudioManager.js';
import { isAnagramOf } from '../Utils/UtilFunctions.js';

export class TerminalManager {
    constructor() {
        this.btnOpen = document.getElementById('btn-open-terminal');
        this.btnClose = document.getElementById('btn-close-terminal');
        this.btnSubmit = document.getElementById('btn-submit-code');
        this.modal = document.getElementById('terminal-modal');
        this.inputField = document.getElementById('terminal-input');
        this.feedbackText = document.getElementById('terminal-feedback');

        this.initEventListeners();
    }

    initEventListeners() {
        if (!this.btnOpen) return; // Sécurité

        this.btnOpen.addEventListener('click', () => this.openTerminal());
        this.btnClose.addEventListener('click', () => this.closeTerminal());

        this.btnSubmit.addEventListener('click', () => this.processCode());

        // Permettre de valider avec la touche Entrée
        this.inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.processCode();
        });
    }

    openTerminal() {
        this.modal.classList.remove('modal-hidden');
        this.inputField.value = ''; // On vide le champ
        this.feedbackText.innerText = '';
        this.inputField.focus();
    }

    closeTerminal() {
        this.modal.classList.add('modal-hidden');
    }

    processCode() {
        const codeText = this.inputField.value.trim().toLowerCase();

        switch (codeText) {
            case 'prompt':
                this.feedbackText.innerText = "Accès autorisé : Chatbot déverrouillé.";
                this.feedbackText.style.color = "green";
                gameEngineInstance.activateEnigma(HELP_IDS.CHATBOT);
                this.grantPhysicalReward(IRL_REWARDS.R_AFTER_MOVIES);
                setTimeout(() => this.closeTerminal(), 1500);
                break;
            case 'apprentissage':
                if (progressionInstance.isLocked(ENIGMA_IDS.COLORS)) {
                    this.feedbackText.innerText = "Accès autorisé : Colors déverrouillé.";
                    this.feedbackText.style.color = "green";
                    gameEngineInstance.activateEnigma(ENIGMA_IDS.COLORS);
                    this.grantPhysicalReward(IRL_REWARDS.R_AFTER_DATE);
                    setTimeout(() => this.closeTerminal(), 1500);
                } else {
                    this.grantPhysicalReward(IRL_REWARDS.R_AFTER_DATE);
                    this.closeTerminal();
                }
                break;

            case 'recruter':
                this.feedbackText.innerText = "La réponse ne se trouve pas dans ce terminal... une AFFICHE t'aidera peut-être";
                this.feedbackText.style.color = "light green";
                this.inputField.value = '';
                break;
            default:
                if (isAnagramOf(codeText, 'plan')) {
                    this.feedbackText.innerText = "La réponse ne se trouve pas dans ce terminal... c'est peut-être un SIGNE";
                    this.feedbackText.style.color = "light green";
                    this.inputField.value = '';
                    break;
                }
                this.feedbackText.innerText = "Code invalide. Accès refusé.";
                this.feedbackText.style.color = "red";
                this.inputField.value = '';
                break;
        }

    }

    grantPhysicalReward(reward) {
        uiManagerInstance.animations.enqueue(() => showRewardAlert(reward));
    }

    /**
         * Fait apparaître le bouton avec son, glitch visuel et décryptage textuel
         */
    showTerminalButton() {
        if (!this.btnOpen) return;

        // 1. Affichage de base et application du glitch CSS
        this.btnOpen.style.display = 'block';

        // On retire puis remet la classe pour relancer l'animation si besoin
        this.btnOpen.classList.remove('mysterious-reveal');
        void this.btnOpen.offsetWidth; // Astuce pour forcer le navigateur à relire le CSS
        this.btnOpen.classList.add('mysterious-reveal');

        // 2. Lancement du son généré
        audioManagerInstance.playMysteriousSwell();

        // 3. Effet de Scramble (Décryptage de caractères)
        const finalString = "💻 OUVRIR LE TERMINAL 💻";
        const randomChars = "01$!*@#%&ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let iterations = 0;

        // Toutes les 40ms, on change les lettres
        const interval = setInterval(() => {
            this.btnOpen.innerText = finalString.split('').map((letter, index) => {
                // Si l'index est inférieur aux itérations, on affiche la vraie lettre
                if (index < Math.floor(iterations)) return finalString[index];

                // Sinon, on affiche un caractère aléatoire
                return randomChars[Math.floor(Math.random() * randomChars.length)];
            }).join('');

            // Condition d'arrêt
            if (iterations >= finalString.length) {
                clearInterval(interval);
            }

            // Vitesse du décryptage (plus le chiffre est bas, plus c'est long)
            iterations += 1 / 3;
        }, 40);

        console.log("Le terminal est maintenant affiché");
    }

}