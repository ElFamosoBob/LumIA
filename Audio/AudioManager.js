import { playTabUnlockingSound } from './Sounds/TabUnlockingSound.js';
import { playMysteriousSwell } from './Sounds/MysteriousSwell.js';
import { RisingHarmony } from './Sounds/RisingHarmony.js';
import { playUnlockChime } from './Sounds/UnlockChime.js';

/**
 * Point d'entrée unique de tout ce qui fait du son.
 *
 * Il possède LE contexte audio du jeu et le volume général : les sons, eux, ne font que décrire
 * ce qu'ils jouent et se branchent sur la sortie qu'on leur donne. Avant, chaque son créait son
 * propre AudioContext sans jamais le fermer, ce que les navigateurs finissent par refuser.
 */
class AudioManager {

    constructor() {
        this.ctx = null;
        this.master = null;

        this.volume = 0.8;

        this.crescendo = new RisingHarmony();

        this.waitForFirstGesture();
    }

    /**
     * Les navigateurs refusent de démarrer un contexte audio tant que l'utilisateur n'a pas
     * interagi avec la page. On crée donc le nôtre au premier geste, quel qu'il soit.
     */
    waitForFirstGesture() {
        const unlock = () => {
            this.getContext();

            if (!this.ctx || this.ctx.state !== 'running') return;

            document.removeEventListener('click', unlock);
            document.removeEventListener('keydown', unlock);
        };

        document.addEventListener('click', unlock);
        document.addEventListener('keydown', unlock);
    }

    /**
     * Crée le contexte à la première utilisation, et le réveille s'il a été suspendu.
     * @returns {AudioContext|null} null si le navigateur ne sait pas faire de Web Audio
     */
    getContext() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;

            if (!AudioContext) {
                console.log("DEBUG AudioManager : ce navigateur ne supporte pas la Web Audio API");
                return null;
            }

            this.ctx = new AudioContext();

            this.master = this.ctx.createGain();
            this.master.gain.value = this.volume;
            this.master.connect(this.ctx.destination);
        }

        if (this.ctx.state === 'suspended') this.ctx.resume();

        return this.ctx;
    }

    // --- Sons ponctuels ---

    playTabUnlocking() {
        const ctx = this.getContext();
        if (ctx) playTabUnlockingSound(ctx, this.master);
    }

    playMysteriousSwell() {
        const ctx = this.getContext();
        if (ctx) playMysteriousSwell(ctx, this.master);
    }

    playEnigmaSuccess() {
        const ctx = this.getContext();
        if (ctx) playUnlockChime(ctx, this.master);
    }

    // --- Son maintenu ---

    /**
     * Lance le crescendo, ou ne fait rien s'il tourne déjà : appelable à chaque frame.
     * @param {number} durationSeconds - le son doit culminer exactement à la fin de ce délai
     */
    startCrescendo(durationSeconds) {
        const ctx = this.getContext();
        if (ctx) this.crescendo.start(ctx, this.master, durationSeconds);
    }

    stopCrescendo() {
        this.crescendo.stop();
    }

}

//Singleton creation :
const audioManagerInstance = new AudioManager();
export default audioManagerInstance;
