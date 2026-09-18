# Architecture

Comment le code est organisé, et pourquoi.

**Si jamais il y a quelconque problème, bug problématique merci de contacter : lumia.projet@proton.me**

À lire en premier pour reprendre le projet. Le détail de chaque énigme est dans
[enigmes.md](enigmes.md), la vision par ordinateur dans [vision.md](vision.md), et que faire quand la
détection se comporte mal dans [depannage.md](depannage.md).

---

## 1. Ce qu'est ce site web

Un escape game d'une heure, joué dans un navigateur devant une webcam. Une équipe résout des
énigmes, certaines en disposant des objets physiques que la caméra lit, d'autres en tapant des
réponses.

Trois contraintes :

- **Aucun réseau.** OpenCV et MediaPipe sont embarqués dans `vendor/`, la police dans
  `assets/fonts/`. Pas de CDN, pas de Google Fonts, rien n'est téléchargé à l'exécution. Aussi,
  le site est purement statique.
- **Aucune étape de build.** Des modules ES bruts, ouverts directement depuis `index.html`. Pas de
  npm, pas de bundler.
- **Une seule page.** Un unique document HTML contient tous les panneaux.

---

## 2. Les couches

```
                          main.js
                  la séquence de démarrage
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
     GameLogic            Inputs                 UI
    les règles          la caméra         ce qui est à l'écran
         │                   │                   │
         └───────────────────┴───────────────────┘
                             │
                             ▼
                          le socle
      Config · Utils · Audio · Progression · SaveManager
                  AlertManager · Maze
```

### Les dossiers de code

| Dossier | Contient | Dépend de |
|---|---|---|
| [`main.js`](../main.js) | la séquence de démarrage | tout |
| [`GameLogic/`](../GameLogic) | les règles : moteur, énigmes, progression, sauvegarde, chrono, chatbot | Inputs, UI, socle |
| [`Inputs/`](../Inputs) | la caméra et le clavier, traduits en état lisible par le jeu | socle |
| [`UI/`](../UI) | onglets, panneaux, animations, modales | socle |
| [`Audio/`](../Audio) | un contexte audio, et des générateurs de sons | rien |
| [`Config/`](../Config) | le **contenu** du jeu, modifiable sans impact | rien |
| [`Utils/`](../Utils) | la **structure** du jeu (ids, statuts), des fonctions utilitaires, le chargement des bibliothèques | rien |

### Les autres dossiers

| Dossier | Contient |
|---|---|
| [`assets/`](../assets) | fichiers statiques : la police, les images |
| [`vendor/`](../vendor) | code de librairies externes, à ne pas modifier : OpenCV, MediaPipe et son modèle |
| [`styles/`](../styles) | le CSS |
| [`docs/`](.) | It's just the doc bro (hopefully ça t'aide) |

Convention : Les dossiers de code sont en PascalCase et les autres en minuscules.

               
### `Config/` et `Utils/Constant.js` :

Deux fichiers portent des constantes partagées.

[`Utils/Constant.js`](../Utils/Constant.js) contient la **structure** : `ENIGMA_STATUS`,
`ENIGMA_IDS`, `HELP_IDS`, `SCREEN_IDS`. Le code s'appuie dessus pour fonctionner, et `index.html`
reprend ces ids dans ses attributs `data-target`. On ne les change pas sans changer du code ailleurs.

[`Config/GameConfig.js`](../Config/GameConfig.js) contient le **contenu** : les objets à gagner, les
suspects, la durée de maintien des signes LSF. [`Config/ArucoBoard.js`](../Config/ArucoBoard.js) fait
de même pour l'énigme des cartes, dont il décrit aussi le plateau physique. Modifiable sans conséquences.

### Le socle

Ses modules n'importent rien, ou seulement d'autres modules du socle (`Progression` importe `Constant` 
par exemple). N'importe qui peut donc les importer sans jamais créer d'import circulaire.

---

## 3. Déroulement d'une partie

### Démarrage — [`main.js`](../main.js)

1. **Page chargée.** `GameEngine.init()` charge OpenCV, puis MediaPipe, puis construit les énigmes,
   le chatbot, et branche le terminal. Le bouton caméra reste désactivé jusqu'à la fin.
2. **Bouton caméra.** Demande la webcam au navigateur. Le bouton de démarrage ne s'active qu'une fois
   une image réellement décodée pour que l'équipe puisse cadrer son plateau avant que le chrono ne parte.
