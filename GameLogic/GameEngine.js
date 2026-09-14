import inputManagerInstance from '../Inputs/InputManager.js';
import uiManagerInstance from '../UI/UIManager.js';
import { LsfEnigma } from './Enigmas/LsfEnigma.js';
import { ArucoEnigma } from './Enigmas/ArucoEnigma.js';
import { ColorsEnigma } from './Enigmas/ColorsEnigma.js';
import { GuiltyEnigma } from './Enigmas/GuiltyEnigma.js';
import { FinalEnigma } from './Enigmas/FinalEnigma.js';
import { ENIGMA_STATUS } from '../Utils/Constant.js';
import { ENIGMA_IDS } from '../Utils/Constant.js';
import { Timer } from './Timer.js';


import { showError } from '../UI/AlertManager.js';
import { showDefeatScreen } from '../UI/AlertManager.js';
import { showRewardAlert } from '../UI/AlertManager.js';

import { initOpenCV } from '../Utils/LibraryLoading/LoadOpenCV.js';

import { saveProgress, loadProgress, clearProgress } from '../Utils/SaveManager.js';


class GameEngine {
    constructor() {
        // 2. État global du jeu
        this.dictionnaryOfEnigmas = {};

        // 2. LE POOL ACTIF (Uniquement les énigmes que le joueur est en train de résoudre)
        this.activeEnigmas = [];

        this.isRunning = false;
        this.isTransitioning = false;

        //first of the two conditions unlocking the guilty enigma, the second one being the LSF enigma resolved
        this.chatbotHasFoundCulprit = false;

        this.timer = new Timer(() => this.handleTimeOver());

        //to lower the fps rendering : the loop is capped
        this.fpsTarget = 10;
        this.frameInterval = 1000 / this.fpsTarget;
        this.lastFrameTime = 0;
    }

    // asynchronous initialisation (async waits for the files to load instead of interpreting the lines of code without stopping)
    async init() {
        console.log("⚙️ GameEngine: Initialisation automatique du moteur...");
        uiManagerInstance.startButton.updateCameraButton(false, false); // Bouton disabled "ATTENTE..."

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
        uiManagerInstance.startButton.updateCameraButton(false, true); // We make the camera button ready
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
            this.putEnigmaIntoTheActivePool(ENIGMA_IDS.ARUCO); //we let the logic of the UI, (so that the buttons of the tabs does not show in the animation)
        }

        this.saveProgress();


