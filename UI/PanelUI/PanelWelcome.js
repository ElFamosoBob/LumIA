import { wait } from '../../Utils/UtilFunctions.js';

export class PanelWelcome {

    /**
     * @param {TabManager} tabManager - handed down by the PanelManager, which got it from the
     *        UIManager. Asked for rather than imported : the UIManager singleton is still being
     *        built when this panel is created.
     */
    constructor(tabManager) {
        this.tabManager = tabManager;
    }
    /**
     * Bascule sur l'onglet Aruco, lance l'éblouissement global de l'écran, puis attend la fin du flash.
     * @param {number} delay - Le temps à attendre avant de lancer la transition.
     */
    async transitionToBeginningTab(delay) {
        await wait(delay); // on attend la fin de l'explosion du panneau d'accueil

        // Nettoyage de la navigation
        const welcomeTab = document.querySelector('.tab-button[data-target="welcome"]');
        if (welcomeTab) welcomeTab.style.display = "none";

        // Activation visuelle de l'onglet LSF
        const lsfTab = document.querySelector('.tab-button[data-target="lsf"]');
        if (lsfTab) {
            document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
            lsfTab.classList.add('active');
        }

        const colorsTab = document.querySelector('.tab-button[data-target="colors"]');
        if (colorsTab) {
            document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
            colorsTab.classList.add('active');
        }


        this.tabManager.unlockAndShowBeginningPanels()


        // Allumage aveuglant du système
        document.body.classList.add("global-boot");

        await wait(3500); //durée du flash
        document.body.classList.remove("global-boot");
    }
}