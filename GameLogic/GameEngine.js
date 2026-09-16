import inputManagerInstance from '../Inputs/InputManager.js';
import uiManagerInstance from '../UI/UIManager.js';
import { LsfEnigma } from './Enigmas/LsfEnigma.js';
import { ArucoEnigma } from './Enigmas/ArucoEnigma.js';
import { ColorsEnigma } from './Enigmas/ColorsEnigma.js';
import { GuiltyEnigma } from './Enigmas/GuiltyEnigma.js';
import { FinalEnigma } from './Enigmas/FinalEnigma.js';
import { ENIGMA_IDS } from '../Utils/Constant.js';
import { Timer } from './Timer.js';
import progressionInstance from './Progression.js';


import { showError } from '../UI/AlertManager.js';
import { showRewardAlert } from '../UI/AlertManager.js';

import { initOpenCV } from '../Utils/LibraryLoading/LoadOpenCV.js';

import { saveProgress, loadProgress, clearProgress } from '../Utils/SaveManager.js';


// The two ways a running game can end. Both stop the loop and drop the save ; only the defeat
// takes the interface away (see endGame).
const GAME_OUTCOME = {
    WON: 'won',
    LOST: 'lost'
};


class GameEngine {
    constructor() {
        // 2. État global du jeu
        this.dictionnaryOfEnigmas = {};

        // 2. LE POOL ACTIF (Uniquement les énigmes que le joueur est en train de résoudre)
        this.activeEnigmas = [];

        this.isRunning = false;
        this.isTransitioning = false;

        this.timer = new Timer(() => this.handleTimeOver());

        //to lower the fps rendering : the loop is capped to
        this.fpsTarget = 10;
        this.frameInterval = 1000 / this.fpsTarget;
        this.lastFrameTime = 0;
    }

    // asynchronous initialisation (async waits for the files to load instead of interpreting the lines of code without stopping)
    async init() {
        console.log("⚙️ GameEngine: Initialisation automatique du moteur...");
        uiManagerInstance.startButton.updateCameraButton(false); // Bouton disabled "ATTENTE..."

        // we init OpenCV in the global init function because it in 2 enigmas. Mediapipe is loaded in LsfRecognizer because it used only there
        //I may change that and load all the librairies here but for the moment it is this way

        //WE INITIATE BEFORE InputManager BECAUSE inputManagerInstance initiate visionController, which initiate Colors which used OpenCV 
        //(Aruco is also initiated by visionController but it's spaghetti code so it works anyway, his init for the moment is... questionnable)
        try {
            await initOpenCV();
        } catch (error) {
            console.error("🚨 Échec d'OpenCV.", error);
            return;
        }

        const inputsReady = await inputManagerInstance.init();

        if (!inputsReady) {
            console.error("🚨 GameEngine: Échec de l'IA.");
            showError("Erreur fatale de l'IA. Vérifiez la console.");
            return;
        }

        this.loadEnigmas();

        console.log("✅ GameEngine: Modèles IA chargés. Le bouton est actif !");
        uiManagerInstance.hideLoading();
        uiManagerInstance.startButton.updateCameraButton(true); // We make the camera button ready
    }

    //here we load all the enigmas in the list IN ORDER
    loadEnigmas() {
        const lsf = new LsfEnigma();
        const aruco = new ArucoEnigma();
        const colors = new ColorsEnigma();
        const guilty = new GuiltyEnigma();
        const final = new FinalEnigma();

        this.dictionnaryOfEnigmas[lsf.id] = lsf;
        this.dictionnaryOfEnigmas[aruco.id] = aruco;
        this.dictionnaryOfEnigmas[colors.id] = colors;
        this.dictionnaryOfEnigmas[guilty.id] = guilty;
        this.dictionnaryOfEnigmas[final.id] = final;

        console.log(`GameEngine: ${Object.keys(this.dictionnaryOfEnigmas).length} énigmes chargées dans le dictionnaire.`);

    }

    // Le bouton "Play"
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log("🎮 GameEngine: Démarrage de la boucle principale.");

        //s'il y a une sauvegarde (page rechargée en cours de partie), on repart de là où l'équipe en était
        const save = loadProgress();

        this.timer.start(save ? save.timerStartTime : null);

