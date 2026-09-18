# Dépannage

Que faire quand quelque chose ne marche pas. Pour comprendre *pourquoi* la détection se comporte ainsi,
voir [vision.md](vision.md) ; pour les réglages de chaque énigme, voir [enigmes.md](enigmes.md).

Premier réflexe dans tous les cas : ouvrir la console. Les modules y écrivent
leurs erreurs et leurs messages `DEBUG`.

## 1. Le site ne se lance pas

| Symptôme | Cause probable | Solution |
|---|---|---|
| Page blanche, erreur CORS / « module » dans la console | page ouverte en `file://` | servir le dossier en HTTP (`python3 -m http.server 4000`, puis `http://localhost:4000`) |
| « Erreur d'initialisation MediaPipe » | fichiers de `vendor/mediapipe/` absents ou déplacés | vérifier les chemins dans [LoadMediapipe.js](../Utils/LibraryLoading/LoadMediapipe.js) |
| Chargement d'OpenCV sans fin | `vendor/opencv.js` absent ou déplacé | vérifier le chemin dans [LoadOpenCV.js](../Utils/LibraryLoading/LoadOpenCV.js) |

Le site est 100 % hors ligne : aucune ressource ne vient d'Internet. Si quelque chose manque et ben c'est que quelqu'un a modifié quelque chose (enfin sauf si js nous réserve une des surprises dont il a le secret).

## 2. La caméra

Les erreurs d'allumage sont traduites en message à l'écran par
[VisionController.js](../Inputs/Controller/VisionController.js) :

| Message | Cause | Solution |
|---|---|---|
| « Accès refusé » | permission caméra refusée | l'autoriser dans le navigateur (icône à gauche de l'URL), recharger |
| « Aucune caméra détectée » | pas de caméra branchée | brancher, recharger |
| « Caméra indisponible » | déjà utilisée (Zoom, autre onglet…) | fermer l'autre application, recharger |
| « La caméra a été déconnectée » | câble débranché en cours de partie | rebrancher, recharger : la progression est sauvegardée |

Avec plusieurs caméras, le navigateur prend celle choisie par l'utilisateur quand il accepte de donner accès au flux vidéo (après avoir cliquer sur le bouton "allumer la caméra").

## 3. La détection échoue

### Aruco (Vrai ou faux)

- **Rien n'est reconnu** : les quatre marqueurs de coin de la feuille doivent être visibles au moins une
  fois au début, sinon aucun repère n'est calculé.
- **Marqueurs lus par intermittence** : trop petits à l'image (caméra trop haute), reflets sur du papier
  brillant, ou flou. Rapprocher la caméra ou imprimer plus grand.
- **Carte bien posée mais refusée** : le plateau a été imprimé avec des proportions différentes de
  `SHEET_SIZE_MM`, ou `POSITION_TOLERANCE_MM` est trop strict (normalement non, il a toujours marché).

### Colors (Apprentissage coloré)

**PLUS GROS PROBLEME CONNU : UN RAYON DE SOLEIL OU UNE LUMIERE QUI CHANGE APRES LA CALIBRATION**
Si la lumière a changée et qu'on ne peut pas la remettre comme avant : recalibrer les couleurs et si un rayon de soleil s'invite, il vaut mieux essayer de le cacher.

- **Aucun cercle trouvé** : caméra trop loin ou trop près, ou contraste
  insuffisant entre la pastille et son contour.
- **Mauvaise couleur** : lumière très colorée (néons, lumière chaude). Recalibrer sur place.

### LSF (Signes)

- **Mauvaise lettre** : les paires P/N, D/L, A/E ne se distinguent que sur un seul critère ; bien marquer
  le geste. Les seuils de [LsfDictionary.js](../Inputs/Recognizers/LsfDictionary.js) dépendent de la
  distance à la caméra : si elle change, ils peuvent être à reprendre.

### Le jeu rame

Voir la section Performances de [vision.md](vision.md). Fermer les autres onglets et applications
utilisant la caméra ou le GPU aide aussi.

## 4. Sauvegarde

La progression est gardée dans le `localStorage` du navigateur
([SaveManager.js](../GameLogic/SaveManager.js)). Recharger la page fait donc reprendre où on en était.

Pour **repartir d'une partie neuve**, rechargez la page, et cliquer sur le magnifique bouton permettant de réinitialiser la progression.

Ce qui **n'est pas** sauvegardé : la conversation du chatbot, l'avancée à l'intérieur d'une énigme non
terminée, et les essais restants de l'accusation et de l'énigme finale.

## 5. Codes de triche

À taper au clavier n'importe où dans la page, sans champ particulier
([KeyboardController.js](../Inputs/Controller/KeyboardController.js)) :

| Code | Effet |
|---|---|
| `iwanttocheat` | résout l'énigme de l'onglet **actuellement affiché** (sans effet si elle est déjà résolue) |
| `iwanttime` | ajoute 3 minutes au chronomètre |

La console confirme par « 🐸 Code de triche activé ».

Les touches sont écoutées même pendant la saisie dans le terminal : taper un mot contenant un code le
déclenche.
