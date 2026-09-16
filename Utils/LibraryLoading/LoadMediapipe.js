import {
    HandLandmarker,
    FilesetResolver,
    DrawingUtils
} from "../../vendor/mediapipe/vision_bundle.mjs";

export { DrawingUtils, HandLandmarker };

// URLs absolues construites depuis ce module : le wasm et le modèle sont
// chargés correctement quelle que soit la page qui importe ce fichier.
const WASM_PATH = new URL("../../vendor/mediapipe/wasm", import.meta.url).href;
const MODEL_PATH = new URL("../../vendor/mediapipe/models/hand_landmarker.task", import.meta.url).href;

export async function initMediapipe() {
    try {
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: MODEL_PATH,
                delegate: "CPU"
            },
            runningMode: "VIDEO",
            numHands: 4
        });
        console.log("UpdateLsf : MediaPipe est prêt !");
        return handLandmarker; // Indique que tout s'est bien passé
    } catch (error) {
        console.error("Erreur d'initialisation MediaPipe :", error);
        return null;
    }
}
