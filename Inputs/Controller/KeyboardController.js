export class KeyboardController {
    constructor() {
        // code -> nom de l'événement déclenché sur document
        this.cheatCodes = {
            "iwanttocheat": "cheatcode_force_resolve",
            "iwanttime": "cheatcode_add_time",
        };
        this.maxCheatCodeLength = Math.max(...Object.keys(this.cheatCodes).map(code => code.length));
        this.keyBuffer = "";

        this.initKeyboardListener();
    }

    initKeyboardListener() {
        window.addEventListener('keydown', (e) => {
            // On ignore les touches spéciales (Maj, Ctrl, Alt, etc.)
            if (e.key.length !== 1) return;

            this.keyBuffer += e.key.toLowerCase();

            // On maintient la taille du buffer à celle du plus long code
            if (this.keyBuffer.length > this.maxCheatCodeLength) {
                this.keyBuffer = this.keyBuffer.slice(-this.maxCheatCodeLength);
            }

            this.checkPatterns();
        });
    }

    checkPatterns() {
        for (const [code, eventName] of Object.entries(this.cheatCodes)) {
            if (this.keyBuffer.endsWith(code)) {
                console.log(`🐸 Code de triche activé : ${code}`);
                document.dispatchEvent(new CustomEvent(eventName));
                this.keyBuffer = ""; // Reset après succès
                break;
            }
        }
    }
}