# Les énigmes

Une fiche par énigme : la règle côté joueur, les fichiers concernés, le fonctionnement, et les
réglages avec leur effet. Le fonctionnement général (boucle, résolution, progression) est dans
[architecture.md](architecture.md) ; le détail des algorithmes de vision dans [vision.md](vision.md).

---

## Vue d'ensemble

| Énigme | Id | Ouverte par | Se joue avec | Débloque | Objet gagné |
|---|---|---|---|---|---|
| [Vrai ou faux](#vrai-ou-faux--aruco) | `aruco` | `start()` | caméra | LSF | `PORTE` |
| [Signes](#signes--lsf) | `lsf` | Aruco résolue | caméra | *(participe à l'accusation)* | `TOILETTES` |
| [Apprentissage coloré](#apprentissage-coloré--colors) | `colors` | terminal `apprentissage` | caméra | — | `TABLEAU` |
| [Chatbot](#le-chatbot) | `chatbot` | terminal `prompt` | clavier | *(participe à l'accusation)* | `COULOIR` |
| [L'accusation](#laccusation--guilty) | `guilty` | LSF + chatbot | clavier | Finale | `FENETRE` |
| [Énigme finale](#énigme-finale--final) | `final` | accusation résolue | clavier | fin de partie | — |

Le code `apprentissage` donne aussi l'objet `BUREAU`. Le chatbot n'est pas une énigme au sens du code
(pas de classe `Enigma`), mais il fait partie de la chaîne.

**Toutes les énigmes** se résolvent avec le 
## ==code de triche== 
`iwanttocheat`, tapé n'importe où quand leur onglet est ouvert.

---

## Vrai ou faux — `aruco`

**Pour le joueur.** Huit cartes portent chacune une affirmation. L'équipe retourne chaque carte
côté « vrai » ou « faux », la pose à son emplacement sur le plateau de jeu, puis clique sur
**Vérifier**. L'énigme annonce combien de cartes sont justes et bien placées.

| Pièce | Fichier |
|---|---|
| Énigme | [GameLogic/Enigmas/ArucoEnigma.js](../GameLogic/Enigmas/ArucoEnigma.js) |
| Panneau | [UI/Panels/PanelAruco.js](../UI/Panels/PanelAruco.js) |
| Recognizer | [Inputs/Recognizers/ArucoRecognizer.js](../Inputs/Recognizers/ArucoRecognizer.js) |
| Contenu | [Config/ArucoBoard.js](../Config/ArucoBoard.js) — affirmations, marqueurs, disposition |

**Fonctionnement.** Chaque carte porte un marqueur Aruco différent sur chaque face. Le recognizer
repère les coins des deux feuilles, redresse l'image, et fournit la position de chaque marqueur **en
millimètres** sur sa feuille. Le recognizer tourne en permanence tant que l'onglet est ouvert, ce qui
lui permet de mémoriser les coins, mais l'énigme ignore ses résultats en dehors d'une vérification :
le clic sur **Vérifier** ouvre une fenêtre de quelques dizaines d'images, pendant laquelle elle compte
où chaque marqueur a été vu.

Au bout de la fenêtre, trois verdicts possibles :

- une feuille est restée presque tout le temps hors champ → « tous les coins ne sont pas visibles »,
  sans score ;
- sinon, les cartes dont **aucune** face n'a été vue à sa place sont listées (problème de détection,
  pas mauvaise réponse) ;
- et si les huit faces correctes ont été vues au moins une fois à leur place → victoire.

**Attention** : `correctId` dans `ArucoBoard.js` n'est pas « la face vrai » mais la face qui répond
juste. Pour une affirmation fausse, c'est la face « faux ».

| Réglage | Fichier | Valeur | Effet |
|---|---|---|---|
| `POSITION_TOLERANCE_MM` | ArucoEnigma | 10 | écart toléré entre un marqueur et son emplacement. Plus grand = cartes mal posées acceptées |
| `FRAMES_PER_CHECK` | ArucoEnigma | 25 | durée d'une vérification, soit ~2,5 s à 10 fps. Une carte vue **une seule fois** suffit |
| `MAX_FRAMES_WITHOUT_SHEET` | ArucoEnigma | 23 | au-delà, la feuille est jugée hors champ et le score n'est pas donné |
| `MAX_CORNER_AGE_FRAMES` | ArucoRecognizer | 200 | un coin caché (par une main) reste utilisable ~20 s |
| `MAX_HOMOGRAPHY_AGE_FRAMES` | ArucoRecognizer | 200 | idem pour le redressement d'une feuille entière |

---

## Signes — `lsf`

**Pour le joueur.** L'équipe doit épeler **P-L-A-N** en langue des signes, avec quatre mains devant la
caméra **en même temps**, et tenir la position un court instant. Une barre se remplit et un son
monte pendant le maintien. L'ordre des lettres n'a pas d'importance.

| Pièce | Fichier |
|---|---|
| Énigme | [GameLogic/Enigmas/LsfEnigma.js](../GameLogic/Enigmas/LsfEnigma.js) |
| Panneau | [UI/Panels/PanelLsf.js](../UI/Panels/PanelLsf.js) |
| Recognizer | [Inputs/Recognizers/LsfRecognizer.js](../Inputs/Recognizers/LsfRecognizer.js) |
| Reconnaissance des lettres | [Inputs/Recognizers/LsfDictionary.js](../Inputs/Recognizers/LsfDictionary.js) |

**Fonctionnement.** MediaPipe détecte jusqu'à quatre mains et fournit 21 points par main. Pour chaque
main, `LsfDictionary` regarde quels doigts sont pliés et mesure quelques distances, et en déduit une
lettre. L'énigme vérifie à chaque image que P, L, A et N sont tous présents. Tant que c'est le cas,
le maintien avance ; dès qu'une lettre disparaît, il repart de zéro.

Le dictionnaire reconnaît aussi B, D, H et I, qui ne servent à aucune énigme.

**P et N se font avec les mêmes doigts** (index et majeur tendus). Seul l'écart entre les deux les
distingue — c'est le réglage le plus sensible de cette énigme.

| Réglage | Fichier | Valeur | Effet |
|---|---|---|---|
| `LSF_HOLD_MS` | Config/GameConfig | 870 ms (c précis hein(c'est du pif)) | durée de maintien. Partagée avec le panneau : la barre et le son à la validation |
| `INDEX_MIDDLE_SPREAD` | LsfDictionary | 0.08 | frontière entre P (écartés) et N (collés). Plus grand = N plus facile, P plus exigeant |
| `REFERENCE_PALM` | LsfDictionary | 0.25 | taille de main de référence : les seuils ne dépendent pas de la distance à la caméra |
| `PLAY_ZONE_ZOOM` | LsfRecognizer | 0.7 | seul le centre de l'image est analysé, agrandi. Plus petit = zoom plus fort |
| `MAX_GAP_MS` | LsfEnigma | 500 ms | après une interruption plus longue (onglet quitté), le maintien repart de zéro |

---

## Apprentissage coloré — `colors`

**Pour le joueur.** Cinq pastilles de couleur sont posées sur la table. Toutes les 6 secondes, la
caméra regarde **laquelle est cachée** (par une main) et déplace un personnage dans un labyrinthe à
l'écran. Personne ne dit quelle couleur fait quoi : c'est à l'équipe de le découvrir.

| Pièce | Fichier |
|---|---|
| Énigme | [GameLogic/Enigmas/ColorsEnigma.js](../GameLogic/Enigmas/ColorsEnigma.js) |
| Panneau | [UI/Panels/PanelColors.js](../UI/Panels/PanelColors.js) |
| Recognizer | [Inputs/Recognizers/ColorsRecognizer.js](../Inputs/Recognizers/ColorsRecognizer.js) |
| Labyrinthe | [GameLogic/MiniGames/Maze.js](../GameLogic/MiniGames/Maze.js) |

### Le réglage du scanner

Avant de jouer, la caméra doit apprendre les couleurs réelles des pastilles sous l'éclairage de la
salle. C'est la première étape de l'énigme, et le labyrinthe reste caché tant qu'elle n'est pas faite.

| État | Ce qui se passe |
|---|---|
| `scanning` | on attend que la caméra voie exactement 5 cercles, pendant 5 images d'affilée |
| `confirm` | l'image se fige, chaque couleur affiche le numéro du cercle deviné. L'équipe vérifie |
| `fixing` | si c'est faux, l'équipe corrige les numéros à la main |
| `ready` | validé : l'image repart en direct et le labyrinthe apparaît |

**Le réglage n'est pas sauvegardé.** Après un rechargement de page, il faut le refaire, et le
labyrinthe repart du niveau 1.

### Les commandes

Une action est jouée toutes les **6 secondes**. Seules les **1,4 dernières secondes** (c'est du pif aussi) de la fenêtre
comptent : une pastille y est jugée cachée si elle manque sur plus de 75 % des images. **Exactement une** pastille cachée 
donne une action ; zéro ou plusieurs, rien ne se passe.

| Pastille cachée | Personnage blanc | Personnage gris |
|---|---|---|
| Rouge | haut | droite |
| Bleu | bas | gauche |
| Jaune | gauche | bas |
| Vert | droite | haut |
| Magenta | change de personnage | change de personnage |

### Les niveaux

1. **Un seul personnage** (blanc), qui doit atteindre la sortie. L'équipe apprend les commandes.
2. **Deux personnages.** Le blanc doit marcher sur l'interrupteur pour ouvrir la grille ; le gris doit
   ensuite atteindre le trésor. L'équipe doit découvrir le changement de personnage (magenta).

Les plans sont écrits en texte dans `MAZE_LEVELS` ([ColorsEnigma.js](../GameLogic/Enigmas/ColorsEnigma.js)) :
`#` mur, `.` sol, `S`/`E` départ et sortie du blanc, `O`/`T` départ et trésor du gris, `I`
interrupteur, `G` grille. Un niveau sans `O` n'a qu'un personnage : aucun code à changer.

| Réglage | Fichier | Valeur | Effet |
|---|---|---|---|
| `TICK_MS` | ColorsEnigma | 6000 ms | rythme du jeu : une action par fenêtre |
| `VOTING_MS` | ColorsEnigma | 1400 ms | partie de la fenêtre qui compte. Plus court = moins de temps à tenir la main |
| seuil `0.75` | ColorsEnigma.commitAction | 75 % | proportion d'images où la pastille doit manquer |
| `COLOR_REFERENCES` | ColorsRecognizer | teintes | teintes de départ des 5 encres, avant réglage |
| `MAX_HUE_GAP` | ColorsRecognizer | 10 | écart de teinte toléré. Plus grand = plus de confusions entre couleurs voisines |
| `MINIMUM_SATURATION` / `MINIMUM_LUMINOSITY` | ColorsRecognizer | 90 / 70 | sous ces seuils, un pixel est ignoré (trop gris, trop sombre) |
| `CIRCLES_EXPECTED` / `STABLE_FRAMES` | PanelColors | 5 / 5 | conditions pour figer l'image au réglage |

---

## Le chatbot

**Pour le joueur.** Un assistant conversationnel qui prétend aider à trouver le coupable. Il pose trois
questions (passion, longueur de cheveux, taille) et annonce un nom. **Il se trompe volontairement** : il
écarte d'emblée toutes les filles, alors que la coupable en est une.

| Pièce | Fichier |
|---|---|
| Logique | [GameLogic/Help/ChatBot.js](../GameLogic/Help/ChatBot.js) |
| Panneau | [UI/Panels/PanelChatbot.js](../UI/Panels/PanelChatbot.js) |
| Suspects | `SUSPECTS` dans [Config/GameConfig.js](../Config/GameConfig.js) |

**Fonctionnement.** Une machine à états : chaque état pose une question et associe les réponses
possibles à l'état suivant. Les fautes de frappe sont tolérées (distance de Levenshtein ≤ 2). La seule
passion acceptée est « rugby » ; toute autre passion connue reçoit une relance.

Parmi les garçons qui font du rugby, qui ont les cheveux courts et qui ont la taille correspondante, le coupable "est" Antoine.

Dès que le bot annonce **un seul nom** (Antoine), il le signale au moteur (`onCulpritFound`) : c'est l'une des
deux conditions de l'accusation. Le nom annoncé importe peu, il est faux dans tous les cas.

La conversation n'est pas sauvegardée : après un rechargement, elle recommence. Le fait que le bot ait
déjà désigné un coupable, lui, est conservé.

---

## L'accusation — `guilty`

**Pour le joueur.** L'équipe tape le prénom de la personne qu'elle accuse. La bonne réponse est
**Elise** — la fille que le chatbot avait écartée.

| Pièce | Fichier |
|---|---|
| Énigme | [GameLogic/Enigmas/GuiltyEnigma.js](../GameLogic/Enigmas/GuiltyEnigma.js) |
| Panneau | [UI/Panels/PanelGuilty.js](../UI/Panels/PanelGuilty.js) |

**Débloquée par deux conditions**, dans n'importe quel ordre : LSF résolue **et** le chatbot ayant
annoncé un nom.

**Fonctionnement.** La coupable est toujours le **premier** nom de `SUSPECTS`. La saisie est comparée
sans accents, sans ponctuation et sans casse. Chaque accusation passe par une fenêtre de confirmation,
pour qu'une faute de frappe ne coûte rien.

Le nombre d'essais n'est pas limité. À la place, chaque erreur impose une attente croissante, ce qui suffit à empêcher d'essayer les dix prénoms.

| Réglage | Valeur | Effet |
|---|---|---|
| `COOLDOWNS_SECONDS` | 10, 40, 60, 180 | attente après la 1ʳᵉ, 2ᵉ, 3ᵉ erreur, puis 180 s pour toutes les suivantes |

**Limite connue** : le compteur d'erreurs n'est pas sauvegardé. Un rechargement de page ramène
l'attente à 10 s. (J'y avais pas pensé t'es un malin Opus)

---

## Énigme finale — `final`

**Pour le joueur.** Une image s'affiche ; l'équipe doit y lire une adresse IP et la taper. **Deux essais
seulement**, avec 5 secondes d'attente entre les deux.

| Pièce | Fichier |
|---|---|
| Énigme | [GameLogic/Enigmas/FinalEnigma.js](../GameLogic/Enigmas/FinalEnigma.js) |
| Panneau | [UI/Panels/PanelFinal.js](../UI/Panels/PanelFinal.js) |
| Image | [assets/pictures/visuel_final.png](../assets/pictures/visuel_final.png) |

**Fonctionnement.** Seuls les chiffres comptent : `157-086-066-146`, `157.086.066.146` et
`157086066146` sont équivalents. Chaque essai passe par une confirmation, pour qu'une erreur de lecture
ne gâche pas l'une des deux chances. La résoudre gagne la partie : le chrono se fige et la sauvegarde
est effacée.

| Réglage | Valeur | Effet |
|---|---|---|
| `CORRECT_CODE` | `157-086-066-146` | le code attendu, à changer si l'image change |
| `MAX_TRIES` | 2 | nombre d'essais |
| `SECONDS_BETWEEN_TRIES` | 5 | attente entre deux essais |
| `VISUAL_PATH` | `assets/pictures/visuel_final.png` | l'image affichée. Si le fichier manque, le cadre est masqué |

**Limites connues** :

- **Épuiser les deux essais ne termine pas la partie.** Le panneau annonce l'échec et bloque la saisie,
  mais la partie continue jusqu'à la fin du chrono, qui affiche alors l'écran de défaite.
- **Le nombre d'essais restants n'est pas sauvegardé.** Un rechargement de page rend deux essais neufs.