3. **Bouton de démarrage.** Un seul écouteur fait les deux moitiés, dans l'ordre :
   `gameEngine.start()`, puis `uiManager.leaveWelcomeScreen()`. Il ne fait rien si la caméra ne tourne
   pas vraiment.

### Déroulement — [`GameEngine.loop()`](../GameLogic/GameEngine.js)

Fait par `requestAnimationFrame`, plafonnée à **10 images par seconde** (`fpsTarget`). `requestAnimationFrame`
tourne à 60Hz (ou plus en fonction de l'écran). Les images arrivées trop tôt sont ignorées.

Chaque tick ne met à jour **que l'énigme dont l'onglet est ouvert** :

```js
const openTabId = uiManagerInstance.tabManager.activeTabId;
for (const enigma of this.activeEnigmas) {
    if (enigma.id === openTabId) enigma.update();
}
```

La caméra est une ressource unique et partagée. Une énigme laissée dans 
un autre onglet est gelée, pas active en arrière-plan.

Rien ne tourne tant que `isTransitioning` est vrai : empêche une résolution et ses
cinématiques de se chevaucher avec le tick suivant. 

### Résolution — `Enigma.onSuccess()` → `GameEngine.completeEnigma()`

Dans l'ordre :

1. refus si la progression indique déjà « résolue »,
2. `progression.markResolved()`, l'onglet passe au vert,
3. sortie du pool actif,
4. animations dans l'ordre de :réussite ("énigme réussie"), puis les énigmes débloquées, puis l'objet physique — le tout dans la même
   file d'animations, pour qu'elles se jouent l'une après l'autre au lieu de se superposer,
5. `cleanOfMemory()` sur l'énigme,
6. nouvelle vérification des deux règles qui peuvent débloquer l'énigme accusation (guilty) ou terminer la partie,
7. sauvegarde de la progression.

### Fin — `GameEngine.endGame(outcome)`

Que le chrono se finisse ou que l'équipe obtienne la victoire on passe par cette fonction. Seul le premier appel compte.

**La victoire laisse volontairement l'interface intacte** — l'équipe peut revoir les onglets
qu'elle a résolus (moi j'aime bien regarder les onglets donc j'ai fait ça). **La défaite retire tout** : 
l'écran de défaite masque les boutons des onglets pour qu'il ne reste plus rien à faire.

---

## 4. Où vit l'état de la partie

**Ici : [`GameLogic/Progression.js`](../GameLogic/Progression.js).**

Capable de répondre à *« cette énigme est-elle verrouillée, disponible ou résolue ? »*. 
Elle contient un statut par élément déverrouillable, le drapeau du chatbot, les règles
de déblocage et le format de sauvegarde.

| Statut | Pour le joueur | Dans le code |
|---|---|---|
| `LOCKED` | aucun bouton dans la barre de navigation | point de départ de tout, sauf Aruco |
| `AVAILABLE` | bouton orange, panneau normal | l'énigme tourne dans le pool actif |
| `RESOLVED` | bouton vert, panneau de victoire | sortie du pool ; masque la webcam |

Le chemin est `LOCKED → AVAILABLE → RESOLVED` et ne revient pas en arrière.

---

## 5. Arborescence du jeu

```
   start()               terminal « prompt »       terminal « apprentissage »
      │                           │                             │
      ▼                           ▼                             ▼
    ARUCO                      CHATBOT                       COLORS
   (PORTE)                    (COULOIR)                 (BUREAU, TABLEAU)
      │                           │
      ▼                           │  désigne            hors chaîne, mais
     LSF                          │  un coupable        donne des indices
 (TOILETTES)                      │
      │                           │
      └─────────────┬─────────────┘
                    │  les deux sont nécessaires
                    ▼
                 GUILTY
                (FENETRE)
                    │
                    ▼
                  FINAL
                    │
                    ▼
              partie gagnée
```

Entre parenthèses, le lieu débloqué (voir `IRL_REWARDS`). Il s'obtient en résolvant l'énigme, sauf
`COULOIR` et `BUREAU`, donnés dès que le code est tapé dans le terminal.

- **Aruco** est ouvert par `start()`, et débloque **LSF** une fois résolu.
- **Colors** et le **chatbot** ne font pas partie de la chaîne : ils sont ouverts par des codes tapés
  dans le terminal, que l'équipe trouve dans la salle. Techniquement débloquer colors n'est pas nécessaire
  pour faire la suite, mais dans le jeu il donne des indices primordiaux pour la suite.
- **L'accusation** exige *deux* conditions : LSF résolue **et** le chatbot ayant réduit ses suspects à
  un seul nom (détecté par un flag). Elles peuvent survenir dans n'importe quel ordre, c'est pourquoi
  [`shouldUnlockGuilty()`](../GameLogic/Progression.js) est réinterrogée chaque fois que l'une d'elles
  devient vraie.
- **L'énigme finale** est la dernière énigme. La résoudre termine la partie.

Chaque énigme déclare dans son propre appel à `super(...)` ce qu'elle débloque et l'objet physique
que l'équipe gagne. Ces objets sont définis dans `IRL_REWARDS`([`Config/GameConfig.js`](../Config/GameConfig.js))
et désignent un lieu du bâtiment — `PORTE`,`TOILETTES`...

---

## 6. Anatomie d'une énigme

Jusqu'à quatre éléments (et au minimum 2, une énigme, un panneau) :

| Element | Rôle | Exemple |
|---|---|---|
| **L'énigme** | la règle : quand est-elle gagnée ? | [`ArucoEnigma.js`](../GameLogic/Enigmas/ArucoEnigma.js) |
| **Le panneau** | le DOM : ce que voit le joueur. | [`PanelAruco.js`](../UI/Panels/PanelAruco.js) |
| **Le recognizer** | transforme les pixels de la caméra en état lisible par le jeu | [`ArucoRecognizer.js`](../Inputs/Recognizers/ArucoRecognizer.js) |
| **La config** | le contenu : affirmations, disposition, niveaux | [`ArucoBoard.js`](../Config/ArucoBoard.js) |

Seules trois énigmes utilisent la caméra : colors, aruco et lsf et donc un recognizer. Aruco est le seul 
à avoir un config. **L'accusation** et **l'énigme finale** se jouent au clavier, et leur `update()` est 
vide : au lieu d'être interrogées à chaque tick, elles attendent (`await`) ce que le joueur soumet.

Le chatbot est à part. Il se débloque comme une énigme et possède un onglet, mais il n'a pas de classe
`Enigma` et n'entre jamais dans le pool actif — il attend des saisies, la boucle n'en a donc rien à faire
de lui (pauvre chatbot). Il n'a pas non plus de panneau de victoire : il n'est jamais « résolu ». Il signale ce qu'il a
trouvé par un callback `onCulpritFound` (el famoso flag).

---

## 7. Sauvegarde et restauration

Un rechargement en pleine partie ne coûte pas sa progression à l'équipe.

[`GameLogic/SaveManager.js`](../GameLogic/SaveManager.js) écrit dans le `localStorage` sous la clé
`jepeia_progression`. Le contenu est construit et relu par `Progression.toSave()` /
`Progression.restore()` ; le SaveManager ne fait que stocker les octets.

Ce qui est sauvegardé : le statut de chaque élément déverrouillable, l'heure de départ du chrono, le
drapeau du chatbot. Ce qui **ne l'est pas** : la conversation du chatbot, et l'avancement *à
l'intérieur* d'une énigme non terminée. Ceux-là repartent de zéro.

À la restauration, `TabManager.showProgression()` repeint toute la barre de navigation à partir de la
progression, et chaque énigme débloquée mais non résolue retourne dans le pool actif. Aucune
animation n'est rejouée.

La sauvegarde est supprimée à la fin de la partie, victoire ou défaite, pour que l'équipe suivante
parte de zéro. `resetProgression()` dans la console du navigateur et le bouton sur la page d'accueil font de même.

Petit bug que je connais : vu que le timer est relié à l'heure de l'ordinateur, si vous rechargez une sauvegarde
qui a commencé il y a longtemps le timer va être à 0 mais vous aurez toujours vos onglets... Vu que c'est un cas
qui ne devrait pas arriver je n'ai rien fait à ce propos.

Pareil le timer continue à tourner même si l'ordinateur est en veille...

---

## 8. Contraintes à connaître

**Le DOM est lu à la construction.** Une trentaine d'appels à `getElementById` s'exécutent au
chargement des modules, dans les managers de l'UI et dans `InputManager`. Cela fonctionne parce
qu'`index.html` charge une unique balise script, en `type="module"`, qui est différée : le HTML est
entièrement analysé avant. Cela casserait si quelqu'un ajoutait `async`, ou déplaçait la balise dans
le `<head>` sans `defer` (en tout cas c'est ce qu'Opus dit).

**Le graphe d'imports n'a aucun cycle (normalement '-')** Un cycle réintroduit
ne se voit pas forcément tout de suite : la page peut continuer de fonctionner jusqu'au jour où une
lecture tombe au mauvais moment. Il vaut mieux évite de faire un import qui remonte vers `GameEngine` ou
`UIManager` (ça valait bien le coup de faire des singletons), au risque de créer un import circulaire.

**Le déploiement publie tout le dépôt.** GitHub Pages
([static.yml](../.github/workflows/static.yml)) envoie la racine entière, `docs/` compris.

---

## 9. Notes (peu important mais c'est notable eheh)

> **Un module n'importe jamais celui qui le construit.**

On lui donne ce dont il a besoin, soit par son constructeur, soit par une méthode `connect()`.

Deux écritures possibles, le choix dépend de **qui construit l'objet, et quand** :

**L'injection par le constructeur** — quand le constructeur dispose déjà de ce qu'il faut.

```js
// GameEngine.loadEnigmas()
const context = { engine: this, ui: uiManagerInstance, input: inputManagerInstance };
const lsf = new LsfEnigma(context);
```

Chaque énigme reçoit ainsi `this.engine`, `this.ui` et `this.input`. Aucun des six fichiers
d'énigmes n'importe de singleton. Même principe dans l'UI : [`UIManager`](../UI/UIManager.js) passe
`tabManager` à `Animations` et à `PanelManager`, et `animations` à `TerminalManager`.

**Une méthode `connect()`** — quand l'objet est construit avant que ce dont il a besoin n'existe.

```js
// GameEngine.connectTerminal(), appelée depuis init()
uiManagerInstance.terminalManager.connect((idUnlockable) => this.activate(idUnlockable));
```

Le terminal est construit par `UIManager`, avant que le moteur ait fini de charger ses modèles.
Il est donc branché après coup.`PanelColors.connectCalibration` et `PanelAruco.connectVerifyButton` suivent le même
schéma, tout comme `new Timer(() => this.handleTimeOver())`.

### Les singletons

`gameEngineInstance`, `uiManagerInstance`, `inputManagerInstance`, `audioManagerInstance` et
`progressionInstance` sont tous créés au chargement de leur module. C'est sans danger **parce que
seuls des modules situés au-dessus d'eux les importent** : quand `main.js` s'exécute, ils sont
entièrement construits. D'ailleurs le singleton de `gameEngineInstance` ne sert plus à rien, il est
appelé seulement dans le main (quel language ce js !).

---

## 10. Par où commencer

Dans cet ordre :

1. [`main.js`](../main.js) — la séquence de démarrage
2. [`GameLogic/Progression.js`](../GameLogic/Progression.js) — l'état, et les règles de la chaîne
3. [`GameLogic/GameEngine.js`](../GameLogic/GameEngine.js) — `init`, `start`, `loop`, `completeEnigma`
4. [`GameLogic/Enigmas/Enigma.js`](../GameLogic/Enigmas/Enigma.js) — ce dont hérite chaque énigme
5. [`GameLogic/Enigmas/ArucoEnigma.js`](../GameLogic/Enigmas/ArucoEnigma.js), avec son panneau et sa
   config — l'exemple le plus clair des quatre pièces travaillant ensemble

J'ai essayé de faire propre, on en est loin. Si tu veux éviter d'avoir une indigestion de bolognaise,
ne va pas voir tout ce qui est relié à l'énigme colors (surtout le recognizer et le panel). Pareil pour aruco
dans une certaine mesure. Le reste est à peu près ok normalement. Bon après tout ce qui est CSS et audio y'a pas
une ligne de code que j'ai fait mais bon...

Si jamais colors ou aruco pose problème (ou autre chose d'ailleurs), n'hésite pas à me demander d'abord.

J'aimerai aussi remercier les LLM sans qui ce site n'aurait jamais été aussi propre et joli (par contre vous allez
me piquer mon job dans 2 ans pas cool).

---




