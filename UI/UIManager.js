import { StartButton } from './StartButton.js';
import { Animations } from './Animations.js';
import { TabManager } from './Tabs/TabManager.js';
import { PanelManager } from './PanelUI/PanelManager.js';

import { TerminalManager } from './TerminalManager.js';

import { loadProgress, clearProgress } from '../Utils/SaveManager.js';
import { showConfirmAlert } from './AlertManager.js';


class UIManager {

    constructor() {

        this.loadHTMLelements();

        //Order matters : each of these receives the ones built before it. None of them may reach
        //back for uiManagerInstance, which does not exist yet while this constructor runs.
        this.tabManager = new TabManager();
        this.animations = new Animations(this.tabManager);
        this.panelManager = new PanelManager(this.tabManager);
        this.startButton = new StartButton();
        this.terminalManager = new TerminalManager(this.animations);

        this.initResetProgressButton();
    }

    /**
     * Le bouton d'effacement de la sauvegarde, sur l'accueil. Il n'apparaît que s'il y a
     * effectivement une partie à reprendre : inutile de le montrer à une équipe qui commence.
     * Une confirmation est demandée, puis on recharge la page pour repartir totalement à neuf.
     */
    initResetProgressButton() {
        const btnReset = document.getElementById("btn-reset-progress");
        if (!btnReset) {
            console.log("DEBUG : le bouton d'effacement de la progression est introuvable");
            return;
        }

        if (!loadProgress()) return; //aucune sauvegarde : le bouton reste caché

        btnReset.style.display = "block";

        btnReset.addEventListener("click", async () => {
            const confirmed = await showConfirmAlert(
                "Une partie sauvegardée existe : elle reprendra là où elle s'était arrêtée. L'effacer relancera une partie neuve, chronomètre au maximum. Cette action est définitive.",
                {
                    title: "Effacer la progression ?",
                    confirmLabel: "Oui, tout effacer",
                    cancelLabel: "Non, annuler"
                }
            );

            if (!confirmed) return;

            clearProgress();
            window.location.reload();
        });
    }

    /**
     * The transition out of the welcome screen : the panel explodes, the first enigma tab opens,
     * then the terminal button appears.
     *
     */
    async leaveWelcomeScreen() {
        const waitingTime = this.animations.launchAnimationOutOfWelcomePanel();
        await this.panelManager.panelWelcome.transitionToBeginningTab(waitingTime);

        this.terminalManager.showTerminalButton();
    }


    hideLoading() {
        this.loadingMessage.style.display = "none";
    }

    loadHTMLelements() {
        // --- we get the element of the interface ---
        this.loadingMessage = document.getElementById("loadingMessage");
        this.notificationBanner = document.getElementById("notification-banner");



        const btnReload = document.getElementById('btn-reload-system');
        if (btnReload) {
            btnReload.addEventListener('click', () => {
                console.log("🔄 Lancement du protocole de redémarrage intégral...");

                //it seems weird but it is the modern way (we change the url with the date so that everything is loaded, because the cache is empty)
                const urlWithoutParameters = window.location.pathname;
                window.location.href = urlWithoutParameters + "?t=" + Date.now();
            });
        }
    }

    unlockNewTabWithoutAnimations(idOfNewTab) {
        const newTab = this.tabManager.tabs[idOfNewTab];
        if (!newTab) {
            console.log("DEBUG : the new tab could not be unlocked");
            return;
        }

        newTab.unlockTab(); //we unlock the tab visually (shows the button)
    }

    unlockNewTabWithAnimations(idOfNewTab) {

        this.unlockNewTabWithoutAnimations(idOfNewTab);
        this.animations.launchUnlockingEnigmaAnimation(idOfNewTab);

    }


}

//Singleton creation : 
const uiManagerInstance = new UIManager();
export default uiManagerInstance;
