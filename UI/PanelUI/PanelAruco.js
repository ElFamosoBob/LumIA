/**
 * L'affichage de l'énigme des cartes vrai/faux : uniquement du DOM, aucune règle de jeu.
 *
 * Trois zones de texte, du plus important au plus secondaire :
 *  - le verdict (score, victoire, ou plateau mal cadré),
 *  - la liste des cartes que la caméra n'a pas trouvées à leur emplacement,
 *  - le conseil de manipulation qui va avec cette liste.
 *
 * C'est ArucoEnigma qui décide laquelle de ces situations s'applique ; ce panneau se contente
 * de mettre les bons mots aux bons endroits.
 */
export class PanelAruco {

    constructor() {
        this.verifyButton = document.getElementById("btn-aruco-verify");
        this.resultElement = document.getElementById("aruco-result");
        this.messageElement = document.getElementById("aruco-message");
        this.hintElement = document.getElementById("aruco-hint");
    }

    /**
     * Branche le bouton "Vérifier". L'énigme donne ce qu'il doit déclencher, le panneau ne
     * sait pas ce que ça fait.
     * @param {Function} onVerify
     */
    connectVerifyButton(onVerify) {
        this.verifyButton?.addEventListener("click", () => onVerify());
    }

    /**
     * L'analyse dure plusieurs dizaines d'images : on prévient, et on efface le verdict précédent
     * pour qu'il ne soit pas confondu avec celui qui arrive.
     */
    showAnalysing() {
        this.setResult("Analyse en cours ...");
        this.setMessage("");
        this.setHint("");
    }

    /**
     * Toutes les cartes sont au bon endroit : l'énigme est gagnée.
     */
    showVictory() {
        this.setResult("Bravo !");
    }

    /**
     * Le plateau est lisible mais l'équipe n'a pas encore tout placé correctement.
     */
    showScore(nbCardsOK, nbCardsToPlace) {
        this.setResult(`Nombre de cartes correctes et bien placées: ${nbCardsOK} sur ${nbCardsToPlace} cartes`);
    }

    /**
     * Une feuille est restée hors champ presque toute l'analyse : le score n'aurait aucun sens,
     * on efface donc aussi le détail des cartes manquantes, qui serait trompeur.
     */
    showSheetsHidden() {
        this.setResult("Tous les coins du plateau de jeu ne sont pas visibles ! N'hésitez pas à passer la main brièvement devant la caméra pendant la vérification.");
        this.setMessage("");
        this.setHint("");
    }

    /**
     * Les cartes que la caméra n'a vues à leur emplacement ni en "vrai" ni en "faux". Le conseil
     * n'apparaît que s'il y en a : sans carte manquante, il n'aurait rien à expliquer.
     * @param {Array<string>} cardNames - vide quand tout a été détecté
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
