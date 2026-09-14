import { Enigma } from './Enigma.js';
import { ENIGMA_IDS, IRL_REWARDS } from '../../Utils/Constant.js';
import { ARUCO_CARDS } from './ArucoCards.js';

import inputManagerInstance from '../../Inputs/InputManager.js';
import uiManagerInstance from '../../UI/UIManager.js';

// Écart toléré, en millimètres, entre le centre d'un marqueur et l'emplacement attendu.
const POSITION_TOLERANCE_MM = 10;

// Une carte peut clignoter d'une image à l'autre (reflet, main qui passe) : on regarde le plateau
// pendant plusieurs dizaines d'images et il suffit d'avoir vu la carte UNE fois pour la valider.
const FRAMES_PER_CHECK = 25;

// Une feuille absente de presque toutes les images veut dire que le plateau est mal cadré : le
// score n'a alors aucun sens. On tolère deux images sans elle, pas plus.
const MAX_FRAMES_WITHOUT_SHEET = FRAMES_PER_CHECK - 2;

/**
 * L'équipe pose huit cartes vrai/faux sur deux feuilles repérées par des marqueurs ArUco.
 * Un clic sur "Vérifier" lance une analyse de quelques secondes, au terme de laquelle l'énigme
 * dit combien de cartes sont à la fois bien répondues et bien placées.
 *
 * Les affirmations, les identifiants de marqueurs et la disposition physique sont dans
 * ArucoCards.js ; ce fichier ne contient que la règle du jeu.
 */
export class ArucoEnigma extends Enigma {
    constructor() {
        super(ENIGMA_IDS.ARUCO, "Aruco vrai/faux", [ENIGMA_IDS.LSF], IRL_REWARDS.V_AFTER_ARUCO);

        this.panel = uiManagerInstance.panelManager.panelAruco;

        // Vrai seulement pendant une analyse : en dehors, les images de la caméra sont ignorées.
        this.checkNow = false;
        this.framesAnalysed = 0;

        // Combien d'images ont montré chaque marqueur à l'emplacement d'une carte.
        this.markerSightings = {};

        // Combien d'images n'ont pas montré chaque feuille en entier.
        this.framesWithoutSheet = {};

        this.panel.connectVerifyButton(() => this.startCheck());
    }

    /**
     * Remet les compteurs à zéro et ouvre une nouvelle fenêtre d'analyse.
     */
    startCheck() {
        if (this.isResolved) return;

        this.markerSightings = {};
        this.framesWithoutSheet = { 1: 0, 2: 0 };

        this.checkNow = true;
        this.framesAnalysed = 0;

        this.panel.showAnalysing();
    }

    update() {
        if (this.isResolved) return;

        inputManagerInstance.update(this.id);
        // playerState contient { markers: [...], sheetsVisible: [...] } fourni par le Recognizer
        const playerState = inputManagerInstance.getState();

        this.checkCondition(playerState);
    }

    /**
     * Une image de plus dans l'analyse en cours. Hors analyse, il n'y a rien à faire.
     */
    checkCondition(currentResults) {
        if (!this.checkNow || !currentResults) return;

        this.recordSheetsHidden(currentResults.sheetsVisible);
        this.recordMarkersWellPlaced(currentResults.markers);

        this.framesAnalysed++;

        if (this.framesAnalysed >= FRAMES_PER_CHECK) {
            this.checkNow = false;
            this.evaluateGame();
        }
    }

    /**
     * Comptabilise l'absence de chaque feuille, pour pouvoir avertir l'équipe que son plateau
     * est mal cadré plutôt que de lui annoncer un score faux.
     */
    recordSheetsHidden(sheetsVisible) {
        for (const sheetID of [1, 2]) {
            if (!sheetsVisible.includes(sheetID)) this.framesWithoutSheet[sheetID]++;
        }
    }

    /**
     * Retient les marqueurs vus à l'emplacement d'une carte, quelle que soit leur face : c'est
     * l'évaluation finale qui décidera si la face était la bonne.
     */
    recordMarkersWellPlaced(markers) {
        for (const marker of markers) {
            if (ARUCO_CARDS.some(card => this.isMarkerOnCardSlot(marker, card))) {
                this.markerSightings[marker.id] = (this.markerSightings[marker.id] ?? 0) + 1;
            }
        }
    }

    /**
     * Un marqueur est « à l'emplacement » d'une carte s'il est sur la bonne feuille et assez
     * proche des coordonnées attendues, en millimètres dans le repère redressé de la feuille.
     */
    isMarkerOnCardSlot(marker, card) {
        return card.sheet === marker.sheetID
            && Math.abs(marker.x - card.pos[0]) <= POSITION_TOLERANCE_MM
            && Math.abs(marker.y - card.pos[1]) <= POSITION_TOLERANCE_MM;
    }

    /**
     * @returns {boolean} faux si au moins une feuille est restée hors champ presque toute l'analyse
     */
    areAllSheetsVisible() {
        return [1, 2].every(sheetID => this.framesWithoutSheet[sheetID] <= MAX_FRAMES_WITHOUT_SHEET);
    }

    /**
     * Une carte est réussie quand sa face correcte a été vue au moins une fois à son emplacement.
     */
    isCardWellAnswered(card) {
        return (this.markerSightings[card.correctId] ?? 0) >= 1;
    }

    /**
     * Les cartes dont AUCUNE des deux faces n'a été vue à leur emplacement. Ce n'est pas une
     * mauvaise réponse mais un problème de détection : la carte est mal posée, ou cachée.
     * @returns {Array<string>} les affirmations concernées
     */
    undetectedCardNames() {
        return ARUCO_CARDS
            .filter(card => (this.markerSightings[card.correctId] ?? 0) === 0
                && (this.markerSightings[card.wrongId] ?? 0) === 0)
            .map(card => card.name);
    }

    /**
     * Fin de l'analyse : on annonce le verdict, et on gagne si les huit cartes sont bonnes.
     */
    evaluateGame() {
        if (!this.areAllSheetsVisible()) {
            this.panel.showSheetsHidden();
            return;
        }

        this.panel.showMissingCards(this.undetectedCardNames());

        const nbCardsOK = ARUCO_CARDS.filter(card => this.isCardWellAnswered(card)).length;

        if (nbCardsOK === ARUCO_CARDS.length) {
            this.panel.showVictory();
            this.onSuccess();
        } else {
            this.panel.showScore(nbCardsOK, ARUCO_CARDS.length);
        }
    }
}
