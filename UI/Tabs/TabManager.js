import uiManagerInstance from '../UIManager.js';

import { Tab } from './Tab.js';
import { showTimer } from '../TimerUI.js';


import { ENIGMA_STATUS } from '../../Utils/Constant.js';
import { ENIGMA_IDS } from '../../Utils/Constant.js';
import { HELP_IDS } from '../../Utils/Constant.js';
import { SCREEN_IDS } from '../../Utils/Constant.js';


import progressionInstance from '../../GameLogic/Progression.js';


export class TabManager {
    constructor() {
        this.loadTabs();

        this.initEventListeners();

        this.webcamContainer = document.getElementById("webcam-container");

        this.activeTabId = SCREEN_IDS.WELCOME;
        this.tabs[SCREEN_IDS.WELCOME].status = ENIGMA_STATUS.AVAILABLE; // we may have problem if we don't do that
        this.showTab(this.activeTabId);

        this.tabContainer = document.querySelector('.btn-tab-container');

    }

    loadTabs() {
        this.tabs = {
            welcome: new Tab(SCREEN_IDS.WELCOME, 'Accueil', document.querySelector('.tab-button[data-target="dummy-button"]'), document.getElementById("panel-welcome")), // we use a dummy button for welcome because it is not a tab we will access after the beginning
            lsf: new Tab(ENIGMA_IDS.LSF, 'Signes', document.querySelector('.tab-button[data-target="lsf"]'), document.getElementById("panel-lsf"), document.getElementById("panel-lsf-victory")),
            aruco: new Tab(ENIGMA_IDS.ARUCO, 'Vrai ou faux', document.querySelector('.tab-button[data-target="aruco"]'), document.getElementById("panel-aruco"), document.getElementById("panel-aruco-victory")),
            colors: new Tab(ENIGMA_IDS.COLORS, 'Apprentissage coloré', document.querySelector('.tab-button[data-target="colors"]'), document.getElementById("panel-colors"), document.getElementById("panel-colors-victory")),
            chatbot: new Tab(HELP_IDS.CHATBOT, 'Chatbot susceptible', document.querySelector('.tab-button[data-target="chatbot"]'), document.getElementById("panel-chatbot")),
            guilty: new Tab(ENIGMA_IDS.GUILTY, "Mais qui est-ce donc le coupable ?", document.querySelector('.tab-button[data-target="guilty"]'), document.getElementById("panel-guilty"), document.getElementById("panel-guilty-victory")),
            final: new Tab(ENIGMA_IDS.FINAL, 'Final Reckoning', document.querySelector('.tab-button[data-target="final"]'), document.getElementById("panel-final"), document.getElementById("panel-final-victory")),
            defeat: new Tab(SCREEN_IDS.DEFEAT, 'Temps écoulé', document.querySelector('.tab-button[data-target="defeat"]'), document.getElementById("panel-defeat"))
        };
    }

    /**
     * Listen to click on the global naviguation
     */
    initEventListeners() {

        // 1. Écouteurs pour la barre de navigation classique
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                tabButtons.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');

                const targetId = e.currentTarget.getAttribute('data-target');
                this.showTab(targetId);
            });
        });
    }

    /**
     * Useful to show only the tab we are looking at. Also show the webcam interface depending on the tab we are using.
     */
    showTab(tabId) {
        this.activeTabId = tabId;

        // we deactivate all tabs (not really clean but the deactivate is pretty light and has a security to check if the tab is activeOrNot)
        Object.values(this.tabs).forEach(tab => tab.deactivateTab());

        // We activate the one asked
        if (this.tabs[tabId]) {
            this.tabs[tabId].activateTab();
        } else {
            console.log("DEBUG : could not activate this Tab");
        }

        this.displayOrNotWebcam(tabId);
        this.displayOrNotNavigationBar(tabId); //we don't display the naviguation bar only on the welcome page for the moment
        showTimer(tabId !== SCREEN_IDS.WELCOME); //le compte à rebours suit le joueur sur tous les onglets sauf l'accueil
    }

    displayOrNotWebcam(tabId) {
        const tabsWithWebcam = [ENIGMA_IDS.LSF, ENIGMA_IDS.ARUCO, ENIGMA_IDS.COLORS];

        if (tabId === SCREEN_IDS.WELCOME) return; //l'accueil gère lui-même sa webcam, via le bouton caméra

        if (!this.webcamContainer) {
            console.log("DEBUG : webcamcontainer is not defined anymore");
            return;
        }

        //une énigme caméra déjà résolue montre son panneau de victoire : plus rien à filmer
        if (tabsWithWebcam.includes(tabId) && !progressionInstance.isResolved(tabId)) {
            this.webcamContainer.style.display = "block";
        } else {
            this.webcamContainer.style.display = "none";
        }
    }

    displayOrNotNavigationBar(tabId) {
        if (this.tabContainer) {
            this.tabContainer.style.display = (tabId === SCREEN_IDS.WELCOME) ? "none" : "flex";
        } else {
            console.log("DEBUG : tabContainer undefined, cannot show or hide the naviguation bar ");
        }
    }

    /**
     * Fin de partie : on retire tout ce qui permettrait de continuer à jouer (les boutons des
     * onglets et celui du terminal), la webcam n'ayant plus de raison d'être affichée non plus.
     * À appeler APRÈS le showTab de l'écran final, car showTab réaffiche la barre de navigation.
     */
    lockInterfaceForEndOfGame() {
        if (this.tabContainer) this.tabContainer.style.display = "none";
        if (this.webcamContainer) this.webcamContainer.style.display = "none";

        const terminalButton = document.getElementById('btn-open-terminal');
        if (terminalButton) terminalButton.style.display = "none";
    }

    /**
     * One tab turns green : its button changes colour, and its victory panel takes the place of
     * the normal one
     */
    showResolved(idTab) {
        this.tabs[idTab]?.makeTabCompleted();
    }

    /**
     * Repaint the whole navigation bar from the Progression : orange for what is still to be
     * done, green for what is solved. Used when a reloaded page has to be put back the way the
     * team left it.
     */
    showProgression() {
        for (const id of progressionInstance.unlockedIds()) {
            const tab = this.tabs[id];
            if (!tab) continue;

            tab.unlockTab();

            if (progressionInstance.isResolved(id)) tab.makeTabCompleted();
        }
    }

    unlockAndShowBeginningPanels() {
        uiManagerInstance.tabManager.tabs[ENIGMA_IDS.ARUCO].unlockTab(); //we activate here the buttons
        uiManagerInstance.tabManager.showTab(ENIGMA_IDS.ARUCO);//we make this tab active (open)
    }

}