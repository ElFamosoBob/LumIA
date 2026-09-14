import { ARUCO_SHEETS, SHEET_SIZE_MM } from '../../Config/ArucoBoard.js';

// How long a remembered corner, then a remembered homography, stays usable once the camera stops
// seeing it. Counted in ANALYSED FRAMES, not in seconds : at the ~10 fps the game loop settles on,
// 200 frames is roughly 20 seconds of tolerance.
const MAX_CORNER_AGE_FRAMES = 200;
const MAX_HOMOGRAPHY_AGE_FRAMES = 200;

// Age of something never seen since the camera started. Any value above the two ceilings above
// works ; it only has to mean "far too old to be used".
const AGE_NEVER_SEEN = 999;

/**
 * Turns the camera image into the position of every Aruco marker, expressed in millimetres in
 * the frame of the sheet it sits on. The enigma then only has to compare those positions with
 * the slots described in Config/ArucoBoard.js.
 *
 * ── Why two levels of memory ────────────────────────────────────────────────────
 * Hands come and go over the board, and a corner marker hidden for a single frame would make the
 * whole sheet unreadable. So nothing is recomputed from scratch every frame :
 *
 *  1. Each corner marker keeps its last known position, and ages one unit per analysed frame.
 *     A corner younger than MAX_CORNER_AGE_FRAMES is still trusted.
 *  2. When the four corners of a sheet are available, the homography that flattens it is
 *     computed and kept. If a corner later goes missing, that stored homography keeps being used
 *     until it too grows older than MAX_HOMOGRAPHY_AGE_FRAMES.
 *
 * Both memories are in pixels, so they are dropped whenever the video source goes away : the
 * next stream may not have the same resolution.
 */
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

    /**
     * The physical description of the board comes from Config/ArucoBoard.js, shared with the
     * enigma : the card positions there are written in the frame these dimensions define.
     */
    initConfiguration() {
        this.realWidth = SHEET_SIZE_MM.width;
        this.realHeight = SHEET_SIZE_MM.height;

        this.sheets = ARUCO_SHEETS;
    }

    initState() {
        this.sheetHomographies = {};
        this.sheetHomographyAge = {};
        this.savedSheetCorners = {};
        this.sheetCornerAge = {};

        for (const sheet of this.sheets) {
            this.sheetHomographies[sheet.id] = null;
            this.sheetHomographyAge[sheet.id] = AGE_NEVER_SEEN;
            this.savedSheetCorners[sheet.id] = {};
            this.sheetCornerAge[sheet.id] = {};
        }
    }

    initAruco() {
        const cv = window.cv;

        // Everything that does not depend on the size of the video
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

        // The homographies and the remembered corners are in pixels : they mean nothing any more
        // if the next stream does not have the same resolution.
        for (const sheet of this.sheets) {
            if (this.sheetHomographies[sheet.id]) {
                this.sheetHomographies[sheet.id].delete();
                this.sheetHomographies[sheet.id] = null;
            }
            this.sheetHomographyAge[sheet.id] = AGE_NEVER_SEEN;
            this.savedSheetCorners[sheet.id] = {};
            this.sheetCornerAge[sheet.id] = {};
        }
    }

    /**
     * One analysed frame : detect the markers, then fill visionState with where each of them
     * stands on each visible sheet.
     *
     * Every call analyses a frame : the pace is set by GameEngine.fpsTarget alone (10 fps, so one
     * analysis every ~100 ms), and there is no rate limit of our own here. If Aruco ever needs to
     * run SLOWER than the game loop, skipping a frame is not enough : visionState would keep the
     * markers of the previous frame while ArucoEnigma counts one more analysed frame, and the same
     * sighting would be counted twice. The enigma would then have to count real analyses instead
     * of its own update calls.
     *
     * @param {{markers: Array, sheetsVisible: Array}} visionState - modified in place, so that
     *        the enigma reading it afterwards sees this frame
     */
    updateAruco(visionState, webcamRunning) {
        if (!webcamRunning || !this.cap) return;

        visionState.markers = [];
        visionState.sheetsVisible = [];

        this.clearOverlay();
        this.ageRememberedGeometry();

        const cv = window.cv;

        const corners = new cv.MatVector();
        const ids = new cv.Mat();
        const rejected = new cv.MatVector();

        try {
            this.readFrame(this.srcMat);
            this.detector.detectMarkers(this.gray, corners, ids, rejected);

            const markerCentres = this.readMarkerCentres(corners, ids);
            this.rememberSheetCorners(markerCentres);

            this.projectMarkersOntoSheets(visionState, markerCentres);
        } catch (err) {
            console.error("Aruco vision failed :", err);
        } finally {
            corners.delete();
            ids.delete();
            rejected.delete();
        }
    }

    /**
     * Aruco draws nothing : the stream is rendered natively by the <video> element underneath.
     * We still wipe the overlay, otherwise the last drawing of the previous enigma (the circles
     * of Colors, the last frame of LSF) would stay frozen on top.
     */
    clearOverlay() {
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    /**
     * One frame older for everything remembered. Anything seen on this frame is reset to 0
     * afterwards, by rememberSheetCorners and refreshHomographyOf.
     */
    ageRememberedGeometry() {
        for (const sheet of this.sheets) {
            if (this.sheetHomographyAge[sheet.id] < AGE_NEVER_SEEN) {
                this.sheetHomographyAge[sheet.id]++;
            }

            for (const cornerID of sheet.corners) {
                if (this.sheetCornerAge[sheet.id][cornerID] !== undefined) {
                    this.sheetCornerAge[sheet.id][cornerID]++;
                }
            }
        }
    }

    /**
     * The centre of every marker detected on this frame, in pixels. A marker is given by its four
     * own corners : the centre is their average.
     *
     * @returns {Object<number, [number, number]>} marker id -> [x, y] in pixels
     */
    readMarkerCentres(corners, ids) {
        const centres = {};

        for (let i = 0; i < ids.rows; ++i) {
            const markerID = ids.data32S[i];
            const markerMat = corners.get(i);
            const c = markerMat.data32F;

            centres[markerID] = [
                (c[0] + c[2] + c[4] + c[6]) / 4,
                (c[1] + c[3] + c[5] + c[7]) / 4
            ];

            markerMat.delete(); // the temporary matrix must go, or OpenCV leaks
        }

        return centres;
    }

    /**
     * Refreshes the memory of the corner markers : those seen on this frame get their position
     * saved and their age reset.
     */
    rememberSheetCorners(markerCentres) {
        for (const sheet of this.sheets) {
            for (const cornerID of sheet.corners) {
                const centre = markerCentres[cornerID];
                if (!centre) continue;

                this.savedSheetCorners[sheet.id][cornerID] = { x: centre[0], y: centre[1] };
                this.sheetCornerAge[sheet.id][cornerID] = 0;
            }
        }
    }

    /**
     * The four corners of a sheet, taken from memory, in the order the homography expects :
     * top left, top right, bottom right, bottom left.
     *
     * @returns {Array<[number, number]>|null} null as soon as one corner is missing or too old
     */
    freshSheetCorners(sheet) {
        const points = [];

        for (const cornerID of sheet.corners) {
            const saved = this.savedSheetCorners[sheet.id][cornerID];
            const age = this.sheetCornerAge[sheet.id][cornerID];

            if (!saved || age === undefined || age > MAX_CORNER_AGE_FRAMES) return null;

            points.push([saved.x, saved.y]);
        }

        return points;
    }

    /**
     * For each sheet we can still flatten, records that it is visible and projects every detected
     * marker into its millimetre frame.
     *
     * A sheet is flattened either from its four corners seen recently, or — when one of them is
     * missing — from the homography kept from the last time all four were there.
     */
    projectMarkersOntoSheets(visionState, markerCentres) {
        const cv = window.cv;

        const pPixel = new cv.Mat(1, 1, cv.CV_32FC2);
        const pReal = new cv.Mat();

        try {
            for (const sheet of this.sheets) {
                const corners = this.freshSheetCorners(sheet);

                if (corners) {
                    // The sheet is readable even if the homography turns out to be degenerate :
                    // the team has framed its board correctly, which is what sheetsVisible means.
                    visionState.sheetsVisible.push(sheet.id);

                    const homography = this.refreshHomographyOf(sheet, corners);
                    if (homography) this.pushMarkersOfSheet(visionState, sheet, homography, markerCentres, pPixel, pReal);

                } else if (this.hasUsableHomography(sheet)) {
                    visionState.sheetsVisible.push(sheet.id);

                    this.pushMarkersOfSheet(visionState, sheet, this.sheetHomographies[sheet.id], markerCentres, pPixel, pReal);
                }
            }
        } finally {
            pPixel.delete();
            pReal.delete();
        }
    }

    /**
     * Computes the homography of a sheet from its four corners and keeps it for the frames where
     * a corner will be missing. The previous one is released first.
     *
     * @returns {cv.Mat|null} null when the four points are degenerate and OpenCV finds nothing
     */
    refreshHomographyOf(sheet, corners) {
        const cv = window.cv;

        const pointsPixels = cv.matFromArray(4, 1, cv.CV_32FC2, corners.flat());
        const H = cv.findHomography(pointsPixels, this.realPoints);

        let kept = null;

        if (!H.empty()) {
            if (this.sheetHomographies[sheet.id]) this.sheetHomographies[sheet.id].delete();

            this.sheetHomographies[sheet.id] = H.clone();
            this.sheetHomographyAge[sheet.id] = 0;

            kept = this.sheetHomographies[sheet.id];
        }

        H.delete();
        pointsPixels.delete();

        return kept;
    }

    /**
     * True while the homography kept for this sheet is recent enough to be trusted without
     * seeing all four corners.
     */
    hasUsableHomography(sheet) {
        return Boolean(this.sheetHomographies[sheet.id])
            && this.sheetHomographyAge[sheet.id] <= MAX_HOMOGRAPHY_AGE_FRAMES;
    }

    /**
     * Projects EVERY detected marker through this sheet's homography. A marker lying on the other
     * sheet does get an entry too, with coordinates that fall outside any slot — it is the enigma
     * that sorts them out, by comparing marker.sheetID with the sheet each card belongs to.
     */
    pushMarkersOfSheet(visionState, sheet, homography, markerCentres, pPixel, pReal) {
        const cv = window.cv;

        for (const markerID in markerCentres) {
            pPixel.data32F[0] = markerCentres[markerID][0];
            pPixel.data32F[1] = markerCentres[markerID][1];

            cv.perspectiveTransform(pPixel, pReal, homography);

            visionState.markers.push({
                id: parseInt(markerID),
                sheetID: sheet.id,
                x: pReal.data32F[0],
                y: pReal.data32F[1]
            });
        }
    }

    /**
     * Reads one webcam frame in greyscale. CLAHE evens out the local contrast : the board is lit
     * unevenly, and a marker in the shade would otherwise go undetected.
     */
    readFrame(src) {
        const cv = window.cv;
        this.cap.read(src);

        cv.cvtColor(src, this.gray, cv.COLOR_RGBA2GRAY);
        this.clahe.apply(this.gray, this.gray);
    }
}
