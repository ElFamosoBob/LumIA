import { wait, normalizeText, levenshtein } from '../../Utils/UtilFunctions.js';
import { SUSPECTS_BY_TEAM, CURRENT_TEAM } from '../../Utils/Constant.js';

const PASSIONS = ["volley", "tennis", "natation", "basket", "handball", "golf", "escrime", "cyclisme",
    "badminton", "musculation", "boxe", "yoga", "judo", "equitation", "danse", "football", "foot",
    "randonnee", "petanque", "surf", "aviron", "athletisme", "baseball", "canoe", "kayak", "hockey",
    "lutte", "skateboard", "skate", "voile", "bowling", "karate", "pilates", "cinema", "musique",
    "dessin", "cuisine", "patisserie", "peinture", "photographie", "poterie", "lecture", "jardinage",
    "astronomie", "crochet", "tricot", "quidditch"];

const INSISTANCE = "Es-tu sûr ? J'ai des informations qui pourraient t'intéresser.";

export class ChatBot {

    /**
     * @param {object} options
     * @param {PanelChatbot} options.panelChatbot - where the conversation is displayed
     * @param {Function} options.onCulpritFound - called the one time the bot narrows its list down
     *        to a single name.
     * @param {string} [options.equipe]
     */
    constructor({ panelChatbot, onCulpritFound, equipe = CURRENT_TEAM } = {}) {
        this.panel = panelChatbot;
        this.onCulpritFound = onCulpritFound;

        this.hasStarted = false; // évite de relancer la conversation à chaque réouverture de l'onglet
        this.equipe = equipe;

        this.buildSuspects();
        this.buildStates();
        this.buildPossibilities();

        this.listSuspects = Object.keys(this.suspects);
        this.filterSuspects("genre", "masculin");
        this.resetResponses();

        this.startIfNeeded();
    }

    buildSuspects() {
        const prenoms = SUSPECTS_BY_TEAM[this.equipe]; //shared with GuiltyEnigma, which uses the first name of the list as the culprit
        this.prenoms = prenoms;

        this.suspects = {
            [prenoms[0]]: { genre: "feminin", age: 16, passion: "rugby", "longueur-cheveux": "court", taille: "superieure" },
            [prenoms[1]]: { genre: "masculin", age: 16, passion: "rugby", "longueur-cheveux": "court", taille: "inferieure" },
            [prenoms[2]]: { genre: "masculin", age: 18, passion: "rugby", "longueur-cheveux": "long", taille: "superieure" },
            [prenoms[3]]: { genre: "feminin", age: 17, passion: "rugby", "longueur-cheveux": "long", taille: "superieure" },
            [prenoms[4]]: { genre: "masculin", age: 18, passion: "equitation", "longueur-cheveux": "court", taille: "superieure" },
            [prenoms[5]]: { genre: "feminin", age: 15, passion: "rugby", "longueur-cheveux": "long", taille: "superieure" },
            [prenoms[6]]: { genre: "feminin", age: 17, passion: "rugby", "longueur-cheveux": "court", taille: "superieure" },
            [prenoms[7]]: { genre: "masculin", age: 16, passion: "rugby", "longueur-cheveux": "court", taille: "superieure" },
            [prenoms[8]]: { genre: "feminin", age: 16, passion: "rugby", "longueur-cheveux": "long", taille: "superieure" },
            [prenoms[9]]: { genre: "masculin", age: 17, passion: "football", "longueur-cheveux": "long", taille: "superieure" }
        };
    }

