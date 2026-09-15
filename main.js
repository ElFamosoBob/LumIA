import gameEngineInstance from './GameLogic/GameEngine.js';
import uiManagerInstance from './UI/UIManager.js';
import inputManagerInstance from './Inputs/InputManager.js';

/**
 * The start-up sequence of the whole game :
 *
 *   1. page loaded     → the engine loads OpenCV and MediaPipe, then enables the camera button
 *   2. camera button   → the browser asks for the camera ; once images arrive, the start button
 *                        is enabled
 *   3. start button    → the engine starts (restoring a saved game if there is one), and the
 *                        interface leaves the welcome screen
 */
window.addEventListener("DOMContentLoaded", async () => {

    await gameEngineInstance.init();

    const btnCamera = document.getElementById("cameraButton");
    const btnStart = document.getElementById("startButton");

    // { once: true } : le bouton disparaît après ce clic (showWebcamFeed), on n'écoute donc plus rien
    btnCamera.addEventListener("click", async () => {
        uiManagerInstance.startButton.showWebcamFeed();

        // Le bouton de démarrage ne s'active qu'une fois la caméra réellement affichée
        // (frame décodée), pas dès la simple demande d'accès.
        const isWebcamReady = await inputManagerInstance.toggleWebcam();
        if (isWebcamReady) {
            uiManagerInstance.startButton.enableStartButton();
        }
    }, { once: true });

    // ONE listener for both halves of the start, armed once. 
    btnStart.addEventListener("click", () => {

        if (!inputManagerInstance.isWebcamRunning()) return;

        // The welcome screen is gone after the first start, but a quick double click could
        // otherwise reach here twice and replay the transition.
        if (gameEngineInstance.isRunning) return;

        gameEngineInstance.start();
        uiManagerInstance.leaveWelcomeScreen();
    });
});
