# La vision par ordinateur

Comment les trois énigmes caméra transforment une image en information de jeu. Ce document explique
**pourquoi** les réglages fonctionnent comme ils le font ; la liste des réglages et leur effet côté jeu
est dans [enigmes.md](enigmes.md).

| Énigme | Bibliothèque | Recognizer | Ce qu'il fournit au jeu |
|---|---|---|---|
| Vrai ou faux | OpenCV (module ArUco) | [ArucoRecognizer.js](../Inputs/Recognizers/ArucoRecognizer.js) | position de chaque marqueur sur sa feuille, dans le repère de la feuille |
| Apprentissage coloré | OpenCV | [ColorsRecognizer.js](../Inputs/Recognizers/ColorsRecognizer.js) | l'ensemble des couleurs visibles |
| Signes | MediaPipe | [LsfRecognizer.js](../Inputs/Recognizers/LsfRecognizer.js) | une lettre par main détectée |

---

## 1. Ce qui est commun

### Une seule caméra, un seul recognizer à la fois

[`VisionController`](../Inputs/Controller/VisionController.js) possède la webcam et les trois
recognizers. À chaque tick, il n'appelle **que** celui de l'onglet ouvert. Tous écrivent dans le même
objet, `currentResults` :

```js
{ gestures: [], colors: new Set(), markers: [], sheetsVisible: [] }
```

L'énigme le relit juste après via `input.getState()`.

### La résolution

La caméra est demandée en **1280×720**, en `ideal` et non en `exact` : si elle refuse, on prend ce
qu'elle propose plutôt que d'échouer. Chaque recognizer lit ensuite la résolution réellement obtenue.

Les recognizers OpenCV allouent leurs matrices dans `attachVideoSource()`, appelée seulement quand la
première image est décodée — avant, les dimensions de la vidéo valent 0. Juste avant, `video.width` et
`video.height` (les *attributs* HTML) sont alignés sur la taille réelle du flux : `cv.VideoCapture` se
fie aux attributs, et un écart provoque l'erreur `Bad size of input mat`.

### L'affichage

Le flux est affiché par la balise `<video>` elle-même. Un `<canvas>` transparent posé par-dessus sert
de calque : les cercles de Colors, les mains de LSF. Aruco n'y dessine rien, mais l'efface à chaque
image pour qu'il ne reste pas figé le dessin de l'énigme précédente.

### Le chargement des bibliothèques

Les deux sont embarquées dans `vendor/` et chargées depuis [`Utils/LibraryLoading/`](../Utils/LibraryLoading).

OpenCV et MediaPipe sont tous deux compilés en WebAssembly avec Emscripten, dont les scripts
s'appuient sur une variable globale `window.Module`. Pour qu'OpenCV n'écrase pas celle de MediaPipe,
[`LoadOpenCV.js`](../Utils/LibraryLoading/LoadOpenCV.js) la met de côté pendant son propre chargement,
puis la restaure. Si un jour l'une des deux bibliothèques se charge mal quand l'autre est présente,
c'est ici qu'il faut regarder en premier.

### La mémoire OpenCV

Les matrices OpenCV (`cv.Mat`) vivent dans la mémoire WebAssembly, que le ramasse-miettes de JavaScript
ne voit pas. **Toute matrice créée doit être libérée à la main avec `.delete()`**, sinon elle fuit (si tu le dis mon grand je te crois).
Les matrices temporaires de chaque image sont libérées dans des blocs `try / finally`, pour l'être même
en cas d'erreur.

Colors libère ses matrices de travail à sa résolution (`cleanOfMemory`). **Aruco ne le fait pas** : ses
quelques objets restent alloués jusqu'au rechargement de la page.

---

## 2. Aruco — lire des cartes sur un plateau

Les marqueurs Aruco sont des carrés noir et blanc, chacun codant un numéro. Le dictionnaire utilisé est
`DICT_4X4_100` : des motifs de 4×4 cases, numérotés de 0 à 99.

### Le pipeline, à chaque image

```
image couleur ──► niveaux de gris ──► CLAHE ──► détection des marqueurs
                                                        │
                           centre de chaque marqueur ◄──┘
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
   coins des feuilles mémorisés               tous les autres marqueurs
               │                                         │
               ▼                                         │
   homographie : pixels → repère feuille ───────────────►│
                                                         ▼
                             position dans le repère de chaque feuille visible
```

