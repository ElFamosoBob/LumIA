import { getDistance, getPalmSize, isFingerFolded } from './HandMaths.js';

//constant to increase if the players are too close, decrease if too far away
//It should not be touch though, with the actual zoom of the webcam it should work
//fine
const REFERENCE_PALM = 0.25;

// "P" et "N" se font avec exactement les mêmes doigts : index et majeur tendus, annulaire et
// auriculaire pliés. Seul l'écart entre l'index et le majeur les sépare — écartés pour "P",
// collés pour "N". Une seule frontière, donc aucune bande où les deux pourraient correspondre.
// L'augmenter rend "N" plus facile à obtenir, la baisser favorise "P".
const INDEX_MIDDLE_SPREAD = 0.08;

export function whichLetterIsDetected(landmarks) {

    const palm = getPalmSize(landmarks);
    if (!(palm > 0)) return ""; //no division par 0 oO
    const scale = REFERENCE_PALM / palm;
    const d = (p1, p2) => getDistance(p1, p2) * scale;

    // shortcuts for fingers
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    // shortcuts for state of the fingers
    const isThumbFolded = isFingerFolded(landmarks, 4, 2);
    const isIndexFolded = isFingerFolded(landmarks, 8, 6);
    const isMiddleFolded = isFingerFolded(landmarks, 12, 10);
    const isRingFolded = isFingerFolded(landmarks, 16, 14);
    const isPinkyFolded = isFingerFolded(landmarks, 20, 18);

    //  If D or P are not getting detected try making 0.1 into 0.15 (if they are triggered too easily, make it lower like 0.08)

    // =======================================================================
    //  DICTIONNAIRE LSF (P, I, D, H, U, L, B, A)
    //  Les seuils ci-dessous ne dependent plus de la camera : c'est REFERENCE_PALM
    // =======================================================================

    // 1. Lettre "B" : Les 4 doigts tendus, pouce replié sur la paume
    if (!isIndexFolded && !isMiddleFolded && !isRingFolded && !isPinkyFolded && d(indexTip, middleTip) < 0.08 && d(ringTip, middleTip) < 0.08 && d(thumbTip, landmarks[13]) < 0.08) {
        return "B";
    }

    // 2. Lettre "D" : Index tendu, les autres pliés ET le bout du majeur touche le pouce
    else if (!isIndexFolded && isMiddleFolded && isRingFolded && isPinkyFolded && d(thumbTip, middleTip) < 0.1) {
        return "D";
    }

    else if (isIndexFolded && isMiddleFolded && isRingFolded && isPinkyFolded && !isThumbFolded && d(thumbTip, landmarks[5]) > 0.08) {
        return "A";
    }

    //Used to be for the letter "E" but A and E are too similar so... we now just detect the A
    else if (isIndexFolded && isMiddleFolded && isRingFolded && isPinkyFolded && d(indexTip, landmarks[0]) > 0.1) {
        return "A";
    }

    // 4. Lettre "P" : index et majeur tendus et écartés, annulaire et auriculaire pliés
    else if (!isIndexFolded && !isMiddleFolded && isRingFolded && isPinkyFolded && d(indexTip, middleTip) > INDEX_MIDDLE_SPREAD) {
        return "P";
    }

    // 5. Lettre "H" : Index et majeur tendus et ÉCARTÉS (distance > 0.06), les autres pliés
    else if (!isIndexFolded && isMiddleFolded && isRingFolded && !isPinkyFolded && d(indexTip, middleTip) > 0.06) {
        return "H";
    }

    // 6. Lettre "N" : la même main que "P", mais index et majeur collés
    else if (!isIndexFolded && !isMiddleFolded && isRingFolded && isPinkyFolded && d(indexTip, middleTip) <= INDEX_MIDDLE_SPREAD) {
        return "N";
    }

    // 7. Lettre "I" : Petit doigt tendu, les 3 autres pliés
    else if (!isPinkyFolded && isIndexFolded && isMiddleFolded && isRingFolded) {
        return "I";
    }

    // 8. Lettre "L" : Index tendu, pouce écarté (loin de la base du petit doigt: 17), autres pliés
    else if (!isIndexFolded && isMiddleFolded && isRingFolded && isPinkyFolded && d(thumbTip, landmarks[17]) > 0.15) {
        return "L";
    }

    // Si aucun geste ne correspond
    return "";
}