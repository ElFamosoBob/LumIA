/**
 * The display of the true/false card enigma
 *
 * Three text areas, from the most to the least important :
 *  - the verdict (score, victory, or badly framed board),
 *  - the list of cards the camera did not find at their slot,
 *  - the handling tip that goes with that list.
 *
 * ArucoEnigma decides which of those situations applies
 */
export class PanelAruco {

    constructor() {
        this.verifyButton = document.getElementById("btn-aruco-verify");
        this.resultElement = document.getElementById("aruco-result");
        this.messageElement = document.getElementById("aruco-message");
        this.hintElement = document.getElementById("aruco-hint");
    }

    /**
     * Wires the "Vérifier" button.
     * @param {Function} onVerify
     */
    connectVerifyButton(onVerify) {
        this.verifyButton?.addEventListener("click", () => onVerify());
    }

    /**
     * The analysis spans a few dozen frames : we say so, and we wipe the previous verdict so it
     * cannot be mistaken for the one about to come.
     */
    showAnalysing() {
        this.setResult("Analyse en cours ...");
        this.setMessage("");
        this.setHint("");
    }

    /**
     * The board is readable but the team has not placed everything correctly yet.
     */
    showScore(nbCardsOK, nbCardsToPlace) {
        this.setResult(`Nombre de cartes correctes et bien placées: ${nbCardsOK} sur ${nbCardsToPlace} cartes`);
    }

    /**
     * A sheet stayed out of frame for nearly the whole analysis : the score would be meaningless,
     * so we also wipe the list of missing cards, which would be misleading.
     */
    showSheetsHidden() {
        this.setResult("Tous les coins du plateau de jeu ne sont pas visibles ! N'hésitez pas à passer la main brièvement devant la caméra pendant la vérification.");
        this.setMessage("");
        this.setHint("");
    }

    /**
     * The cards the camera saw at their slot on neither face. This is not a wrong answer but a
     * detection problem : the card is badly laid, or hidden.
     * @param {Array<string>} cardNames - empty when everything was detected
     */
    showMissingCards(cardNames) {
        if (cardNames.length === 0) {
            this.setMessage("");
            this.setHint("");
            return;
        }

        this.setMessage(cardNames.map(name => `La carte "${name}" n'a pas été détectée à son emplacement. `).join(""));
        this.setHint("Si une carte n'a pas été détectée, passez brièvement la main devant la caméra ou bougez légèrement la caméra pendant la vérification.");
    }

    setResult(text) {
        if (this.resultElement) this.resultElement.textContent = text;
    }

    setMessage(text) {
        if (this.messageElement) this.messageElement.textContent = text;
    }

    setHint(text) {
        if (this.hintElement) this.hintElement.textContent = text;
    }
}
