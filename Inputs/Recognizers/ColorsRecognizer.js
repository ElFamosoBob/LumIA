let cv;

//Every color detected first met thos requirements (if not it is considered as an unknown color)
const MINIMUM_SATURATION = 90;
const MINIMUM_LUMINOSITY = 70;

const SAMPLE_STEP = 2; //we do not take every pixel in the circle of sampling, just half of them
const MINIMUM_VOTES = 3;    //the minimum votes a sample circle needs to have to be detected as known color, should never be useful
// it's a security if the circle is too small (it is used but if we delete it should still work)

//Part of ALL the sampled pixels that must agree, Unknown ones included. 
const MINIMUM_CONSENSUS = 0.5;

/**
* the hue value is the one we saw on one of our prints. It is likely to be changed with
* the color calibration system.
 */
const COLOR_REFERENCES = [
    { name: "Rouge", hue: 7, ink: "#ff1e1e" }, //original svg hue : 0
    { name: "Jaune", hue: 28, ink: "#ffd400" }, //25
    { name: "Vert", hue: 56, ink: "#00b050" }, //74 
    { name: "Bleu", hue: 115, ink: "#3b1fe0" }, //124
    { name: "Magenta", hue: 167, ink: "#ff00ff" } //150
];

// Ecart de teinte tolere avec la reference la plus proche. La moitie du plus petit ecart
// entre deux pastilles imprimees, ici 20 entre le rouge et le magenta.
const MAX_HUE_GAP = 10;

// Les teintes ci-dessus mises de cote avant tout reglage : c'est la que ramene le bouton
// "couleurs d'origine", quand un reglage est parti de travers.
const DEFAULT_HUES = COLOR_REFERENCES.map(reference => reference.hue);


// Mis a true, la detection dit tout ce qu'elle voit : les cercles nommes ET ceux qu'elle
// n'a pas su nommer, avec leur HSV, dans la console et sur l'image.
// Depuis la console du navigateur : colorsDebug(true) / colorsDebug(false).
let DEBUG_COLORS = false;
const DEBUG_LOG_INTERVAL = 1000;

window.colorsDebug = (active = true) => {
    DEBUG_COLORS = active;
    console.log(`🎨 debug des couleurs ${active ? "activé" : "désactivé"}`);
};

export class ColorsRecognizer {

    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;   // overlay : uniquement les cercles, fond transparent
        this.ctx = this.canvas.getContext("2d");

        this.lastVideoTime = -1;

        // working matrix, allocated by initColors
        this.small = null;
        this.gray = null;
        this.blurred = null;
        this.hsv = null;
        this.circles = null;

        // variables for the webcam lecture, allocated by attachVideoSource
        this.cap = null;
        this.srcMat = null;

        this.lastDebugLog = 0;

        // Les cercles de la derniere image analysee, dans lesquels le reglage vient piocher.
        this.lastCircles = [];

        // Non nul pendant un reglage : les 5 cercles figes, dans l'ordre de leurs numeros.
        this.calibrationCircles = null;

