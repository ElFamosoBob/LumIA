# Lum'IA

Un escape game d'une heure, joué dans un navigateur devant une webcam. Une équipe résout des
énigmes, certaines en disposant des objets physiques que la caméra lit (vision par ordinateur),
d'autres en tapant des réponses.

Site 100 % statique et hors ligne : aucun CDN, aucune dépendance chargée à l'exécution, aucune
étape de build.

## Lancer le site

Le code est fait de modules ES : ouvrir `index.html` directement (`file://`) ne marche pas, le
navigateur les bloque. Il faut un petit serveur HTTP local, depuis la racine du dépôt :

```bash
python3 -m http.server 4000
```

puis ouvrir `http://localhost:4000` et autoriser la caméra.

Chaque push sur `main` est déployé sur GitHub Pages
([.github/workflows/static.yml](.github/workflows/static.yml)). **Tout le dépôt est publié** :
n'y mettre rien qui ne doive pas être public.

## Documentation

Pour reprendre le projet, lire dans cet ordre :

| Fichier | Contenu |
|---|---|
| [docs/architecture.md](docs/architecture.md) | l'organisation du code, le déroulement d'une partie, les règles à respecter |
| [docs/enigmes.md](docs/enigmes.md) | chaque énigme : son fonctionnement, ses réglages, ses limites |
| [docs/vision.md](docs/vision.md) | la vision par ordinateur : Aruco, cercles de couleur, signes LSF |
| [docs/depannage.md](docs/depannage.md) | que faire quand ça ne marche pas, codes de triche |

## Licence

Ce projet est distribué sous licence MIT — voir [LICENSE](LICENSE).

Il embarque MediaPipe, OpenCV.js et la police DejaVu Sans, chacun sous sa propre licence — voir
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