**CLAHE** égalise le contraste *localement*, par zones. Le plateau est rarement éclairé de façon
uniforme, et un marqueur dans l'ombre ne serait pas détecté sans cette étape. Réglage : `CLAHE(1.5,
4×4)`, soit un contraste limité à 1,5 sur une grille de 4×4 zones.

Le **centre d'un marqueur** est la moyenne de ses quatre coins.

### Redresser la feuille : l'homographie

La caméra voit le plateau de biais : un rectangle y apparaît comme un quadrilatère quelconque.
L'**homographie** est la transformation qui ramène ce quadrilatère au rectangle réel.

Chaque feuille porte un marqueur à chacun de ses quatre coins (voir
[`Config/ArucoBoard.js`](../Config/ArucoBoard.js)). Dès que les quatre sont connus,
`cv.findHomography` calcule la correspondance entre leurs positions en pixels et les coins d'un
rectangle de référence de **262 × 175** (`SHEET_SIZE_MM`). Chaque marqueur détecté est ensuite projeté
par `cv.perspectiveTransform` dans ce repère.

C'est ce qui rend l'énigme indépendante de l'angle de la caméra : les positions attendues des cartes
sont écrites une fois pour toutes dans ce repère.

**Ces unités ne sont pas de vrais millimètres.** Une seule caméra ne voit pas la profondeur : une feuille
A3 vue de haut donne la même image qu'une feuille A4 vue de plus près. Le repère ne dépend que des quatre
coins, donc seules comptent les **proportions** : on peut imprimer le plateau à n'importe quelle échelle,
tant que tout est agrandi ensemble (feuille, marqueurs, emplacements des cartes). Les tolérances comme
`POSITION_TOLERANCE_MM` (10) s'expriment donc en fraction de feuille (10 / 262 ≈ 4 % de sa largeur), pas
en distance réelle. La seule vraie limite physique : chaque marqueur doit couvrir assez de pixels pour être
lu, ce qui dépend de sa taille **et** de la hauteur de la caméra (et de la résolution de cette dernière logiquement).

### Tolérer les mains qui passent

Pendant le jeu, des mains cachent régulièrement un coin. Pour ne pas perdre la feuille à chaque fois, le
recognizer garde **deux niveaux de mémoire** :

1. **Chaque coin** garde sa dernière position connue, et vieillit d'une unité par image analysée. Tant
   qu'il a moins de `MAX_CORNER_AGE_FRAMES` (200), il reste utilisable.
2. **Chaque homographie** est conservée. Si un coin manque, la dernière homographie calculée sert encore,
   jusqu'à `MAX_HOMOGRAPHY_AGE_FRAMES` (200).

Les âges se comptent **en images analysées** : à 10 fps, 200 images font 20 secondes.

### Ce que reçoit l'énigme

Chaque marqueur détecté est projeté sur **chaque** feuille visible. Un marqueur posé sur la feuille 1
apparaît donc aussi « sur » la feuille 2, avec des coordonnées qui ne tombent sur aucun emplacement.
C'est l'énigme qui trie, en comparant `marker.sheetID` à la feuille de chaque carte.

Une feuille dont les quatre coins sont présents est déclarée visible même si l'homographie échoue : «
visible » signifie que l'équipe a bien cadré son plateau.

### Pistes de réglage

- La grille CLAHE de 4×4 découpe une image 1280×720 en zones de 320×180 pixels. Des zones plus petites
  (8×8) s'adapteraient mieux à un éclairage très inégal, au prix d'un peu plus de bruit.
---

## 3. Colors — reconnaître des pastilles de couleur

### Le pipeline, à chaque image

```
image couleur ──► moitié de la résolution ──► gris ──► flou ──► détection de cercles
                                                                        │
                                  pour chaque cercle trouvé ◄───────────┘
                                             │
                                             ▼
                      échantillonner un petit disque au centre, en HSV
                                             │
                                             ▼
                      chaque pixel vote pour une couleur, ou « Unknown »
                                             │
                                             ▼
                      couleur du cercle = celle qui a la majorité
