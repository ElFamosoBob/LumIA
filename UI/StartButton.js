export class StartButton {

    constructor() {
        this.btnCamera = document.getElementById("cameraButton"); // allume la caméra
        this.btnStart = document.getElementById("startButton"); // lance la mission

        this.webcamContainer = document.getElementById("webcam-container");

        // Disabled again by code, not only by the HTML attribute : on a normal reload Firefox
        // restores the state a button had before, and would give back an active start button
        // from the previous game. The click handler in main.js checks the webcam anyway ; this
        // only keeps the button from looking clickable when it is not.
        if (this.btnStart) this.btnStart.disabled = true;
    }

    /**
     * Appelé au clic sur le bouton caméra. La balise <video> est en autoplay :
     * afficher son conteneur suffit à voir l'image, il n'y a rien à attendre.
     */
    showWebcamFeed() {
        this.webcamContainer.style.display = "block";

        //la caméra ne s'allume qu'une fois : on retire le bouton pour qu'un second clic ne l'éteigne pas
        if (this.btnCamera) this.btnCamera.style.display = "none";
    }

    /**
     * Appelé une fois que le flux caméra est réellement décodé et affiché
     * (VisionController.toggleWebcam résolu), pas seulement demandé.
     */
    enableStartButton() {
        this.btnStart.disabled = false; //la mission ne peut partir qu'une fois la caméra allumée
    }

    /**
 * Modifies the visuel state of the camera button depending or wheter or not it is activated
 * (c'est le bouton caméra qui attend l'IA : c'est par lui que l'accueil commence)
 */
    updateCameraButton(isReady = true) {
        if (!isReady) {
            this.btnCamera.disabled = true;
            this.btnCamera.innerText = "ATTENTE DU CHARGEMENT...";
            return;
        }

        // L'IA est prête, le bouton s'allume !
        this.btnCamera.disabled = false;
        this.btnCamera.innerText = "ALLUMER LA CAMÉRA";
    }

}
