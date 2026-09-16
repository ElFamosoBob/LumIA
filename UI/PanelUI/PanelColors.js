import { MAZE_SYMBOLS } from '../../GameLogic/MiniGames/Maze.js';


const CIRCLES_EXPECTED = 5;

// Combien d'images d'affilée doivent montrer les 5 pastilles avant de figer l'image. Une seule
// bonne image peut être un hasard : une main en train de sortir du champ en laisse passer.
const STABLE_FRAMES = 5;


// Only used to draw the dot of each chip, so the players can link a chip to a real circle on the table
// Ce sont les encres du plateau, celles listees dans COLOR_REFERENCES (ColorsRecognizer) :
// la pastille a l'ecran doit avoir la meme couleur que celle posee sur la table.
const COLOR_SWATCHES = {
    "Rouge": "#ff1e1e",
    "Jaune": "#ffd400",
    "Vert": "#00b050",
    "Bleu": "#3b1fe0",
    "Magenta": "#ff00ff"
};

export class PanelColors {

    constructor() {

        this.mazeLayout = document.getElementById("maze-layout");
        this.gridElement = document.getElementById("maze-grid");
        this.ringElement = document.getElementById("countdown-ring");
        this.countdownValue = document.getElementById("countdown-value");
        this.chipsElement = document.getElementById("colors-chips");
        this.feedbackElement = document.getElementById("maze-feedback");

        this.playerElement = null;
        this.chips = {};

        // Le réglage des couleurs
        this.adjustButton = document.getElementById("btn-calibration-adjust");
        this.resetButton = document.getElementById("btn-calibration-reset");
        this.validateButton = document.getElementById("btn-calibration-validate");
        this.fixButton = document.getElementById("btn-calibration-fix");
        this.calibrationMessage = document.getElementById("calibration-message");
        this.calibrationRows = document.getElementById("calibration-rows");

        this.calibrationSelects = {};
        this.previousAssignment = {};

        // "scanning" : on cherche les 5 pastilles, "confirm" : on montre le réglage deviné,
        // "fixing" : les joueurs le corrigent, "ready" : le labyrinthe est en jeu.
        this.scannerState = "scanning";
        this.stableFrames = 0;

        this.prepareCountdownRing();
    }

    /**
     * The ring is drawn with a dash as long as the whole circle : moving the dash offset empties it.
     */
    prepareCountdownRing() {
        if (!this.ringElement) return;

        const radius = this.ringElement.r.baseVal.value;
        this.ringLength = 2 * Math.PI * radius;

        this.ringElement.style.strokeDasharray = this.ringLength;
        this.ringElement.style.strokeDashoffset = 0;
    }

    /**
     * Draws the walls once, then adds the character on top of the grid.
     */
    buildMaze(maze) {
        if (!this.gridElement) {
            console.log("DEBUG PanelColors : la grille du labyrinthe est introuvable");
            return;
        }

        this.gridElement.innerHTML = "";
        this.gridElement.style.gridTemplateColumns = `repeat(${maze.cols}, var(--maze-cell))`;

        for (let row = 0; row < maze.rows; row++) {
            for (let col = 0; col < maze.cols; col++) {
                const cell = document.createElement("div");
                cell.className = "maze-cell " + this.classOfCell(maze.grid[row][col]);
                this.gridElement.appendChild(cell);
            }
        }

        // Un élément par personnage : le modèle décide combien il y en a, l'affichage suit.
        this.characterElements = {};

        for (const character of maze.characters) {
            const element = document.createElement("div");
            element.className = `maze-character ${character.name}`;

            this.gridElement.appendChild(element);
            this.characterElements[character.name] = element;
        }

        this.renderMaze(maze);
    }

    classOfCell(symbol) {
        if (symbol === MAZE_SYMBOLS.WALL) return "wall";
        if (symbol === MAZE_SYMBOLS.EXIT) return "exit";
        if (symbol === MAZE_SYMBOLS.START) return "start";
        if (symbol === MAZE_SYMBOLS.START_GREY) return "start";
        if (symbol === MAZE_SYMBOLS.SWITCH) return "switch";
        if (symbol === MAZE_SYMBOLS.GATE) return "gate";
        if (symbol === MAZE_SYMBOLS.TREASURE) return "treasure";
        if (symbol === MAZE_SYMBOLS.FLOOR) return "floor";

        console.error("DEBUG : le symbole de la class Cell n'ait pas reconnu");
        return; //should never happen but it case it does js so this should still work anyways
    }

    /**
     * Replace chaque personnage, met en avant celui qui répond aux commandes, et ouvre la grille
     * une fois l'interrupteur activé. Appelée après chaque action.
     */
    renderMaze(maze) {
        for (const character of maze.characters) {
            const element = this.characterElements?.[character.name];
            if (!element) continue;

            const { row, col } = character.position;
            // en multiples de --maze-cell : les personnages suivent automatiquement la taille des cases
            element.style.transform =
                `translate(calc(var(--maze-cell) * ${col}), calc(var(--maze-cell) * ${row}))`;

            //l'anneau autour du personnage actif est le seul indice de qui obéit aux couleurs
            element.classList.toggle("active", character === maze.activeCharacter);
        }

        this.gridElement.classList.toggle("gate-open", maze.switchActivated);
    }