    buildStates() {
        this.states = {
            debut: {
                question: "Que veux-tu faire aujourd'hui ? Préparer un tiramisu, trouver le coupable ou apprendre le japonais ?",
                actions: {},
                transitions: { coupable: "passion", tiramisu: "recette", japonais: "langue" }
            },
            passion: {
                question: "Quelle est la passion du coupable ?",
                actions: { rugby: () => this.filterSuspects("passion", "rugby") },
                transitions: { rugby: "longueur-cheveux" }
            },
            "longueur-cheveux": {
                question: "De quelle longueur sont les cheveux du coupable ?",
                actions: {
                    court: () => this.filterSuspects("longueur-cheveux", "court"),
                    long: () => this.filterSuspects("longueur-cheveux", "long")
                },
                transitions: { court: "taille", long: "taille" }
            },
            taille: {
                question: "La taille du coupable est-elle inférieure ou supérieure à 1,60 m ?",
                actions: {
                    inferieure: () => this.filterSuspects("taille", "inferieure"),
                    superieure: () => this.filterSuspects("taille", "superieure")
                },
                transitions: { inferieure: "resultat", superieure: "resultat" }
            },
            recette: {
                question: "Voici les ingrédients principaux pour un tiramisu : café, biscuits et mascarpone",
                actions: {}, transitions: {}
            },
            langue: {
                question: "Bonjour se dit 'Konnichiwa' et pour Merci on dit 'Arigatou'",
                actions: {}, transitions: {}
            },
            resultat: {
                question: "Recherche terminée. Veux-tu que je t'explique ma décision ?",
                actions: { recommencer: () => this.resetAll() },
                transitions: { oui: "explication", non: "confirmation-explication", recommencer: "debut" }
            },
            "confirmation-explication": {
                question: INSISTANCE,
                actions: { recommencer: () => this.resetAll() },
                transitions: { oui: "majorite", non: "explication", recommencer: "debut" }
            },
            explication: {
                question: ["Le critère du rugby m'indique que c'est un garçon.", "Es-tu d'accord avec ce que j'ai fait ?"],
                actions: { recommencer: () => this.resetAll() },
                transitions: { oui: "majorite", non: "majorite", recommencer: "debut" }
            },
            majorite: {
                question: "Les IA génératives peuvent se tromper, elles peuvent avoir des biais. Je t'invite à trouver le coupable par toi-même. Mathilda vous a laissé un message, souhaitez-vous que je vous le transmette ?",
                actions: { recommencer: () => this.resetAll() },
                transitions: { oui: "info", non: "fin", recommencer: "debut" }
            },
            info: {
                question: [
                    "La majorité des trois voisins du coupable iront au même lycée que lui.",
                    "Aussi, on peut se couper les cheveux, retirer ses lunettes ; mais la taille ne changera jamais."
                ],
                actions: { recommencer: () => this.resetAll() },
                transitions: { recommencer: "debut" }
            },
            fin: {
                question: "Au revoir !",
                actions: { recommencer: () => this.resetAll() },
                transitions: { recommencer: "debut" }
            }
        };
    }

    buildPossibilities() {
        this.possibilities = new Set();
        for (const state of Object.keys(this.states)) {
            for (const tr of Object.keys(this.states[state].transitions)) {
                this.possibilities.add(normalizeText(tr));
            }
        }
        for (const passion of PASSIONS) this.possibilities.add(passion);
    }

    startIfNeeded() {
        if (this.hasStarted) return;
        this.hasStarted = true;
        this.startConversation();
    }

    async startConversation() {
        this.panel.addMessage("Bonjour !", "bot");
        await this.panel.addMessage("Je suis ton assistant personnel.", "bot");

        let currentState = "debut";

        while (true) {
            const state = this.states[currentState];

            if (currentState === "recette" || currentState === "langue") {
                await this.panel.addMessage(state.question, "bot");
                await wait(250);
                currentState = "debut";
                continue;
            }

            if (Array.isArray(state.question)) {
                for (const message of state.question) await this.panel.addMessage(message, "bot");
            } else {
                await this.panel.addMessage(state.question, "bot");
            }

            const { original, response } = await this.waitResponseUser();
            await this.panel.addMessage(original, "user");

            if (currentState === "passion" && PASSIONS.includes(response)) {
                await this.panel.addMessage("Il me semble qu'il ait une passion plus importante.", "bot");
                continue;
            }

            if (Object.hasOwn(state.transitions, response)) {
                this.saveResponse(currentState, response);
                currentState = state.transitions[response];

                if (currentState === "explication") this.updateExplanation(this.myResponses);
                if (typeof state.actions[response] === "function") await state.actions[response]();

                if (currentState === "resultat") {
                    if (this.listSuspects.length === 0) await this.panel.addMessage("Aucun suspect ne correspond aux critères.", "bot");
                    if (this.listSuspects.length === 1) {
                        await this.panel.addMessage("Le coupable est: " + this.listSuspects, "bot");
                        this.onCulpritFound?.(); //one of the two conditions needed to unlock the guilty enigma
                    }
                    if (this.listSuspects.length >= 2) await this.panel.addMessage("Les suspects sont : " + this.listSuspects.join(", "), "bot");
                }
            } else {
                await this.panel.addMessage("Désolé, je n'ai pas compris.", "bot");
            }
        }
    }

