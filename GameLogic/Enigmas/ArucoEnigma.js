import { Enigma } from './Enigma.js';
import { ENIGMA_IDS } from '../../Utils/Constant.js';
import { IRL_REWARDS } from '../../Config/GameConfig.js';
import { ARUCO_CARDS } from '../../Config/ArucoBoard.js';


// Tolerated gap, in millimetres, between the centre of a marker and its expected slot.
const POSITION_TOLERANCE_MM = 10;

//number of frame we look. If a card is only see once, it is enough to be validated
const FRAMES_PER_CHECK = 25;

// A sheet missing from nearly every frame means the board is badly framed : the score would then
// be meaningless. We tolerate two frames without it, no more.
const MAX_FRAMES_WITHOUT_SHEET = FRAMES_PER_CHECK - 2;

/**
 * The team lays eight true/false cards on two sheets marked with Aruco markers. Clicking
 * "Vérifier" starts a few seconds of analysis, at the end of which the enigma says how many
 * cards are both answered and placed correctly.
 *
 * The statements, the marker ids and the physical layout live in Config/ArucoBoard.js
 */
export class ArucoEnigma extends Enigma {
    constructor(context) {
        super(context, ENIGMA_IDS.ARUCO, "Aruco vrai/faux", [ENIGMA_IDS.LSF], IRL_REWARDS.V_AFTER_ARUCO);

        this.panel = this.ui.panelManager.panelAruco;

        // True only during an analysis : outside of one, camera frames are ignored.
        this.checkNow = false;
        this.framesAnalysed = 0;

        // How many frames showed each marker at the slot of a card.
        this.markerSightings = {};

        // How many frames did not show each sheet in full.
        this.framesWithoutSheet = {};

        this.panel.connectVerifyButton(() => this.startCheck());
    }

    /**
     * Resets the counters and opens a new analysis window.
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

        this.input.update(this.id);
        // playerState holds { markers: [...], sheetsVisible: [...] }, filled by the Recognizer
        const playerState = this.input.getState();

        this.checkCondition(playerState);
    }

    /**
     * One more frame in the running analysis. Outside of an analysis there is nothing to do.
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
     * Counts how often each sheet is missing, so we can warn the team that its board is badly
     * framed instead of announcing a wrong score.
     */
    recordSheetsHidden(sheetsVisible) {
        for (const sheetID of [1, 2]) {
            if (!sheetsVisible.includes(sheetID)) this.framesWithoutSheet[sheetID]++;
        }
    }

    /**
     * Remembers the markers seen at the slot of a card, whatever their face : the final
     * evaluation is what decides whether the face was the right one.
     */
    recordMarkersWellPlaced(markers) {
        for (const marker of markers) {
            if (ARUCO_CARDS.some(card => this.isMarkerOnCardSlot(marker, card))) {
                this.markerSightings[marker.id] = (this.markerSightings[marker.id] ?? 0) + 1;
            }
        }
    }

    /**
     * A marker is "at the slot" of a card when it sits on the right sheet and close enough to
     * the expected coordinates, in millimetres in the flattened frame of that sheet.
     */
    isMarkerOnCardSlot(marker, card) {
        return card.sheet === marker.sheetID
            && Math.abs(marker.x - card.pos[0]) <= POSITION_TOLERANCE_MM
            && Math.abs(marker.y - card.pos[1]) <= POSITION_TOLERANCE_MM;
    }

    /**
     * @returns {boolean} false if at least one sheet stayed out of frame for the whole analysis
     */
    areAllSheetsVisible() {
        return [1, 2].every(sheetID => this.framesWithoutSheet[sheetID] <= MAX_FRAMES_WITHOUT_SHEET);
    }

    /**
     * A card is right when its correct face was seen at least once at its slot.
     */
    isCardWellAnswered(card) {
        return (this.markerSightings[card.correctId] ?? 0) >= 1;
    }

    /**
     * The cards of which NEITHER face was seen at its slot. That is not a wrong answer but a
     * detection problem : the card is badly laid, or hidden.
     * @returns {Array<string>} the statements concerned
     */
    undetectedCardNames() {
        return ARUCO_CARDS
            .filter(card => (this.markerSightings[card.correctId] ?? 0) === 0
                && (this.markerSightings[card.wrongId] ?? 0) === 0)
            .map(card => card.name);
    }

    /**
     * End of the analysis : we announce the verdict, and win if all eight cards are right.
     */
    evaluateGame() {
        if (!this.areAllSheetsVisible()) {
            this.panel.showSheetsHidden();
            return;
        }

        this.panel.showMissingCards(this.undetectedCardNames());

        const nbCardsOK = ARUCO_CARDS.filter(card => this.isCardWellAnswered(card)).length;

        if (nbCardsOK === ARUCO_CARDS.length) {
            this.onSuccess();
        } else {
            this.panel.showScore(nbCardsOK, ARUCO_CARDS.length);
        }
    }
}
