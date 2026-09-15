import gameEngineInstance from '../GameEngine.js'
import progressionInstance from '../Progression.js';

import uiManagerInstance from '../../UI/UIManager.js';

export class Enigma {
    /**
     * @param {string} id - L'ID de l'énigme
     * @param {string} name - Le nom d'affichage
     * @param {Array<string>} enigmesSuivantes - Liste des IDs à débloquer en cas de réussite
     * @param {string|null} irlReward - Objet physique remis à l'équipe (voir IRL_REWARDS), null si aucun
     */
    constructor(id, name, enigmesSuivantes = [], irlReward = null) {
        this.id = id;
        this.name = name;
        this.enigmesSuivantes = enigmesSuivantes;
        this.irlReward = irlReward;

        this.addEventListenerForceResolution();
    }

    get isResolved() {
        return progressionInstance.isResolved(this.id);
    }

    // Ce que l'énigme doit faire quand on l'active (ex: allumer un onglet)
    start() {
        console.log(`Début de l'énigme : ${this.name}`);
    }

    update() {
        console.log("DEBUG : l'over de update n'a pas été fait");
    }


    checkCondition(donneesCapteurs) {
        console.log("DEBUG : l'overwrite de checkCondition n'a pas été fait");
        return false;
    }

    // Action visuelle personnalisée après victoire (à définir pour chaque énigme)
    onSuccess(skipAnimations = false) {
        console.log(`L'énigme avec le nom : "${this.name}" et l'id : "${this.id}" a été résolue. `);

        gameEngineInstance.completeEnigma(this.id, this.enigmesSuivantes, skipAnimations);

        uiManagerInstance.tabManager.showTab(this.id); //this reloads the page, showing now the panel of victory instead of the normal panel
    }

    /**
     * Mainly used to empty OpenCV, envet listeners and set intervals. Not all enigmas overwrite it.
     */
    cleanOfMemory() {
        console.log(`L'énigme avec l'id ${this.id} n'a pas de méthode clenOfMemory, cas normal`);
    }

    addEventListenerForceResolution() {
        // --- ÉCOUTE DU CODE DE TRICHE ---
        document.addEventListener('cheatcode_force_resolve', () => {

            // Sécurité 1 : Si l'énigme est déjà résolue, on l'ignore
            if (this.isResolved) return;

            //we hade the prefix panel to the id to have the id of the panel
            const panelId = `panel-${this.id}`;
            const myPanel = document.getElementById(panelId);

            if (!myPanel) {
                console.warn(`[Triche] Le panneau '${panelId}' est introuvable dans le DOM.`);
                return;
            }

            // Sécurité 2 : Infaillible pour vérifier si l'élément est vraiment affiché à l'écran
            const isVisible = window.getComputedStyle(myPanel).display !== "none";

            if (isVisible) {
                this.forceResolve();
            } else {
                console.log(`[Triche] Énigme '${this.name}' ignorée car son onglet n'est pas actif.`);
            }
        });
    }

    /**
     * Méthode appelée par le cheat code pour forcer la victoire
     */
    forceResolve() {
        console.log(`⚡ Résolution forcée par l'admin pour : ${this.name}`);
        this.onSuccess(true); //pas de cinématique pour le cheat code
    }
}