```

**Moitié de la résolution** (`cv.pyrDown`). Une pastille est une grosse tache : 640×360 suffit, et tout
le reste coûte quatre fois moins cher. Les rayons ci-dessous sont réglés à cette échelle.

**Détection de cercles** (`cv.HoughCircles`) sur l'image en gris, floutée pour éviter les faux contours :

| Paramètre | Valeur | Rôle |
|---|---|---|
| `minDist` | 50 | distance minimale entre deux centres : évite de trouver deux cercles dans une même pastille |
| `param1` | 100 | seuil de détection des contours. Plus haut = seuls les contours nets comptent |
| `param2` | 38 | seuil de « vote » du centre. **Plus bas = plus de cercles trouvés, faux compris** |
| `minRadius` / `maxRadius` | 16 / 27 | taille acceptée d'une pastille, en pixels à 640×360 |

min et maxRadius sont réglés pour être pas trop gentils (pour éviter de faux positifs), si jamais les cercles ne sont pas
détectés, essayez de changer ces valeurs.

### Identifier la couleur

On travaille en **HSV** (teinte, saturation, luminosité) plutôt qu'en RGB : la teinte dit *quelle*
couleur, indépendamment de l'éclairage, qui joue surtout sur la luminosité. **Dans OpenCV, la teinte va
de 0 à 179**, pas de 0 à 359.

Pour chaque cercle, on échantillonne un disque de rayon **1/3 du cercle** en son centre — assez loin du
bord pour ne jamais mordre sur le contour ni sur le fond — un pixel sur deux (`SAMPLE_STEP`).

Chaque pixel est classé :

1. trop terne (saturation < 90) ou trop sombre (luminosité < 70) → `Unknown` ;
2. sinon, la couleur de référence dont la teinte est la plus proche, **si** l'écart est ≤ `MAX_HUE_GAP`
   (10) ;
3. sinon → `Unknown`.

La couleur gagnante doit avoir au moins 3 votes, et **au moins la moitié de tous les pixels
échantillonnés** — `Unknown` compris. Un cercle à moitié dans l'ombre reste donc `Unknown` plutôt que de
donner une couleur incertaine. Un faux positif déplacerait le personnage à
tort, un « inconnu » ne fait rien.

### La roue des teintes reboucle

La teinte est un angle : 179 et 1 sont voisins. Deux conséquences dans le code :

- l'écart entre deux teintes se calcule modulo 180 (`hueDistance`) : entre 178 et 2 il y a 4, pas 176 ;
- la teinte d'un cercle est la **plus fréquente** (histogramme), pas la moyenne. Sur du rouge, les
  pixels se répartissent autour de 0 et de 179 ; leur moyenne vaudrait 90 — du cyan.

### Les couleurs de référence

| Couleur | Teinte de référence | Teinte du fichier source |
|---|---|---|
| Rouge | 7 | 0 |
| Jaune | 28 | 25 |
| Vert | 56 | 74 |
| Bleu | 115 | 124 |
| Magenta | 167 | 150 |

Les teintes **mesurées sur les impressions** diffèrent nettement de celles du fichier d'origine :
l'encre et l'éclairage déplacent la couleur. C'est tout l'intérêt du réglage en début d'énigme.

`MAX_HUE_GAP` vaut 10 parce que c'est la moitié du plus petit écart entre deux pastilles : 20, entre le
rouge (7) et le magenta (167), la roue rebouclant. **Si un réglage rapproche deux teintes**, cet écart
peut devenir trop grand et les deux couleurs se confondre.

### Le réglage des teintes

Au début de l'énigme, la caméra doit voir exactement 5 cercles.

1. Les cercles sont figés et **numérotés de haut en bas, puis de gauche à droite** — l'ordre dans lequel
   `HoughCircles` les rend change à chaque image, ce tri le rend stable.
2. Chaque couleur de référence choisit, **dans l'ordre Rouge, Jaune, Vert, Bleu, Magenta**, le cercle
   restant de teinte la plus proche. C'est la proposition affichée aux joueurs.
3. Validée ou corrigée, l'affectation remplace la teinte de référence de chaque couleur par la teinte
   mesurée de son cercle.

Le réglage vit en mémoire et **disparaît au rechargement**. Les teintes réglées sont écrites dans la
console (`🎨 teintes réglées : …`) : les recopier dans `COLOR_REFERENCES` les rend définitives. Le
bouton de retour aux couleurs d'origine ramène aux valeurs du fichier.

### Le calque

Chaque cercle détecté est entouré : **rouge** si sa couleur est reconnue, **orange** si elle est
`Unknown`. Pendant le réglage, son numéro s'affiche en son centre. Les coordonnées étant calculées à
demi-résolution, elles sont remises à l'échelle du flux avant d'être dessinées.

---

## 4. LSF — reconnaître des lettres de la langue des signes

### Le pipeline, à chaque image

```
image 1280×720 ──► centre (70 %) recopié et agrandi en 640×360 ──► MediaPipe (4 mains max)
                                                                            │
                                         21 points par main ◄───────────────┘
                                                  │
                                                  ▼
                              doigts pliés ou tendus, quelques distances
                                                  │
                                                  ▼
                                       une lettre, ou rien
