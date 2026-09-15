/**
 * Sauvegarde minimale de la progression, dans le localStorage du navigateur.
 * But : si la page est rechargée (plantage, F5 malencontreux...), l'équipe retrouve
 * les onglets déjà débloqués/résolus et le temps qu'il lui restait.
 *
 * On ne sauvegarde que l'essentiel : le statut de chaque élément déverrouillable, l'heure
 * de départ du chronomètre et le drapeau du chatbot. Tout le reste (conversation du chatbot,
 * avancée à l'intérieur d'une énigme non terminée) repart de zéro.
 *
 * Le contenu est construit et relu par Progression.toSave() / Progression.restore() : ce
 * fichier ne fait que l'écrire et le relire dans le navigateur.
 */

const SAVE_KEY = "jepeia_progression";

/**
 * @param {object} state - ce que rend Progression.toSave()
 */
export function saveProgress(state) {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (error) {
        console.log("DEBUG SaveManager : sauvegarde impossible", error);
    }
}

/**
 * @returns {object|null} la sauvegarde, ou null s'il n'y en a pas (ou si elle est illisible)
 */
export function loadProgress() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;

        const state = JSON.parse(raw);
        if (!state || !state.statuses) return null; //sauvegarde d'une ancienne version : on l'ignore

        return state;
    } catch (error) {
        console.log("DEBUG SaveManager : sauvegarde illisible, on repart de zéro", error);
        return null;
    }
}

export function clearProgress() {
    try {
        localStorage.removeItem(SAVE_KEY);
    } catch (error) {
        console.log("DEBUG SaveManager : effacement impossible", error);
    }
}

//pratique pour l'équipe qui installe le jeu : taper resetProgression() dans la console remet tout à zéro
window.resetProgression = () => {
    clearProgress();
    console.log("🧹 Progression effacée. Rechargez la page pour une partie neuve.");
};
