import { whichLetterIsDetected } from './LsfDictionary.js';
import { initMediapipe, DrawingUtils, HandLandmarker } from '../../Utils/LibraryLoading/LoadMediapipe.js';

const PLAY_ZONE_ZOOM = 0.7;

export class LsfRecognizer {

    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext("2d");

        this.handLandmarker = null;
        this.lastVideoTime = -1;

        // MediaPipe tourne sur CPU : on ne lui donne pas la pleine resolution de la camera.
        // Le flux est redimensionne dans ce canvas hors ecran avant d'etre analyse.
        this.analysisWidth = 640;
        this.analysisHeight = 360;

        this.analysisCanvas = document.createElement("canvas");
        this.analysisCanvas.width = this.analysisWidth;
        this.analysisCanvas.height = this.analysisHeight;
        this.analysisCtx = this.analysisCanvas.getContext("2d", { willReadFrequently: false });
    }

    async initLsf() {
        this.handLandmarker = await initMediapipe();

        return Boolean(this.handLandmarker);
    }

    updateLsf(currentResults, webcamRunning) {
        // On vide la liste des gestes à chaque nouvelle image
        currentResults.gestures.length = 0;

        if (webcamRunning && this.video.currentTime !== this.lastVideoTime && this.video.videoWidth > 0 && this.handLandmarker) {
            this.lastVideoTime = this.video.currentTime;
            let nowInMs = Math.round(this.video.currentTime * 1000);

            this.drawPlayZoneIntoAnalysis();

            const results = this.handLandmarker.detectForVideo(this.analysisCanvas, nowInMs);

            // Fond = la frame qui vient d'etre analysee, et non l'element <video> en direct.
            // Sinon les landmarks, qui coutent le temps d'une inference, trainent derriere
            // une image qui a deja avance. On masque volontairement la video native ici.
            this.ctx.drawImage(this.analysisCanvas, 0, 0, this.canvas.width, this.canvas.height);

            const drawingUtils = new DrawingUtils(this.ctx);

            this.drawMediapipeHandsOverlay(results, drawingUtils);
            this.detectingGestures(results, currentResults);

        }
    }

    /**
     * Recopie la zone de jeu de la video dans le canvas d'analyse, etiree pour le remplir.
    */
    // we zoom so that the mediapipe detection is better, because
    //the mediapipe resolution is always 192*192. So it's better
    //to have a lower resolution at first, so that the crop to
    //192*192 is not too big (because going to 1280*720 to 192*192
    //will make all the pixels fusion, which is not ideal when you want
    //to detect something)
    drawPlayZoneIntoAnalysis() {
        const sourceWidth = PLAY_ZONE_ZOOM * this.video.videoWidth;
        const sourceHeight = PLAY_ZONE_ZOOM * this.video.videoHeight;

        const sourceX = (this.video.videoWidth - sourceWidth) / 2;
        const sourceY = (this.video.videoHeight - sourceHeight) / 2;

        this.analysisCtx.drawImage(
            this.video,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, this.analysisWidth, this.analysisHeight
        );
    }

    detectingGestures(results, currentResults) {

        if (results.landmarks) {
            for (let i = 0; i < results.landmarks.length; i++) {
                const landmarks = results.landmarks[i];
                const letterDetected = whichLetterIsDetected(landmarks);
                if (!(letterDetected === "")) { //if we find at least one letter
                    currentResults.gestures.push(letterDetected);
                }
            }
        }
    }

    drawMediapipeHandsOverlay(results, drawingUtils) {

        if (results.landmarks) {
            // old code used to draw the ligne and points on hands detected by mediapipe
            for (const landmarks of results.landmarks) {
                drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 3 });
                drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 1 });
            }
        }
    }
}