    /**
     * One chip per color used by the enigma. It does NOT tell what the color does, only whether the camera sees it.
     */
    buildChips(colorsUsed) {
        if (!this.chipsElement) return;

        this.chipsElement.innerHTML = "";
        this.chips = {};

        for (const color of colorsUsed) {
            const chip = document.createElement("div");
            chip.className = "color-chip";

            const dot = document.createElement("span");
            dot.className = "color-chip-dot";
            dot.style.backgroundColor = COLOR_SWATCHES[color] ?? "#9e9e9e";

            const label = document.createElement("span");
            label.textContent = color;

            chip.append(dot, label);
            this.chipsElement.appendChild(chip);
            this.chips[color] = chip;
        }
    }

    /**
     * A chip goes dim as soon as the camera stops seeing its circle : that is the only live feedback
     * the players get about what the machine understands.
     */
    updateColorsDetected(colorsSeen) {
        const seen = (colorsSeen instanceof Set) ? colorsSeen : new Set();

        for (const [color, chip] of Object.entries(this.chips)) {
            chip.classList.toggle("masked", !seen.has(color));
        }
    }

    // ===================== Le réglage des couleurs =====================
    //
    // Le panneau ne connaît pas la détection : il reçoit des fonctions et se contente de montrer
    // ce qu'elles rendent. C'est ColorsEnigma qui les relie au ColorsRecognizer.

    /**
     * @param {{onFreeze: Function, onApply: Function, onReset: Function, onValidate: Function,
     *          onRestart: Function}} actions
     *        onFreeze rend {count, guess}, onApply reçoit un nom de couleur -> numéro de cercle
     */
    connectCalibration(actions) {
        this.calibration = actions;

        this.adjustButton?.addEventListener("click", () => this.restartScanner());
        this.resetButton?.addEventListener("click", () => this.resetCalibration());
        this.validateButton?.addEventListener("click", () => this.validateCalibration());
        this.fixButton?.addEventListener("click", () => this.fixCalibration());
    }

    /**
     * L'état décide de tout ce qui se voit : le labyrinthe n'apparaît qu'une fois le scanner
     * validé, et chaque bouton n'est là qu'au moment où il veut dire quelque chose.
     */
    setScannerState(state) {
        this.scannerState = state;

        if (this.mazeLayout) this.mazeLayout.hidden = (state !== "ready");
        if (this.calibrationRows) this.calibrationRows.hidden = (state === "scanning" || state === "ready");

        if (this.adjustButton) this.adjustButton.hidden = (state !== "ready");
        if (this.resetButton) this.resetButton.hidden = (state !== "ready");
        if (this.validateButton) this.validateButton.hidden = (state === "scanning" || state === "ready");
        if (this.fixButton) this.fixButton.hidden = (state !== "confirm");
    }

    /**
     * Retour à la recherche des pastilles. Le labyrinthe disparaît
     */
    restartScanner() {
        this.calibration.onRestart();

        this.stableFrames = 0;
        this.setScannerState("scanning");
        this.showCalibration("");
    }

    /**
     * Appelée à chaque image tant que le scanner n'est pas réglé.
     */
    updateScanner(circlesCount) {
        if (this.scannerState !== "scanning") return;

        if (circlesCount !== CIRCLES_EXPECTED) {
            this.stableFrames = 0;
            this.setCalibrationMessage(`Initialisation du scanner : ${circlesCount} cercles sur `
                + `${CIRCLES_EXPECTED} détectés. Les 5 cercles de couleurs doivent être visibles, et eux seuls.`);
            return;
        }

        this.stableFrames++;

        if (this.stableFrames >= STABLE_FRAMES) this.freezeCalibration();
    }

    /**
     * Fige l'image et applique le réglage deviné : les joueurs n'ont plus qu'à dire s'il est juste.
     */
    freezeCalibration() {
        const { count, guess } = this.calibration.onFreeze();

        if (count !== CIRCLES_EXPECTED) { //l'image a changé entre-temps : on repart en recherche
            this.stableFrames = 0;
            return;
        }

        this.setScannerState("confirm");
        this.showCalibration("Scanner en cours de calibration. Chaque couleur affiche-t-elle bien le numéro écrit sur son cercle ?",
            guess);

        this.calibration.onApply(guess);
    }

    /**
     */
    fixCalibration() {
        this.setScannerState("fixing");
        this.showCalibration("Donnez à chaque couleur le numéro écrit sur son cercle, puis validez.",
            this.previousAssignment, true);
    }

    /**
     * Les teintes d'origine, et retour à la case départ
     */
    resetCalibration() {
        this.calibration.onReset();
        this.restartScanner();
    }