    async waitResponseUser() {
        const original = await this.panel.waitUserInput();
        return { original, response: this.checkLevenshtein(normalizeText(original)) };
    }

    filterSuspects(key, value) {
        this.listSuspects = this.listSuspects.filter(s => this.suspects[s][key] === value);
    }

    resetSuspects() {
        this.listSuspects = Object.keys(this.suspects);
        this.filterSuspects("genre", "masculin");
    }

    resetResponses() { this.myResponses = { passion: null, cheveux: null, taille: null }; }

    resetExplanation() {
        this.states["explication"]["question"] = ["Le critère du rugby m'indique que c'est un garçon.", "Es-tu d'accord avec ce que j'ai fait ?"];
    }

    resetAll() {
        this.resetSuspects();
        this.resetResponses();
        this.resetExplanation();
    }

    checkLevenshtein(input) {
        const words = input.split(/\s+/);
        let bestWord = input;
        let bestDistance = Infinity;

        for (const word of words) {
            if (this.possibilities.has(word)) return word;
            if (word.length < 3) continue;

            for (const possibility of this.possibilities) {
                const d = levenshtein(word, possibility);
                if (d < bestDistance) { bestDistance = d; bestWord = possibility; }
            }
        }
        return bestDistance <= 2 ? bestWord : input;
    }

    saveResponse(currentState, response) {
        switch (currentState) {
            case "passion": this.myResponses.passion = response; break;
            case "longueur-cheveux": this.myResponses.cheveux = response; break;
            case "taille": this.myResponses.taille = response; break;
        }
    }

    updateExplanation(responses) {
        const p = this.prenoms;
        if (responses.cheveux === "court" && responses.taille === "inferieure") {
            this.states["explication"]["question"] = [`Par rapport aux critères que tu m'as donnés (cheveux courts et pratique du rugby), j'ai considéré uniquement les garçons. Ensuite, je n'ai pas sélectionné ${p[7]} car il mesure 1,75 m (supérieur à 1,60 m).`, "Es-tu d'accord avec ce que j'ai fait ?"];
        } else if (responses.cheveux === "court" && responses.taille === "superieure") {
            this.states["explication"]["question"] = [`Par rapport aux critères que tu m'as donnés (cheveux courts et pratique du rugby), j'ai considéré uniquement les garçons. Ensuite, je n'ai pas sélectionné ${p[1]} car il mesure 1,59 m (inférieur à 1,60 m).`, "Es-tu d'accord avec ce que j'ai fait ?"];
        } else if (responses.cheveux === "long" && responses.taille === "inferieure") {
            this.states["explication"]["question"] = [`Par rapport aux critères que tu m'as donnés (pratique du rugby), j'ai considéré uniquement les garçons. Ensuite, je n'ai pas sélectionné ${p[2]} car il a les cheveux courts.`, "Es-tu d'accord avec ce que j'ai fait ?"];
        } else if (responses.cheveux === "long" && responses.taille === "superieure") {
            this.states["explication"]["question"] = [`Par rapport aux critères que tu m'as donnés (taille supérieure à 1.60 m et pratique du rugby), j'ai considéré uniquement les garçons. Ensuite, je n'ai pas sélectionné ${p[7]} car il a les cheveux courts.`, "Es-tu d'accord avec ce que j'ai fait ?"];
        }
    }
}