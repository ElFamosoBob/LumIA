import { ENIGMA_STATUS } from '../../Utils/Constant.js';
import { ENIGMA_IDS } from '../../Utils/Constant.js';


export class Tab {
    /**
     * @param {string} idCible - Le data-target (ex: ENIGMA_IDS.LSF)
     * @param {string} nom - Le nom affiché (ex: "Scanner de Formes")
     * @param {HTMLElement} boutonDOM - L'élément HTML du bouton dans la navigation
     * @param {HTMLElement} panneauDOM - L'élément HTML du contenu de l'énigme
     * @param panneauVictory
     */
    constructor(idCible, nom, boutonDOM, panneauDOM, panneauVictory = document.getElementById("panel-to-implement")) {
        this.id = idCible; //this id is the same for the Enigma and the Tab displaying the enigma
        this.name = nom;

        // Les liens vers le HTML réel
        this.button = boutonDOM;
        this.panel = panneauDOM;

        // Actual status of this tab in the game.
        //locked = the player cannot see the tab
        //available = the player can see it and it is in orange
        //resolved = the player can see it and it is in green
        // States possible : ENIGMA_STATUS.LOCKED, ENIGMA_STATUS.AVAILABLE, ENIGMA_STATUS.RESOLVED
        this.status = ENIGMA_STATUS.LOCKED;

        this.activeOrNot = false;

        this.panelVictory = panneauVictory;
    }

    /**
     * Étape 1 : Le joueur débloque l'énigme (L'onglet apparaît en orange)
     */
    unlockTab() {
        if (this.status !== ENIGMA_STATUS.LOCKED) return;

        this.status = ENIGMA_STATUS.AVAILABLE;
        this.button.classList.add("available");
        this.button.classList.remove("completed", "active"); //security, when we unlock the button should be orange (available)

        // Ajout d'une petite animation d'arrivée
        this.button.classList.add("system-boot");
    }

    /**
     * Étape 2 : Le joueur clique sur l'onglet pour le lire (L'onglet devient bleu)
     */
    activateTab() {
        if (this.status === ENIGMA_STATUS.LOCKED) {
            console.log("DEBUG : activateTab dans Tab a été appelée alors que l'onglet est locked (ne devrait pas être atteignable)");
            return;
        }

        if (this.activeOrNot === true) {
            console.log("DEBUG : activateTab dans Tab a été appelée alors que l'onglet était déjà actif");
            return;
        }

        this.activeOrNot = true;

        // Gestion visuelle du bouton
        this.button.classList.add("active");

        //we show a different panel, depending on if the enigma is resolved or not
        if (this.status === ENIGMA_STATUS.RESOLVED) {
            this.panelVictory.classList.add("active");
        } else {
            this.panel.classList.add("active");
        }
    }

    /**
     * change the status back to available or resol
     */
    deactivateTab() {
        if (this.status === ENIGMA_STATUS.LOCKED) {
            // as of now, this is normal behavior as  we deactivate all tabs regardless of their status
            return;
        }

        if (this.activeOrNot === false) {
            // as of now, this is normal behavior as  we deactivate all tabs regardless of their status
            return;
        }

        this.activeOrNot = false;

        /*
        we remove both class, which can  seems weird as there should be only one of them active. The problem is that
        when we change the status to available to completed, the deactivateTab function tries to remove from the panelVictory classList
        and not the panel, making the old panel visible not only for this tab but for all the other ones. I thought it was ok to make it this way 
        */
        this.panelVictory.classList.remove("active");
        this.panel.classList.remove("active");


        this.button.classList.remove("active");
    }

    /**
     * Étape 3 : Le joueur a réussi l'énigme (L'onglet devient vert)
     */
    makeTabCompleted() {
        this.status = ENIGMA_STATUS.RESOLVED;
        this.button.classList.remove("available");
        this.button.classList.add("completed");
    }
}