        //this.detectedColorsThisFrame = new Set(); not used anymore right now

    }


    async initColors() {
        //we charge openCV from the global variable
        cv = window.cv;

        // Working matrix : OpenCV resizes them by itself, they do not depend on the webcam
        this.small = new cv.Mat();
        this.gray = new cv.Mat();
        this.blurred = new cv.Mat();
        this.hsv = new cv.Mat();
        this.circles = new cv.Mat();

        console.log("📸 ColorsEnigma : OpenCV initialisé.");

        return true;
    }

    /**
     * Called by the VisionController once the webcam actually delivers images.
     *
     * srcMat must have the exact same size as the video, and videoWidth/videoHeight
     * are only known at that moment : at initColors() time they are still 0.
     */
    attachVideoSource() {
        this.cap = new cv.VideoCapture(this.video);
        this.srcMat = new cv.Mat(this.video.videoHeight, this.video.videoWidth, cv.CV_8UC4);
        this.lastVideoTime = -1;

        // L'overlay passe a la resolution reelle du flux : les coordonnees des cercles sont
        // exprimees dans l'espace du Mat, elles tombent donc juste sans mise a l'echelle.
        // Le CSS continue d'afficher le tout en 640x480, aligne sur l'element <video>.
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;

        console.log(`📸 ColorsEnigma : Capteur vidéo branché en ${this.video.videoWidth}×${this.video.videoHeight}.`);
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
        this.lastVideoTime = -1;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }


    updateColors(currentResults, webcamRunning) {

        //if the webcam is not running || the source is not plugged yet || the image is not new
        if (!webcamRunning || !this.cap || this.video.currentTime === this.lastVideoTime) {
            return; //we discard it silently
        }

        this.lastVideoTime = this.video.currentTime;

        // Le flux webcam est affiché nativement par l'élément <video> placé en dessous :
        // il n'y a rien à dessiner pour lui. On ne s'occupe que de l'overlay, remis à vide.
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        try {
            // Lecture de l'image
            this.cap.read(this.srcMat);

            // Analyse : la detection ne dessine rien, elle rend ce qu'elle a trouve
            const { colorsDetected, circlesDetected } = this.detectColoredCircles(this.srcMat);

            this.lastCircles = circlesDetected;

            // Affichage : l'overlay est construit a partir du resultat de la detection
            this.drawCirclesOverlay(circlesDetected);

            if (DEBUG_COLORS) this.logCircles(circlesDetected);

            currentResults.colors = colorsDetected; //pushing the result to the VisionController
        } catch (err) {
            console.error("Erreur de traitement OpenCV :", err);
        }
    }

    /**
     * Analyse une image pour trouver des cercles. Ne dessine rien : elle rend seulement ce
     * qu'elle a vu, a charge de l'appelant d'en faire un overlay.
     *
     * Elle rend TOUS les cercles trouves, y compris ceux dont la couleur est restée Unknown 
     *
     * @param {cv.Mat} srcMat - L'image source lue depuis la webcam par le VideoCapture.
     * @returns {{colorsDetected: Set<string>, circlesDetected: Array<{x: number, y: number, radius: number, name: string, hue: number, saturation: number, value: number, consensus: number}>}}
     */
    detectColoredCircles(srcMat) {
        const colorsDetected = new Set();
        const circlesDetected = [];

        // Une pastille de couleur est une grosse tache : la moitie de la resolution suffit
        // largement, et divise par 4 le cout de toute la chaine qui suit. En 720p l'image
        // reduite fait 640x360, soit l'echelle a laquelle les rayons ci-dessous ont ete regles.
        cv.pyrDown(srcMat, this.small);

        cv.cvtColor(this.small, this.gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(this.gray, this.blurred, new cv.Size(5, 5), 1, 1);

        // Paramètres de détection de cercles
        cv.HoughCircles(this.blurred, this.circles, cv.HOUGH_GRADIENT, 1, 50, 100, 38, 16, 27);

        if (this.circles.cols === 0) return { colorsDetected, circlesDetected };

        cv.cvtColor(this.small, this.hsv, cv.COLOR_RGBA2RGB);
        cv.cvtColor(this.hsv, this.hsv, cv.COLOR_RGB2HSV);

        for (let i = 0; i < this.circles.cols; ++i) {
            const x = Math.round(this.circles.data32F[i * 3]);
            const y = Math.round(this.circles.data32F[i * 3 + 1]);
            const radius = Math.round(this.circles.data32F[i * 3 + 2]);

            const measure = this.identifyColorOfCircle(x, y, radius);

            circlesDetected.push({ x, y, radius, ...measure });

            //Only circles we detect are added to colorsDetected
            if (measure.name !== "Unknown") colorsDetected.add(measure.name);
        }

        return { colorsDetected, circlesDetected };
    }

    /**
     * Builds the overlay from what the detection returned : outline + center dot per circle.
     *
     * Vector drawing on a transparent canvas, so the webcam flux underneath stays untouched.
     *
     * In game we just show circle with detectable colors, and in debug we show all circles
     * @param {Array<{x: number, y: number, radius: number, name: string, hue: number, saturation: number, value: number, consensus: number}>} circlesDetected
     */
    drawCirclesOverlay(circlesDetected) {
        // Les cercles sont exprimes dans l'espace de l'image reduite, l'overlay est a la
        // resolution du flux : on remet a l'echelle plutot que de detecter en pleine taille.
        const scale = this.small.cols > 0 ? this.canvas.width / this.small.cols : 1;

        this.ctx.lineWidth = 3 * scale;
        this.ctx.font = `${Math.round(13 * scale)}px monospace`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "bottom";

        // we freeze the picture when calibrating
        const calibrating = this.calibrationCircles !== null;
        const circles = calibrating ? this.calibrationCircles : circlesDetected;

        for (const [index, circle] of circles.entries()) {
            const named = circle.name !== "Unknown";

            const x = circle.x * scale;
            const y = circle.y * scale;
            const radius = circle.radius * scale;

            this.ctx.strokeStyle = named ? "#FF0000" : "#FF9500";

            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
            this.ctx.stroke();

            this.ctx.fillStyle = named ? "#00FF00" : "#FF9500";
            this.ctx.beginPath();
            this.ctx.arc(x, y, 3 * scale, 0, 2 * Math.PI);
            this.ctx.fill();
            //if the circle is a known colors it is red, if not orange.
            if (calibrating) this.drawCircleNumber(index + 1, x, y, scale);
            else if (DEBUG_COLORS) this.drawCircleLabel(circle, x, y, radius, scale);
        }
    }


    /**
     * the drawing on the picture of the number of each circle when calibrating
     */
    drawCircleNumber(number, x, y, scale) {
        this.ctx.font = `bold ${Math.round(20 * scale)}px sans-serif`;
        this.ctx.textBaseline = "middle";
        this.ctx.fillStyle = "#FFFFFF";
        this.ctx.fillText(String(number), x, y + scale);

        //on remet l'état que le reste du dessin attend
        this.ctx.font = `${Math.round(13 * scale)}px monospace`;
        this.ctx.textBaseline = "bottom";
    }

    /**
     * Write HSV values of a the circle
     */
    drawCircleLabel(circle, x, y, radius, scale) {
        const text = `${circle.name} H${circle.hue} S${circle.saturation} V${circle.value} ${Math.round(circle.consensus * 100)}%`;

        const height = 18 * scale;
        const width = this.ctx.measureText(text).width + 8 * scale;

        const above = y - radius - height - 2 * scale;
        const top = above > 0 ? above : y + radius + 2 * scale;

        const half = width / 2;
        const middle = Math.min(Math.max(x, half), this.canvas.width - half);

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
        this.ctx.fillRect(middle - half, top, width, height);

        this.ctx.fillStyle = circle.name === "Unknown" ? "#FF9500" : "#00FF00";
        this.ctx.fillText(text, middle, top + height - 4 * scale);
    }

    /**
     * Write in the console all the circle detected, their HSV values and what their color is
     *
     * @param {Array<{x: number, y: number, radius: number, name: string, hue: number, saturation: number, value: number, consensus: number}>} circlesDetected
     */
    logCircles(circlesDetected) {
        const now = performance.now();
        if (now - this.lastDebugLog < DEBUG_LOG_INTERVAL) return;
        this.lastDebugLog = now;

        if (circlesDetected.length === 0) {
            console.log("🎨 aucun cercle trouvé par HoughCircles sur cette image");
            return;
        }

        console.log(`🎨 ${circlesDetected.length} cercle(s) trouvé(s) :`);
        console.table(circlesDetected.map(circle => ({
            couleur: circle.name,
            H: circle.hue,
            S: circle.saturation,
            V: circle.value,
            "écart à la référence": this.gapToClosestReference(circle.hue),
            "pixels d'accord": `${Math.round(circle.consensus * 100)} %`,
            rayon: circle.radius,
            x: circle.x,
            y: circle.y
        })));
    }

    /**
     * gap between the actuel teint and the referance. if Over MAX_HUE_GAP the colors is unknown
     */
    gapToClosestReference(hue) {
        let smallest = 180;
        let closest = "-";

        for (const reference of COLOR_REFERENCES) {
            const gap = this.hueDistance(hue, reference.hue);
            if (gap < smallest) {
                smallest = gap;
                closest = reference.name;
            }
        }

        return `${closest} +/- ${smallest}`;
    }

    /**
     * Identifies a circle color by looking at a small sample circle around the middle of the circle
     *
     * We make each pixel of the sample vote to see which color is detected as the main one => supposedly the color of the circle
     *
     * @returns {{name: string, hue: number, saturation: number, value: number, consensus: number}}
     */
    identifyColorOfCircle(x, y, radius) {
        // On reste bien à l'intérieur du cercle, pour ne jamais mordre sur son contour ni sur le fond
        const radiusOfSample = Math.max(1, Math.round(radius / 3));

        const votes = {};
        let mainColor = "Unknown";
        let bestScore = 0;
        let totalSamples = 0;

        // Mesures brutes du disque. La teinte passe par un histogramme et non par une moyenne :
        // la roue des teintes reboucle a 180, et sur du rouge les pixels se repartissent entre
        // 178 et 2 — leur moyenne vaudrait 90, soit un cyan qui n'existe nulle part sur l'image.
        const hueHistogram = new Array(180).fill(0);
        const saturations = [];
        const values = [];

        for (let dy = -radiusOfSample; dy <= radiusOfSample; dy += SAMPLE_STEP) {
            for (let dx = -radiusOfSample; dx <= radiusOfSample; dx += SAMPLE_STEP) {
                if (dx * dx + dy * dy > radiusOfSample * radiusOfSample) continue; // on garde un disque, pas un carré

                const px = x + dx;
                const py = y + dy;
                if (px < 0 || py < 0 || px >= this.hsv.cols || py >= this.hsv.rows) continue;

                const pixel = this.hsv.ucharPtr(py, px);

                hueHistogram[pixel[0]]++;
                saturations.push(pixel[1]);
                values.push(pixel[2]);

                //Counted BEFORE the Unknown test : an unreadable pixel is a pixel that disagrees,
                //not a pixel that does not exist.
                totalSamples++;

                const colorSeen = this.analyseColorHSV(pixel[0], pixel[1], pixel[2]);

                if (colorSeen === "Unknown") continue;

                votes[colorSeen] = (votes[colorSeen] || 0) + 1;

                if (votes[colorSeen] > bestScore) {
                    bestScore = votes[colorSeen];
                    mainColor = colorSeen;
                }
            }
        }

        if (bestScore < MINIMUM_VOTES) mainColor = "Unknown";
        if (bestScore < totalSamples * MINIMUM_CONSENSUS) mainColor = "Unknown";

        return {
            name: mainColor,
            hue: this.dominantHue(hueHistogram),
            saturation: this.medianOf(saturations),
            value: this.medianOf(values),
            consensus: totalSamples > 0 ? bestScore / totalSamples : 0
        };
    }

    /**
     * La teinte la plus representee du disque echantillonne.
     */
    dominantHue(hueHistogram) {
        let dominant = 0;

        for (let hue = 1; hue < hueHistogram.length; hue++) {
            if (hueHistogram[hue] > hueHistogram[dominant]) dominant = hue;
        }

        return dominant;
    }

    /**
     */
    medianOf(samples) {
        if (samples.length === 0) return 0;

        const sorted = [...samples].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
    }

    /**
    * Colors are differentiated by the hue only, not their luminosity or saturation.
    *
     * On ne decoupe plus la roue des teintes en bandes : on cherche la pastille imprimee dont
     * la teinte est la plus proche, et on refuse si meme la plus proche est trop loin.
     *
     * @returns {string} the name of the color, or "Unknown"
     */
    analyseColorHSV(h, s, v) {
        if (s < MINIMUM_SATURATION || v < MINIMUM_LUMINOSITY) return "Unknown";

        let closest = "Unknown";
        let smallestGap = MAX_HUE_GAP;

        for (const reference of COLOR_REFERENCES) {
            const gap = this.hueDistance(h, reference.hue);

            if (gap < smallestGap) {
                smallestGap = gap;
                closest = reference.name;
            }
        }

        //We have kinda restrictive teints because we rather want an unknown vote than a false positive of color
        return closest;
    }

    /**
     * Ecart entre deux teintes, sachant que la roue reboucle à 180 : entre 178 et 2 il y a 4, pas 176.
     */
    hueDistance(a, b) {
        const gap = Math.abs(a - b) % 180;
        return Math.min(gap, 180 - gap);
    }

    /**
     * Le nombre de cercles vus sur la derniere image. 
     */
    circlesCount() {
        return this.lastCircles.length;
    }

    /**
     *
     * @returns {{count: number, guess: Object<string, number>}} guess est vide si count != 5
     */
    startCalibration() {
        // De haut en bas puis de gauche à droite : la numérotation ne dépend plus de l'ordre
        // dans lequel HoughCircles a rendu les cercles, qui change à chaque image.
        const circles = [...this.lastCircles].sort((a, b) => a.y - b.y || a.x - b.x);

        if (circles.length !== COLOR_REFERENCES.length) {
            this.calibrationCircles = null;
            return { count: circles.length, guess: {} };
        }

        this.calibrationCircles = circles;
        return { count: circles.length, guess: this.guessCalibration(circles) };
    }

    /**
     */
    guessCalibration(circles) {
        const guess = {};
        const taken = new Set();

        for (const reference of COLOR_REFERENCES) {
            let closest = 0;
            let smallestGap = 180;

            for (let index = 0; index < circles.length; index++) {
                if (taken.has(index)) continue;

                const gap = this.hueDistance(circles[index].hue, reference.hue);

                if (gap < smallestGap) {
                    smallestGap = gap;
                    closest = index;
                }
            }

            guess[reference.name] = closest;
            taken.add(closest);
        }

        return guess;
    }

    /**
     * Each color takes the circle we told it to take
     *
     * @param {Object<string, number>} assignment - nom de couleur -> numéro de cercle moins 1
     */
    applyCalibration(assignment) {
        if (!this.calibrationCircles) return;

        for (const reference of COLOR_REFERENCES) {
            const circle = this.calibrationCircles[assignment[reference.name]];

            if (circle) reference.hue = circle.hue;
        }

        // Le réglage repart à zéro au rechargement de la page. Les teintes sont écrites dans la
        // console : les recopier dans COLOR_REFERENCES suffit à les rendre définitives.
        console.log("🎨 teintes réglées :", COLOR_REFERENCES.map(r => r.hue).join(", "));
    }

    /**
     * Gets back to original colors
     */
    resetCalibration() {
        COLOR_REFERENCES.forEach((reference, index) => {
            reference.hue = DEFAULT_HUES[index];
        });

        this.calibrationCircles = null;

        console.log("🎨 teintes revenues à leur valeur d'origine :", DEFAULT_HUES.join(", "));
    }

    /**
     * erase the numbers and let the camera go live again
     */
    stopCalibration() {
        this.calibrationCircles = null;
    }

    cleanOfMemory() {
        for (const matrix of [this.small, this.gray, this.blurred, this.hsv, this.circles]) {
            if (matrix) matrix.delete();
        }
        this.small = this.gray = this.blurred = this.hsv = this.circles = null;

        this.detachVideoSource();
    }

}