        this.lastFrameTime = 0; // 0 so that the very first frame is never skipped
        requestAnimationFrame((now) => this.loop(now));
    }

    /**
     *  Add an enigma to the active pool of enigmas with an animation
     */
    activateEnigmaWithAnimation(idEnigma) {
        uiManagerInstance.unlockNewTabWithAnimations(idEnigma);
        this.putEnigmaIntoTheActivePool(idEnigma);
    }

    /**
    * Add an enigma to the active pool of enigmas. The Ui part shows the button of the enigma while the rest is the game logic which activates the logic of the game (not ui realted)
    */
    activateEnigmaWithoutAnimation(idEnigma) {
        uiManagerInstance.unlockNewTabWithoutAnimations(idEnigma);
        this.putEnigmaIntoTheActivePool(idEnigma);
    }

    /**
     * Écrit dans le navigateur l'état de la partie : le statut de chaque onglet suffit à savoir
     * ce qui est débloqué et ce qui est résolu. Appelée à chaque fois que la partie avance.
     */
    saveProgress() {
        if (!this.isRunning) return; //partie pas commencée, ou déjà finie : rien à sauvegarder

        const tabsStatus = {};
        Object.entries(uiManagerInstance.tabManager.tabs).forEach(([id, tab]) => {
            tabsStatus[id] = tab.status;
        });

        saveProgress({
            tabs: tabsStatus,
            timerStartTime: this.timer.startTime,
            chatbotHasFoundCulprit: this.chatbotHasFoundCulprit
        });
    }

    /**
     * Remet la partie dans l'état sauvegardé : onglets débloqués (orange) ou résolus (vert),
     * énigmes résolues marquées comme telles, et les autres remises dans le pool actif.
     * Aucune animation ici : on ne rejoue pas les cinématiques déjà vues.
     * @param {object} save - ce que loadProgress() a retrouvé
     */
    restoreProgress(save) {
        console.log("💾 GameEngine : progression retrouvée, reprise de la partie.");

        Object.entries(save.tabs).forEach(([idTab, status]) => {
            const tab = uiManagerInstance.tabManager.tabs[idTab];
            if (!tab || status === ENIGMA_STATUS.LOCKED) return;

            tab.unlockTab(); //l'onglet redevient visible (orange)

            if (status === ENIGMA_STATUS.RESOLVED) {
                tab.makeTabCompleted(); //puis vert, et son panneau de victoire remplace le panneau normal

                const enigma = this.dictionnaryOfEnigmas[idTab];
                if (enigma) enigma.isResolved = true;
            } else {
                this.putEnigmaIntoTheActivePool(idTab); //énigme encore à faire : elle doit tourner
            }
        });

        this.chatbotHasFoundCulprit = save.chatbotHasFoundCulprit === true;
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

        if (!this.isTransitioning) {
            this.activeEnigmas.forEach(currentEnigma => {
                const tab = uiManagerInstance.tabManager.tabs[currentEnigma.id];

                if (tab && tab.activeOrNot === true) { // we update only if the tab is active (id est open)
                    if (!currentEnigma.isResolved) {
                        currentEnigma.update();

                    } else if (currentEnigma.isResolved) { // else if for security you never know in javascript

                        this.completeEnigma(currentEnigma.id);

                    }
                } else if (!tab) {
                    console.log("GameEngine DEBUG : tab n'a pas été trouvé");
                }
            });
        }
    }


    /** 
    * Change the status of an enigma toENIGMA_STATUS.RESOLVED, shows the button of the eventual enigmas unlocked, clean the memory of the old Enigma, check if we are in the good enigma to unlock the terminal and check if we are finished and we can display the victory button
    * @param {string} idEnigma
    */
    completeEnigma(idEnigma, enigmasToUnlock = [], skipAnimations = false) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        const tabCompleted = uiManagerInstance.tabManager.tabs[idEnigma];

        // Security
        if (!tabCompleted || tabCompleted.status === ENIGMA_STATUS.RESOLVED) {
            console.log(`DEBUG GameEngine, completeEnigma : tabCompleted : ${tabCompleted} et tabCompleted.status : ${tabCompleted.status}`);
            this.isTransitioning = false;
            return;
        }

        // We change the status to resolved for the tab (and completed for the button of the tab, which changes its color to green)
        tabCompleted.makeTabCompleted();


        this.activeEnigmas = this.activeEnigmas.filter(enigme => enigme.id !== idEnigma);

        //Les animations qui suivent partagent une file d'attente : elles se jouent l'une après
        //l'autre, dans l'ordre où on les demande ici, sans bloquer la suite de cette fonction.
        //skipAnimations : cas du cheat code, on veut juste les pop-ups et le déblocage, sans cinématique
        if (!skipAnimations) {
            uiManagerInstance.animations.launchSuccessAnimation(); //toujours, que l'énigme débloque quelque chose ou non
        }

        enigmasToUnlock.forEach(nextId => {
            if (skipAnimations) {
                this.activateEnigmaWithoutAnimation(nextId);
            } else {
                this.activateEnigmaWithAnimation(nextId);
            }
        });

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
     * Called by the chatbot the moment it announces a single culprit ("Le coupable est: ").
     */
    notifyChatbotFoundCulprit() {
        this.chatbotHasFoundCulprit = true;
        this.saveProgress();
        this.tryUnlockGuiltyEnigma();
    }

    /**
     * The guilty enigma needs TWO conditions : the LSF enigma resolved AND the chatbot having announced a culprit.
     * They can happen in any order, so we check both again each time one of them becomes true.
     */
    tryUnlockGuiltyEnigma() {
        const guiltyTab = uiManagerInstance.tabManager.tabs[ENIGMA_IDS.GUILTY];

        if (!guiltyTab || guiltyTab.status !== ENIGMA_STATUS.LOCKED) return; // already unlocked, nothing to do

        if (!this.chatbotHasFoundCulprit) return;

        const lsf = this.dictionnaryOfEnigmas[ENIGMA_IDS.LSF];
        if (!lsf || !lsf.isResolved) return;

        this.activateEnigmaWithAnimation(ENIGMA_IDS.GUILTY);
    }

    /**
     * The game is over once the final enigma is solved : it is the last one of the chain.
     */
    checkFinalVictory() {
        const final = this.dictionnaryOfEnigmas[ENIGMA_IDS.FINAL];

        if (!final || !final.isResolved) return;

        this.isRunning = false;

        this.timer.stop(); //partie gagnée : le chrono se fige sur le temps restant

        clearProgress(); //partie terminée : la prochaine équipe repart d'une page vierge
    }

    /**
     * Le compte à rebours est arrivé à zéro : la partie est perdue. On coupe la boucle principale
     * (plus aucune énigme n'est mise à jour) et on affiche l'écran de défaite, qui fait disparaître
     * les boutons des onglets pour qu'il n'y ait plus rien à faire.
     */
    handleTimeOver() {
        if (!this.isRunning) return; //la partie est déjà finie (victoire), on ne l'écrase pas

        this.isRunning = false;
        showDefeatScreen();

        clearProgress(); //partie terminée : la prochaine équipe repart d'une page vierge
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