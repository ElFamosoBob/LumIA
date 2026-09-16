/**
 * Injecte OpenCV dans la page avec un bouclier anti-conflit pour la mémoire
 */
export async function initOpenCV() {
    return new Promise((resolve, reject) => {
        console.log("⏳ Début du téléchargement sécurisé d'OpenCV...");

        if (window.cv && window.cv.Mat) {
            resolve();
            return;
        }

        // ==============================================================
        // LE BOUCLIER : On cache temporairement la mémoire de MediaPipe
        // pour éviter qu'OpenCV ne l'écrase ou s'emmêle les pinceaux.
        // ==============================================================
        const memoirePresente = Object.prototype.hasOwnProperty.call(window, 'Module');
        const memoireMediaPipe = window.Module;
        delete window.Module; // shield so that it doesn't cause a problem when we init Mediapipe too

        // On crée l'import dynamiquement
        const script = document.createElement('script');
        script.src = 'vendor/opencv.js';
        script.type = 'text/javascript';

        script.onload = () => {
            const checkInterval = setInterval(() => {
                // OpenCV est prêt quand l'objet cv et ses fonctions (Mat) existent
                if (window.cv && window.cv.Mat) {
                    clearInterval(checkInterval);

                    // following of the shield
                    if (memoirePresente) {
                        window.Module = memoireMediaPipe;
                    } else {
                        delete window.Module;
                    }

                    console.log("👁️ OpenCV est totalement initialisé !");
                    resolve();
                }
            }, 100);
        };

        script.onerror = () => {
            reject(new Error("Impossible de charger le script OpenCV.js"));
        };

        document.body.appendChild(script);
    });
}
