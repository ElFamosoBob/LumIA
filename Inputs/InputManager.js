import { VisionController } from './Controller/VisionController.js';
import { KeyboardController } from './Controller/KeyboardController.js';
class InputManager {
    constructor() {
        // On récupère les éléments HTML ici pour les donner à la Vision
        const videoElement = document.getElementById("webcam");
        const canvasElement = document.getElementById("mp_canvas");

        this.vision = new VisionController(videoElement, canvasElement);
        this.keyboard = new KeyboardController();
    }

    // Démarre tous les capteurs
    async init() {
        console.log("InputManager : Lancement des capteurs...");
        const isVisionReady = await this.vision.init();
        return isVisionReady;
    }

    toggleWebcam() {
        return this.vision.toggleWebcam();
    }

    /**
     * True once the camera actually delivers images, false again if it is unplugged. This is the
     * real state to check before starting a mission, rather than the disabled attribute of a
     * button, which the browser may restore wrongly on reload.
     */
    isWebcamRunning() {
        return this.vision.webcamRunning;
    }


    update(tabId) {
        this.vision.update(tabId);
    }

    getState() {
        return this.vision.getResults();
    }
}

const inputManagerInstance = new InputManager();
export default inputManagerInstance;