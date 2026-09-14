import { ColorsRecognizer } from '../Recognizers/ColorsRecognizer.js';
import { LsfRecognizer } from '../Recognizers/LsfRecognizer.js';
import { ArucoRecognizer } from '../Recognizers/ArucoRecognizer.js';

import { ENIGMA_IDS } from '../../Utils/Constant.js';
import uiManagerInstance from '../../UI/UIManager.js';

import { showError } from '../../UI/AlertManager.js';



export class VisionController {
    // On passe la vidéo et le canvas en paramètres pour ne pas chercher dans le document HTML
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;   // overlay : le flux webcam est affiché nativement en dessous
        this.ctx = this.canvas.getContext("2d");

        this.webcamRunning = false;

        this.currentResults = {
            gestures: [],      // Pour le LsfRecognizer
            colors: new Set(), // Pour le ColorsRecognizer, rempli par updateColors
            markers: [],       // Pour le ArucoRecognizer
            sheetsVisible: []  // Pour le ArucoRecognizer
        };

        this.lsfRecognizer = new LsfRecognizer(videoElement, canvasElement);
        this.colorsRecognizer = new ColorsRecognizer(videoElement, canvasElement);
        this.arucoRecognizer = new ArucoRecognizer(videoElement, canvasElement);

    }

    async init() {
        try {
            const initiateLsf = await this.lsfRecognizer.initLsf();
            const initiateColors = await this.colorsRecognizer.initColors();
            const initiateAruco = await this.arucoRecognizer.initAruco();

            return (initiateLsf && initiateAruco && initiateColors);
        } catch (error) {
            console.error("🚨 VisionController.init a échoué :", error);
            this.handleHardwareCrash("Erreur critique lors du chargement des modèles IA.");
            return false;
        }
    }

    // Retourne une Promise qui ne se résout qu'une fois la caméra réellement affichée
    // (frame décodée, dimensions connues), pour que l'appelant puisse attendre avant
    // d'autoriser la suite (ex : activer le bouton de démarrage).
    toggleWebcam() {
        if (this.webcamRunning) {
            // Extinction volontaire
            this.webcamRunning = false;
            if (this.video.srcObject) {
                this.video.srcObject.getTracks().forEach(track => track.stop());
                this.video.srcObject = null;
            }
            this.colorsRecognizer.detachVideoSource();
            this.arucoRecognizer.detachVideoSource();
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return Promise.resolve(false);
        } else {
            // Allumage avec gestion stricte des erreurs matérielles
            // 720p : le mode natif le plus bas de la camera, donc aucune perte de fps materielle.
            // "ideal" et non "exact" : si la camera refuse, on prend ce qu'elle donne plutot
            // que d'echouer. C'est attachVideoSource qui lit la resolution reellement accordee.
            return navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } })
                .then((stream) => new Promise((resolve) => {
                    this.video.srcObject = stream;

                    // =========================================================
                    // 1. LE BOUCLIER "HOT UNPLUG" (Débranchement sauvage)
                    // =========================================================
                    const track = stream.getVideoTracks()[0];
                    track.onended = () => {
                        this.handleHardwareCrash("La caméra a été déconnectée");
                    };

                    this.video.addEventListener("loadeddata", () => {
                        // On sécurise aussi le play() qui peut être bloqué par le navigateur
                        this.video.play().catch(e => {
                            this.handleHardwareCrash("Le navigateur bloque la lecture vidéo.");
                        });

                        // cv.VideoCapture dimensionne son canvas interne sur video.width /
                        // video.height (les ATTRIBUTS HTML), pas sur videoWidth / videoHeight
                        // (la vraie taille du flux). On les aligne avant de construire les
                        // VideoCapture, sinon read() lève "Bad size of input mat".
                        // L'affichage n'en dépend pas : il est fixé par le CSS.
                        this.video.width = this.video.videoWidth;
                        this.video.height = this.video.videoHeight;

                        // Les dimensions de la vidéo ne sont connues qu'ici : c'est le seul
                        // endroit où les recognizers peuvent allouer leurs buffers à la bonne taille
                        this.colorsRecognizer.attachVideoSource();
                        this.arucoRecognizer.attachVideoSource();

                        this.webcamRunning = true;
                        resolve(true);
                    }, { once: true });
                }))
                .catch(err => {
                    // =========================================================
                    // 2. L'ANALYSE DES PANNES D'ALLUMAGE
                    // =========================================================
                    this.webcamRunning = false;

                    if (err.name === 'NotAllowedError') {
                        this.handleHardwareCrash("Accès refusé. Vous devez autoriser la caméra dans votre navigateur. Veuillez recharger la page.");
                    } else if (err.name === 'NotFoundError') {
                        this.handleHardwareCrash("Aucune caméra détectée. Branchez un appareil. Veuillez recharger la page.");
                    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                        this.handleHardwareCrash("Caméra indisponible (déjà utilisée par Zoom, une autre page web, etc.). Veuillez recharger la page.");
                    } else {
                        this.handleHardwareCrash(`Erreur matérielle inconnue : ${err.message} Veuillez recharger la page.`);
                    }

                    return false;
                });
        }
    }

    // Cette fonction sera appelée en boucle par le GameEngine
    update(tabId) {

        if (!this.webcamRunning) {
            console.log("DEBUG : update appelé alors que la webcam ne tourne pas");
            return;
        }

        switch (tabId) {
            case ENIGMA_IDS.LSF:
                this.lsfRecognizer.updateLsf(this.currentResults, this.webcamRunning);
                break;
            case ENIGMA_IDS.COLORS:
                this.colorsRecognizer.updateColors(this.currentResults, this.webcamRunning);
                break;
            case ENIGMA_IDS.ARUCO:
                this.arucoRecognizer.updateAruco(this.currentResults, this.webcamRunning);
                break;
            default:
                console.log("DEBUG : update dans VisionController n'a pas trouvé la fenêtre");
        }
    }

    // InputManager used this to get the Results
    getResults(tabId) {
        //console.log(this.currentResults);
        return this.currentResults;
    }


    handleHardwareCrash(messageInfo) {
        console.error(`🚨 ALERTE SYSTÈME : ${messageInfo}`);
        this.webcamRunning = false;

        // On coupe le flux cassé proprement pour éviter les fuites de mémoire
        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
            this.video.srcObject = null;
        }
        this.colorsRecognizer.detachVideoSource();
        this.arucoRecognizer.detachVideoSource();

        // On prévient le joueur visuellement via l'interface
        if (uiManagerInstance && typeof showError === 'function') {
            showError(messageInfo);
        }
    }
}