import audioManagerInstance from '../Audio/AudioManager.js';
import { wait } from '../Utils/UtilFunctions.js';
import { SCREEN_IDS } from '../Utils/Constant.js';

const SUCCESS_ANIMATION_MS = 1400;
const UNLOCK_ANIMATION_MS = 6500; //needs to be the same in css cinematics.css

export class Animations {

    /**
     * @param {TabManager} tabManager - given by the UIManager that builds both. Asked for here
     *        rather than reached for through the UIManager singleton because UIManager is still
     *        being built.
     */
    constructor(tabManager) {
        this.tabManager = tabManager;

        this.cinematicOverlay = document.getElementById("unlock-cinematic");
        this.cinematicText = document.getElementById("cinematic-tab-name");
        this.cinematicContent = this.cinematicOverlay?.querySelector(".cinematic-content");

        this.successOverlay = document.getElementById("success-flash");

        this.btnStart = document.getElementById("startButton");

        //we use queue so that animations does not overlap on each other
        this.queue = Promise.resolve();
    }

    /**
     * Queue of animation
     * @param {() => Promise} animation
     */
    enqueue(animation) {
        this.queue = this.queue
            .then(animation)
            .catch(error => console.log("DEBUG Animations : une animation a échoué", error));

        return this.queue;
    }

    /**
     * Played after each enigma resolved
     */
    launchSuccessAnimation() {
        return this.enqueue(async () => {
            if (!this.successOverlay) return;

            this.successOverlay.classList.add("playing");
            audioManagerInstance.playEnigmaSuccess(); //le déclic de déverrouillage au moment où le tampon apparaît

            await wait(SUCCESS_ANIMATION_MS);
            this.successOverlay.classList.remove("playing");
        });
    }

    /**
    * Makes a fancy animation adn then show the button to access the tab of the enigma unlocked
    */
    launchUnlockingEnigmaAnimation(idOfNewTab) {
        return this.enqueue(async () => {
            const newTab = this.tabManager.tabs[idOfNewTab];
            if (!this.cinematicOverlay || !newTab) return;

            this.cinematicText.innerText = newTab.name;
            audioManagerInstance.playTabUnlocking();

            this.cinematicOverlay.style.display = "flex";
            await wait(10);

            this.cinematicOverlay.style.opacity = "1";
            this.cinematicContent.classList.add("cinematic-animate");
            await wait(UNLOCK_ANIMATION_MS);

            this.cinematicOverlay.style.opacity = "0";
            await wait(300);

            this.cinematicOverlay.style.display = "none";
            this.cinematicContent.classList.remove("cinematic-animate");

            //une fois la cinématique finie, c'est le bouton du nouvel onglet qui doit attirer l'oeil
            if (newTab.button) {
                newTab.button.classList.add("unlock-animation");
                setTimeout(() => newTab.button.classList.remove("unlock-animation"), 1500);
            }
        });
    }

    /**
         * Fait exploser les éléments de l'accueil un par un.
         * @returns {number} Le temps total (en ms) que va durer l'explosion.
         */
    launchAnimationOutOfWelcomePanel() {
        this.btnStart.innerText = "ACCÈS VALIDÉ...";
        this.btnStart.style.backgroundColor = "#ff5252";

        const welcomePanel = this.tabManager.tabs[SCREEN_IDS.WELCOME].panel;
        const welcomePanelElements = Array.from(welcomePanel.children);

        welcomePanelElements.forEach((element, index) => {
            element.style.animationDelay = `${index * 0.15}s`;
            element.classList.add("explode-out");
        });

        //now the elements are invisible in css but we need them to really disapear => display to 'none'
        document.getElementById("panel-welcome").style.display = "none";
        return (welcomePanelElements.length * 150) + 600;
    }

}
