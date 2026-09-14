import gameEngineInstance from './GameLogic/GameEngine.js';
import uiManagerInstance from './UI/UIManager.js';
import inputManagerInstance from './Inputs/InputManager.js';

// On attend que la page HTML soit dessinée
window.addEventListener("DOMContentLoaded", async () => {

    await gameEngineInstance.init();

    const btnCamera = document.getElementById("cameraButton");
    const btnStart = document.getElementById("startButton");

    // Un bouton pour allumer la caméra : le navigateur demande l'autorisation, puis on affiche
    // le flux pour que l'équipe cadre le plateau de jeu.
    // { once: true } : le bouton disparaît après ce clic (showWebcamFeed), on n'écoute donc plus rien
    btnCamera.addEventListener("click", async () => {
        uiManagerInstance.startButton.showWebcamFeed();

        // Le bouton de démarrage ne s'active qu'une fois la caméra réellement affichée
        // (frame décodée), pas dès la simple demande d'accès.
        const isWebcamReady = await inputManagerInstance.toggleWebcam();
        if (isWebcamReady) {
            uiManagerInstance.startButton.enableStartButton();
        }

        // Un bouton pour commencer le jeu : la caméra tourne déjà, il ne reste que la boucle à lancer.
        // (le UIManager écoute lui aussi ce clic, pour la transition hors de l'accueil)
        btnStart.addEventListener("click", () => {
            gameEngineInstance.start();
        });
    }, { once: true });
});
