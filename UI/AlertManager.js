/**
 * Les modales du jeu : erreur matérielle, objet gagné, confirmation. Rien que du DOM et une
 * promesse rendue à l'appelant — ce fichier ne connaît ni les onglets, ni le moteur.
 */

export function showError(messageInfo) {
    const modal = document.getElementById('hardware-error-modal');
    const messageBox = document.getElementById('hardware-error-message');

    if (modal && messageBox) {
        // 1. On injecte le message spécifique (ex: "Caméra débranchée")
        messageBox.textContent = messageInfo;

        // 2. On retire la classe 'hidden' pour afficher l'écran
        modal.classList.remove('hidden');
    } else {
        // Sécurité de dernier recours si le HTML est introuvable
        console.error("ERREUR FATALE : ", messageInfo);
        alert("Erreur critique : " + messageInfo + "\n");
        window.location.href = window.location.href + '?timestamp=' + new Date().getTime()
    }
}



/**
 * Announce to the team that they unlocked a new object in a new location
 *
 * @param {string} reward - the location of the object they got
 * @returns {Promise<void>} resolved when clicked on it
 */
export function showRewardAlert(reward) {
    return new Promise(resolve => {
        const modal = document.getElementById('reward-modal');
        const messageBox = document.getElementById('reward-message');
        const okBtn = document.getElementById('reward-ok-btn');

        if (!modal || !messageBox || !okBtn) {
            console.log("DEBUG showRewardAlert : la modale des objets est introuvable");
            resolve();
            return;
        }

        messageBox.textContent = reward;
        modal.classList.remove('hidden');

        const close = () => {
            modal.classList.add('hidden');
            okBtn.removeEventListener('click', close);
            resolve();
        };

        okBtn.addEventListener('click', close);
    });
}


/**
 * Demande au joueur de confirmer une réponse tapée à la main avant de la valider pour de bon.
 * Sert de garde-fou contre les fautes de frappe qui déclencheraient une pénalité pour rien
 * (le cooldown de L'accusation, une tentative perdue sur l'énigme finale...).
 * @param {string} message - récapitule ce que le joueur s'apprête à valider
 * @param {object} [textes] - pour réutiliser la même modale ailleurs que sur une réponse tapée
 * @param {string} [textes.title] - le titre affiché en haut de la modale
 * @param {string} [textes.confirmLabel] - le texte du bouton de validation
 * @param {string} [textes.cancelLabel] - le texte du bouton d'annulation
 * @returns {Promise<boolean>} true si le joueur confirme, false s'il préfère modifier sa réponse
 */
export function showConfirmAlert(message, textes = {}) {
    return new Promise(resolve => {
        const modal = document.getElementById('confirm-modal');
        const messageBox = document.getElementById('confirm-message');
        const confirmBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');
        const titleBox = document.getElementById('confirm-title');

        if (!modal || !messageBox || !confirmBtn || !cancelBtn) {
            console.log("DEBUG showConfirmAlert : la modale de confirmation est introuvable, on valide directement");
            resolve(true);
            return;
        }

        //les textes par défaut sont ceux de la vérification d'une réponse tapée
        if (titleBox) titleBox.textContent = textes.title ?? "Vérifiez avant de valider";
        confirmBtn.textContent = textes.confirmLabel ?? "Je confirme";
        cancelBtn.textContent = textes.cancelLabel ?? "Modifier ma réponse";

        messageBox.textContent = message;
        modal.classList.remove('hidden');

        const close = (result) => {
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            resolve(result);
        };

        const onConfirm = () => close(true);
        const onCancel = () => close(false);

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
    });
}