```

**Le recadrage** (`PLAY_ZONE_ZOOM = 0.7`). La caméra est loin des joueurs : leurs mains ne couvrent
qu'une petite partie de l'image. On n'envoie à MediaPipe que le centre, agrandi. Le modèle travaille en
interne sur une image réduite (192*192) ; sans ce zoom, une main réduite depuis la pleine image n'occupe plus que
quelques pixels et perd ses détails.

**MediaPipe** tourne en mode `VIDEO` (il exploite l'image précédente pour suivre les mains), sur **CPU**,
et détecte **jusqu'à 4 mains** — autant que de lettres dans « PLAN ». Plus on augmente le nombre de mains
detéctées, plus on augmente le lag de manière ostensible.

**Le calque** redessine l'image *analysée*, pas la vidéo en direct, puis les mains par-dessus. Sinon
les points, qui arrivent avec le délai d'une inférence, traîneraient derrière une image qui a déjà
avancé.

### Les 21 points d'une main

```
           8   12  16  20        bouts des doigts
           │   │   │   │
           6   10  14  18        articulations du milieu
           │   │   │   │
    4      5───9───13──17        bases des doigts
     \      \  │   │   /
      2      \ │   │  /
       \      \│   │ /
        1──────0─────            0 : poignet
       pouce
```

| Doigt | Base | Milieu | Bout |
|---|---|---|---|
| pouce | 1 | 2 | 4 |
| index | 5 | 6 | 8 |
| majeur | 9 | 10 | 12 |
| annulaire | 13 | 14 | 16 |
| auriculaire | 17 | 18 | 20 |

### Doigt plié ou tendu

Dans [`HandMaths.js`](../Inputs/Recognizers/HandMaths.js), un doigt est **plié** si son bout est plus
près du poignet que son articulation du milieu. Pour le pouce, c'est le point 2 qui sert de repère.

### Ne pas dépendre de la distance

Une même lettre donne des distances deux fois plus grandes si la main est deux fois plus proche. Toutes
les distances sont donc divisées par la **taille de la paume** (du poignet, point 0, à la base du
majeur, point 9), puis ramenées à une paume de référence (`REFERENCE_PALM = 0.25`). Les seuils de
[`LsfDictionary.js`](../Inputs/Recognizers/LsfDictionary.js) sont exprimés dans cette unité.

**À savoir** : les coordonnées de MediaPipe sont normalisées entre 0 et 1 sur la **largeur** et sur la
**hauteur** de l'image analysée, qui est en 16:9. Une distance de 0,1 vaut donc 64 pixels à
l'horizontale mais 36 à la verticale. Une même main ne donne pas exactement les mêmes distances couchée
ou debout — un seuil qui marche main droite peut échouer main inclinée.

### Les lettres, dans l'ordre où elles sont testées

**La première lettre qui correspond gagne**, l'ordre compte.

| Lettre | Doigts tendus | Condition supplémentaire |
|---|---|---|
| B | les quatre | doigts serrés, pouce replié sur la paume |
| D | index seul | bout du pouce contre le bout du majeur |
| A | aucun (poing) | pouce sorti, loin de la base de l'index |
| A | aucun (poing) | *(ancien « E »)* bout de l'index loin du poignet |
| P | index + majeur | **écartés** (> `INDEX_MIDDLE_SPREAD`) |
| H | index + auriculaire | — |
| N | index + majeur | **collés** (≤ `INDEX_MIDDLE_SPREAD`) |
| I | auriculaire seul | — |
| L | index seul | pouce écarté, loin de la base de l'auriculaire |

Trois paires se distinguent sur un seul critère, et ce sont elles qui posent problème en jeu :

- **P et N** : mêmes doigts, seul l'écart index-majeur les sépare ;
- **D et L** : index seul dans les deux cas, c'est le pouce qui décide. Un pouce ni collé au majeur ni
  franchement écarté ne donne **aucune** lettre ;
- **A et E** : trop proches pour ce dictionnaire, ils ont été fusionnés en A parce que le E n'était pas utilisé dans le mot PLAN.

---

## 5. Performances

Les trois recognizers ne tournent jamais en même temps : seul celui de l'onglet ouvert est appelé, et
la boucle est plafonnée à 10 images par seconde.

| Recognizer | Ce qui le rend supportable |
|---|---|
| Aruco | image en gris, un seul passage de détection |
| Colors | travail à demi-résolution ; la conversion HSV n'est faite que si des cercles ont été trouvés |
| LSF | image réduite à 640×360 avant l'inférence |

Colors et LSF ignorent une image qu'ils ont déjà analysée (même `video.currentTime`). Aruco ne fait pas
ce test : une webcam livrant en général plus de 10 images par seconde, chaque tick reçoit presque
toujours une image nouvelle.

Si le jeu rame, le premier levier est `fpsTarget` dans [`GameEngine.js`](../GameLogic/GameEngine.js).
MediaPipe sur CPU est de loin l'étape la plus coûteuse.
