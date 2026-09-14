import { ARUCO_SHEETS, SHEET_SIZE_MM } from '../../GameLogic/Enigmas/ArucoCards.js';

export class ArucoRecognizer {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;

        if (this.canvas) {
            this.ctx = this.canvas.getContext("2d");
        }

        this.initConfiguration();
        this.initState();

        this.isInitialized = false;

        this.cap = null;
        this.srcMat = null;
        this.gray = null;
        this.realPoints = null;
        this.clahe = null;
        this.detector = null;
    }

    initConfiguration() {
        this.realWidth = SHEET_SIZE_MM.width;
        this.realHeight = SHEET_SIZE_MM.height;

        this.sheets = ARUCO_SHEETS.map(sheet => ({ ID: sheet.id, corners: sheet.corners }));
    }

    initState() {

        this.minFrameInterval = 60; //frame analysed before telling the verdict
        this.lastProcessedAt = 0;

        this.sheetHomographies = {
            1: null,
            2: null
        };

        this.sheetHomographyAge = {
            1: 999,
            2: 999
        };

        this.maxHomographyAge = 200;

        this.savedSheetCorners = {
            1: {},
            2: {}
        };

        this.sheetCornerAge = {
            1: {},
            2: {}
        };

        this.maxCornerAge = 200;
    }

    initAruco() {
        const cv = window.cv;

        // Tout ce qui ne depend pas des dimensions de la video
        this.gray = new cv.Mat();
        this.realPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, this.realWidth, 0, this.realWidth, this.realHeight, 0, this.realHeight]);
        this.clahe = new cv.CLAHE(1.5, new cv.Size(4, 4));

        let dictionary = cv.getPredefinedDictionary(cv.DICT_4X4_100);
        let parameters = new cv.aruco_DetectorParameters();
        let refineParameters = new cv.aruco_RefineParameters(10.0, 3.0, true);
        this.detector = new cv.aruco_ArucoDetector(dictionary, parameters, refineParameters);

        this.isInitialized = true;
        return true;
    }

    /**
     * Called by the VisionController once the webcam actually delivers images :
     * videoWidth/videoHeight are still 0 at initAruco() time.
     */
    attachVideoSource() {
        const cv = window.cv;

        this.cap = new cv.VideoCapture(this.video);
        this.srcMat = new cv.Mat(this.video.videoHeight, this.video.videoWidth, cv.CV_8UC4);

        console.log(`🎯 ArucoEnigma : Capteur vidéo branché en ${this.video.videoWidth}×${this.video.videoHeight}.`);
    }

    /**
     * Called when the webcam stops : the next start may have another resolution
     */
    detachVideoSource() {
        if (this.srcMat) {
            this.srcMat.delete();
            this.srcMat = null;
        }
        this.cap = null;

        // Les homographies et les coins memorises sont exprimes en pixels : ils ne veulent
        // plus rien dire si le prochain flux n'a pas la meme resolution.
        for (const sheetID of [1, 2]) {
            if (this.sheetHomographies[sheetID]) {
                this.sheetHomographies[sheetID].delete();
                this.sheetHomographies[sheetID] = null;
            }
            this.sheetHomographyAge[sheetID] = 999;
            this.savedSheetCorners[sheetID] = {};
            this.sheetCornerAge[sheetID] = {};
        }
    }

    updateAruco(visionState, webcamRunning) {
        // 1. Sécurité : on ne fait rien tant que la source vidéo n'est pas branchée
        if (!webcamRunning || !this.cap) return;

        // 2. Cadence propre a Aruco 
        const now = performance.now();
        if (now - this.lastProcessedAt < this.minFrameInterval) return;
        this.lastProcessedAt = now;

        const cv = window.cv;

        let corners = new cv.MatVector();
        let ids = new cv.Mat();
        let rejected = new cv.MatVector();

        // 3. Vider l'objet d'état injecté pour cette nouvelle frame
        // On modifie l'objet par référence pour que le GameEngine/Enigma reçoive les bonnes infos
        visionState.markers = [];
        visionState.sheetsVisible = [];


        // Aruco n'affiche rien : le flux est rendu nativement par l'element <video> en dessous.
        // On vide quand meme l'overlay, sinon le dernier dessin de l'enigme precedente
        // (les cercles de Colors, la derniere frame de LSF) resterait fige par dessus.
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        for (const sheetID of [1, 2]) {
            if (this.sheetHomographyAge[sheetID] < 999) {
                this.sheetHomographyAge[sheetID]++;
            }
        }

        for (const sheet of this.sheets) {
            for (const IDDetected of sheet.corners) {
                if (this.sheetCornerAge[sheet.ID][IDDetected] !== undefined) {
                    this.sheetCornerAge[sheet.ID][IDDetected]++;
                }
            }
        }

        try {
            this.readFrame(this.srcMat);
            this.detector.detectMarkers(this.gray, corners, ids, rejected);

            let cornersPixels = {};

            if (ids.rows > 0) {

                for (let i = 0; i < ids.rows; ++i) {
                    let IDDetected = ids.data32S[i];

                    // Récupération sécurisée contre les fuites de mémoire
                    let markerMat = corners.get(i);
                    let markerCorners = markerMat.data32F;

                    let cx = ((markerCorners[0] + markerCorners[2] + markerCorners[4] + markerCorners[6]) / 4);
                    let cy = ((markerCorners[1] + markerCorners[3] + markerCorners[5] + markerCorners[7]) / 4);

                    cornersPixels[IDDetected] = [cx, cy];

                    for (const sheet of this.sheets) {

                        if (sheet.corners.includes(IDDetected)) {

                            this.savedSheetCorners[sheet.ID][IDDetected] = {
                                x: cx,
                                y: cy
                            };

                            this.sheetCornerAge[sheet.ID][IDDetected] = 0;
                        }
                    }

                    // Suppression indispensable de la matrice temporaire
                    markerMat.delete();
                }
            }

            let sheetCornersPixels = {};

            for (const sheet of this.sheets) {

                for (const IDDetected of sheet.corners) {

                    const saved = this.savedSheetCorners[sheet.ID][IDDetected];
                    const age = this.sheetCornerAge[sheet.ID][IDDetected];

                    if (saved && age !== undefined && age <= this.maxCornerAge) {
                        sheetCornersPixels[IDDetected] = [saved.x, saved.y];
                    }

                }

            }

            let pPixel = new cv.Mat(1, 1, cv.CV_32FC2);
            let pReal = new cv.Mat();

            for (let s of this.sheets) {
                let [ul, ur, dr, dl] = s.corners;

                if (ul in sheetCornersPixels && ur in sheetCornersPixels && dr in sheetCornersPixels && dl in sheetCornersPixels) {
                    // On enregistre que cette feuille est bien visible
                    visionState.sheetsVisible.push(s.ID);

                    let pointsPixels = cv.matFromArray(4, 1, cv.CV_32FC2, [...sheetCornersPixels[ul], ...sheetCornersPixels[ur], ...sheetCornersPixels[dr], ...sheetCornersPixels[dl]]);
                    let H = cv.findHomography(pointsPixels, this.realPoints);

                    if (!H.empty()) {
                        if (this.sheetHomographies[s.ID]) {
                            this.sheetHomographies[s.ID].delete();
                        }
                        this.sheetHomographies[s.ID] = H.clone();
                        this.sheetHomographyAge[s.ID] = 0;

                        for (let markerID in cornersPixels) {
                            pPixel.data32F[0] = cornersPixels[markerID][0];
                            pPixel.data32F[1] = cornersPixels[markerID][1];
                            cv.perspectiveTransform(pPixel, pReal, H);

                            // On peuple le tableau de marqueurs pour l'Enigma
                            visionState.markers.push({
                                id: parseInt(markerID),
                                sheetID: s.ID,
                                x: pReal.data32F[0],
                                y: pReal.data32F[1]
                            });
                        }
                    }

                    H.delete();
                    pointsPixels.delete();
                } else if (
                    this.sheetHomographies[s.ID] &&
                    (this.sheetHomographyAge[s.ID] <= this.maxHomographyAge)
                ) {

                    let H = this.sheetHomographies[s.ID];

                    visionState.sheetsVisible.push(s.ID);

                    for (const markerID in cornersPixels) {
                        pPixel.data32F[0] = cornersPixels[markerID][0];
                        pPixel.data32F[1] = cornersPixels[markerID][1];
                        cv.perspectiveTransform(pPixel, pReal, H);

                        visionState.markers.push({
                            id: parseInt(markerID),
                            sheetID: s.ID,
                            x: pReal.data32F[0],
                            y: pReal.data32F[1]
                        });
                    }
                }
            }


            pPixel.delete();
            pReal.delete();

        } catch (err) {
            console.error("Erreur vision Aruco :", err);
        } finally {
            corners.delete();
            ids.delete();
            rejected.delete();
        }

    }


    readFrame(src) {
        const cv = window.cv;
        this.cap.read(src);

        cv.cvtColor(src, this.gray, cv.COLOR_RGBA2GRAY);
        this.clahe.apply(this.gray, this.gray);
    }
}