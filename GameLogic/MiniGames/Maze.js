export const DIRECTIONS = {
    UP: 'up',
    DOWN: 'down',
    LEFT: 'left',
    RIGHT: 'right'
};

export const CHARACTERS = {
    WHITE: 'white',
    GREY: 'grey'
};

export const MAZE_SYMBOLS = {
    WALL: '#',
    FLOOR: '.',
    START: 'S',        // départ du blanc
    EXIT: 'E',         // objectif du blanc
    START_GREY: 'O',  // départ du gris
    SWITCH: 'I',       // interrupteur : ouvre la grille quand un personnage marche dessus
    GATE: 'G',         // grille : infranchissable tant que l'interrupteur est éteint
    TREASURE: 'T'      // objectif du gris
};

const MOVES = {
    [DIRECTIONS.UP]: { row: -1, col: 0 },
    [DIRECTIONS.DOWN]: { row: 1, col: 0 },
    [DIRECTIONS.LEFT]: { row: 0, col: -1 },
    [DIRECTIONS.RIGHT]: { row: 0, col: 1 }
};

/**
 * Pure model of the maze mini game : it knows the walls and where the characters stand, nothing about
 * the DOM nor about the colors used to control it. Les contrôles vivent dans ColorsEnigma, ce qui
 * permet de donner des commandes différentes à chaque personnage sans toucher à ce fichier.
 *
 * Tout est déduit du plan : un personnage n'existe que si le plan lui donne un départ, et il n'a un
 * objectif que si le plan contient la case correspondante. Un niveau à un seul personnage et un
 * niveau à deux utilisent donc exactement le même code.
 */
export class Maze {

    /**
     * @param {Array<string>} layout - one string per row, using MAZE_SYMBOLS
     */
    constructor(layout) {
        this.grid = layout.map(row => row.split(''));
        this.rows = this.grid.length;
        this.cols = this.grid[0].length;

        this.starts = {
            [CHARACTERS.WHITE]: this.findCell(MAZE_SYMBOLS.START),
            [CHARACTERS.GREY]: this.findCell(MAZE_SYMBOLS.START_GREY)
        };

        // Le blanc sort par la porte au niveau 1 ; au niveau 2 il n'a pas d'objectif à lui,
        // il sert seulement à ouvrir la voie au gris, qui vise le trésor.
        this.goals = {
            [CHARACTERS.WHITE]: this.findCell(MAZE_SYMBOLS.EXIT),
            [CHARACTERS.GREY]: this.findCell(MAZE_SYMBOLS.TREASURE)
        };

        this.switchCell = this.findCell(MAZE_SYMBOLS.SWITCH);

        if (!this.starts[CHARACTERS.WHITE]) console.log("DEBUG Maze : ce labyrinthe n'a pas de départ 'S'");

        this.reset();
    }

    /**
     * @returns {{row:number, col:number}|null} null si le symbole est absent de ce labyrinthe
     */
    findCell(symbol) {
        for (let row = 0; row < this.rows; row++) {
            const col = this.grid[row].indexOf(symbol);
            if (col !== -1) return { row, col };
        }

        return null;
    }

    reset() {
        // Un personnage n'existe que si le plan lui donne un point de départ
        this.characters = Object.values(CHARACTERS)
            .filter(name => this.starts[name])
            .map(name => ({ name, position: { ...this.starts[name] } }));

        this.activeIndex = 0;
        this.switchActivated = false;
        this.isFinished = false;
    }

    get activeCharacter() {
        return this.characters[this.activeIndex];
    }

    /**
     * Passe la main au personnage suivant.
     * @returns {object|null} le personnage désormais actif, null s'il n'y en a qu'un seul
     */
    changeCharacter() {
        if (this.characters.length < 2) return null;

        this.activeIndex = (this.activeIndex + 1) % this.characters.length;
        return this.activeCharacter;
    }

    isWall(row, col) {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return true; //outside of the grid

        const cell = this.grid[row][col];

        if (cell === MAZE_SYMBOLS.WALL) return true;
        if (cell === MAZE_SYMBOLS.GATE) return !this.switchActivated; //la grille barre le passage tant que l'interrupteur est éteint

        return false;
    }

    /**
     * Déplace le personnage ACTIF d'une case dans la direction donnée.
     * @returns {{moved:boolean, finished:boolean, switchJustActivated:boolean}} moved est faux quand un mur bloque
     */
    tryMove(direction) {
        const nothingHappened = { moved: false, finished: this.isFinished, switchJustActivated: false };

        if (this.isFinished) return nothingHappened;

        const move = MOVES[direction];
        if (!move) {
            console.log(`DEBUG Maze : la direction '${direction}' n'existe pas`);
            return nothingHappened;
        }

        const character = this.activeCharacter;
        const row = character.position.row + move.row;
        const col = character.position.col + move.col;

        if (this.isWall(row, col)) return nothingHappened;

        character.position = { row, col };

        const switchJustActivated = this.stepOnSwitch(row, col);
        this.isFinished = this.hasReachedGoal(character);

        return { moved: true, finished: this.isFinished, switchJustActivated };
    }

    stepOnSwitch(row, col) {
        if (!this.switchCell || this.switchActivated) return false;
        if (row !== this.switchCell.row || col !== this.switchCell.col) return false;

        this.switchActivated = true;
        return true;
    }

    hasReachedGoal(character) {
        const goal = this.goals[character.name];
        if (!goal) return false; //ce personnage n'a pas d'objectif, il ouvre seulement la voie

        return character.position.row === goal.row && character.position.col === goal.col;
    }
}