    /**
     * Termine le réglage : les cercles figés et leurs numéros laissent la place au flux vivant,
     * et le labyrinthe apparaît.
     */
    validateCalibration() {
        this.calibration.onValidate();

        this.setScannerState("ready");
        this.showCalibration(""); // we delete the message writed previously
    }

    setCalibrationMessage(message) {
        if (this.calibrationMessage) this.calibrationMessage.textContent = message;
    }

    /**
     * The list of colors and the message about the calibration
     *
     * @param {Object<string, number>} [assignment] - sans lui, la liste est simplement vidée
     * @param {boolean} [editable] - les numéros sont lus seulement, sauf pendant une correction
     */
    showCalibration(message, assignment, editable = false) {
        this.setCalibrationMessage(message);
        if (!this.calibrationRows) return;

        this.calibrationRows.innerHTML = "";
        this.calibrationSelects = {};
        this.previousAssignment = { ...assignment };

        for (const [color, circleIndex] of Object.entries(assignment ?? {})) {
            this.calibrationRows.appendChild(this.buildCalibrationRow(color, circleIndex, editable));
        }
    }

    buildCalibrationRow(color, circleIndex, editable) {
        const row = document.createElement("label");
        row.className = "calibration-row";

        const dot = document.createElement("span");
        dot.className = "color-chip-dot";
        dot.style.backgroundColor = COLOR_SWATCHES[color] ?? "#9e9e9e";

        const name = document.createElement("span");
        name.className = "calibration-name";
        name.textContent = color;

        const number = editable ? this.buildCircleSelect(color, circleIndex) : this.buildCircleLabel(circleIndex);

        row.append(dot, name, number);

        return row;
    }

    /**
     * Le numéro deviné, simplement affiché : il n'y a qu'à le comparer au cercle sur la table.
     */
    buildCircleLabel(circleIndex) {
        const label = document.createElement("span");
        label.className = "calibration-number";
        label.textContent = `Cercle ${circleIndex + 1}`;

        return label;
    }

    buildCircleSelect(color, circleIndex) {
        const select = document.createElement("select");
        select.className = "calibration-select";

        for (let index = 0; index < CIRCLES_EXPECTED; index++) {
            const option = document.createElement("option");
            option.value = index;
            option.textContent = `Cercle ${index + 1}`;
            select.appendChild(option);
        }

        select.value = circleIndex;
        select.addEventListener("change", () => this.changeCalibration(color));

        this.calibrationSelects[color] = select;

        return select;
    }

    /**
    * 2 colors can't have the same circle, if we change a color, the circle having previously
    * this color switches to the color now without any circle (not really understandable probably
    * but you know there should be no one reading this anyways)
     */
    changeCalibration(changedColor) {
        const chosen = this.calibrationSelects[changedColor].value;

        for (const [color, select] of Object.entries(this.calibrationSelects)) {
            if (color !== changedColor && select.value === chosen) {
                select.value = this.previousAssignment[changedColor];
            }
        }

        const assignment = {};

        for (const [color, select] of Object.entries(this.calibrationSelects)) {
            assignment[color] = Number(select.value);
        }

        this.previousAssignment = assignment;
        this.calibration.onApply(assignment);
    }

    updateCountdown(remainingRatio, secondsLeft) {
        if (this.ringElement) {
            this.ringElement.style.strokeDashoffset = this.ringLength * (1 - remainingRatio);
        }
        if (this.countdownValue) {
            this.countdownValue.textContent = secondsLeft;
        }
    }

    showMoved() {
        this.showFeedback("Action enregistrée.", "moved");
    }

    showBlocked() {
        this.showFeedback("Un mur bloque le passage.", "blocked");
    }

    /**
     * On nomme les couleurs cachées plutôt que d'en donner le nombre : si une action ne part pas,
     * ce message dit immédiatement quel cercle la caméra ne voit pas, sans avoir à chercher.
     */
    showNoAction(hiddenColors) {
        this.showFeedback(`Aucune action effectuée`, "none");
    }

    showNoEffect(color) {
        this.showFeedback(`${color} : couleur non utilisée pour l'instant.`, "none");
    }

    /**
     * Le seul message en vert du labyrinthe
     */
    showCharacterChanged(characterName) {
        const label = (characterName === "grey") ? "gris" : "blanc";
        this.showFeedback(`Vous contrôlez maintenant le personnage ${label}.`, "character");
    }

    showSwitchActivated() {
        this.showFeedback("Interrupteur activé : la grille s'ouvre !", "victory");
    }

    showLevelComplete(nextLevelNumber) {
        this.showFeedback(`Niveau réussi ! Passage au labyrinthe ${nextLevelNumber}.`, "victory");
    }

    showVictory() {
        this.showFeedback("Sortie atteinte !", "victory");
    }

    showFeedback(text, classe) {
        if (!this.feedbackElement) return;

        this.feedbackElement.textContent = text;
        this.feedbackElement.className = `maze-feedback ${classe}`;
    }
}