        if (save) {
            this.restoreProgress(save);
        } else {
            progressionInstance.unlock(ENIGMA_IDS.ARUCO);
            this.putEnigmaIntoTheActivePool(ENIGMA_IDS.ARUCO);
        }

        this.saveProgress();


        this.lastFrameTime = 0; // 0 so that the very first frame is never skipped
        requestAnimationFrame((now) => this.loop(now));
    }

    /**
     * Unlocks an enigma : records it in the Progression, shows its tab button, and starts running
     * its logic. The three always go together, which is why there is a single entry point.
     *
     * @param {string} idEnigma
     * @param {boolean} animated - false for the cheat code and for a restored game
     */
    activateEnigma(idEnigma, animated = true) {
        progressionInstance.unlock(idEnigma);

        if (animated) {
            uiManagerInstance.unlockNewTabWithAnimations(idEnigma);
        } else {
            uiManagerInstance.unlockNewTabWithoutAnimations(idEnigma);
        }

        this.putEnigmaIntoTheActivePool(idEnigma);
        this.saveProgress();
    }

    /**
     * Writes the state of the game into the browser. Called every time the game moves forward.
     */
    saveProgress() {
        if (!this.isRunning) return; //partie pas commencée, ou déjà finie : rien à sauvegarder

        saveProgress(progressionInstance.toSave(this.timer.startTime));
    }

    /**
     * Puts the game back the way the team left it : tabs unlocked (orange) or resolved (green),
     * and every enigma still to be done back in the active pool.
     *
     * No animation here : we do not replay cinematics the team has already seen.
     *
     * @param {object} save - ce que loadProgress() a retrouvé
     */
    restoreProgress(save) {
        console.log("💾 GameEngine : progression retrouvée, reprise de la partie.");

        progressionInstance.restore(save);

        //the navigation bar redoes itself from the progression
        uiManagerInstance.tabManager.showProgression();

        for (const id of progressionInstance.unlockedIds()) {
            //an enigma still to be done has to run again ; a resolved one shows its victory panel
            if (!progressionInstance.isResolved(id)) {
                this.putEnigmaIntoTheActivePool(id);
            }
        }
    }

    putEnigmaIntoTheActivePool(idEnigma) {
        const enigma = this.dictionnaryOfEnigmas[idEnigma];
        if (enigma && !this.activeEnigmas.includes(enigma)) {
            enigma.start(); // S'il y a des choses à initialiser dans la classe
            this.activeEnigmas.push(enigma);
            console.log(`▶️ Énigme [${idEnigma}] ajoutée au pool actif.`);
            this.saveProgress();
        } else if (!enigma) {
            //normal for an enigma whose tab exists but whose logic is not written yet (the final one for instance)
            console.log(`DEBUG : l'énigme [${idEnigma}] n'a pas de classe, seul son onglet est déverrouillé.`);
        } else {
            console.log(`DEBUG : l'énigme [${idEnigma}] est déjà dans le pool actif.`);
        }
    }

    // The main loop, heartbeat of the program
    // capped at this.fpsTarget : requestAnimationFrame follows the screen (60Hz, 120Hz...), so we skip the frames coming too early
    loop(now) {
        if (!this.isRunning) return;
        requestAnimationFrame((timestamp) => this.loop(timestamp));

        const elapsed = now - this.lastFrameTime;
        if (elapsed < this.frameInterval) return; // too early : this frame is skipped

        // we do not store "now" directly : keeping the remainder avoids drifting away from the target fps
        this.lastFrameTime = now - (elapsed % this.frameInterval);

        if (this.isTransitioning) return;

        // Only the enigma the team is actually looking at is updated
        const openTabId = uiManagerInstance.tabManager.activeTabId;

        for (const enigma of this.activeEnigmas) {
            if (enigma.id === openTabId) enigma.update();
        }
    }


    /**
     * Records an enigma as resolved, then everything that follows from it : the success animation,
     * the enigmas it unlocks, the physical object the team has just earned, and the two checks
     * that may end the game.
     *
     * @param {string} idEnigma
     * @param {Array<string>} enigmasToUnlock - the next links of the chain, if any
     * @param {boolean} skipAnimations - cheat code : the pop-ups and the unlocking, no cinematic
     */
    completeEnigma(idEnigma, enigmasToUnlock = [], skipAnimations = false) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        // The Progression is what says whether this was already done
        if (progressionInstance.isResolved(idEnigma)) {
            console.log(`DEBUG GameEngine.completeEnigma : enigma '${idEnigma}' is already resolved`);
            this.isTransitioning = false;
            return;
        }

        progressionInstance.markResolved(idEnigma);

        uiManagerInstance.tabManager.showResolved(idEnigma);

        this.activeEnigmas = this.activeEnigmas.filter(enigme => enigme.id !== idEnigma);

        //Les animations qui suivent partagent une file d'attente : elles se jouent l'une après
        //l'autre, dans l'ordre où on les demande ici, sans bloquer la suite de cette fonction.
        if (!skipAnimations) {
            uiManagerInstance.animations.launchSuccessAnimation(); //toujours, que l'énigme débloque quelque chose ou non
        }

        enigmasToUnlock.forEach(nextId => this.activateEnigma(nextId, !skipAnimations));

        this.grantPhysicalRewardOf(idEnigma);

        this.cleanMemory(this.dictionnaryOfEnigmas[idEnigma]);

        this.tryUnlockGuiltyEnigma(); //an enigma has just been resolved, maybe it was the LSF one that need to be done to unlock GuiltyEnigma

        this.checkFinalVictory();

        this.saveProgress();

        this.isTransitioning = false;
    }

    /**
     * Signale l'objet physique gagné, s'il y en a un. Passe par la file des animations pour que
     * l'alerte s'affiche APRÈS les cinématiques, et non par-dessus. Comme showRewardAlert ne se
     * résout qu'au clic du joueur, la file attend naturellement qu'il ait fermé l'alerte.
     */
    grantPhysicalRewardOf(idEnigma) {
        const reward = this.dictionnaryOfEnigmas[idEnigma]?.irlReward;
        if (!reward) return;

        uiManagerInstance.animations.enqueue(() => showRewardAlert(reward));
    }

    /**
     * Called by the chatbot the moment it announces a single culprit ("Le coupable est Antoine ").
     */
    notifyChatbotFoundCulprit() {
        progressionInstance.markChatbotFoundCulprit();
        this.saveProgress();
        this.tryUnlockGuiltyEnigma();
    }

    /**
     * Asked again every time one of the two conditions of the accusation becomes true : the rule
     * itself lives in the Progression, since it is a question about how far the team has got.
     */
    tryUnlockGuiltyEnigma() {
        if (!progressionInstance.shouldUnlockGuilty()) return;

        this.activateEnigma(ENIGMA_IDS.GUILTY);
    }

    /**
     * The game is over once the final enigma is solved : it is the last one of the chain.
     */
    checkFinalVictory() {
        if (!progressionInstance.isGameWon()) return;

        this.endGame(GAME_OUTCOME.WON);
    }

    /**
     * The countdown reached zero : the game is lost.
     */
    handleTimeOver() {
        this.endGame(GAME_OUTCOME.LOST);
    }

    /**
     * The single way out of a running game, whichever way it ends. Stopping the main loop means
     * no enigma is updated any more, and the save is dropped so the next team starts fresh.
     *
     * Winning deliberately leaves the interface alone — the team is meant to be able to revisit
     * the tabs it has solved. Losing, on the other hand, takes everything away : the defeat screen
     * hides the tab buttons so there is nothing left to do.
     *
     * @param {string} outcome - GAME_OUTCOME.WON or GAME_OUTCOME.LOST
     */
    endGame(outcome) {
        if (!this.isRunning) {
            console.log("DEBUG : endGame appelé alors que le jeu ne tourne pas");
            return;
        }

        this.isRunning = false;
        this.timer.stop(); //we stop the timer so that players know what time they took

        clearProgress();

        if (outcome === GAME_OUTCOME.LOST) {
            uiManagerInstance.tabManager.showDefeatScreen();
        }
    }

    cleanMemory(enigmaToComplete) {
        if (enigmaToComplete && typeof enigmaToComplete.cleanOfMemory === 'function') {
            enigmaToComplete.cleanOfMemory();
        } else {
            console.log("DEBUG : le nettoyage de l'énigme n'a pas marché (soit l'énigme n'existe plus soit cleanOfMemory n'est pas une fonction");
        }
    }


}

const gameEngineInstance = new GameEngine();
export default gameEngineInstance;