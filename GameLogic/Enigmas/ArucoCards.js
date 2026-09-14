/**
 * Le contenu de l'énigme des cartes vrai/faux : les affirmations et l'endroit où chacune doit
 * être posée sur le plateau. C'est le seul fichier à éditer pour changer les affirmations,
 * les réponses attendues ou la disposition physique du jeu.
 *
 * ── Le montage ──────────────────────────────────────────────────────────────────
 * Deux feuilles imprimées, repérées chacune par quatre marqueurs ArUco à ses coins
 * (dictionnaire DICT_4X4_100) :
 *
 *      feuille 1 : coins 90 (haut gauche), 91 (haut droit), 93 (bas droit), 92 (bas gauche)
 *      feuille 2 : coins 94 (haut gauche), 95 (haut droit), 97 (bas droit), 96 (bas gauche)
 *
 * Ces quatre coins donnent l'homographie qui redresse la feuille : une fois calculée, la
 * position de n'importe quel marqueur est exprimée en millimètres dans le repère de la feuille,
 * quel que soit l'angle de la caméra. C'est dans ce repère que sont écrits les `pos` ci-dessous.
 *
 * ── Les cartes ──────────────────────────────────────────────────────────────────
 * Chaque carte porte DEUX marqueurs, un par face. L'équipe retourne la carte du côté qu'elle
 * croit juste, puis la pose dans son emplacement. La carte est comptée bonne quand c'est
 * `correctId` que la caméra voit à `pos`.
 *
 * Attention : `correctId` n'est PAS « la face vrai ». C'est la face qui répond correctement à
 * l'affirmation — donc la face « faux » pour une affirmation fausse, comme celle sur les
 * mathématiques ou sur la consommation d'énergie.
 *
 * Quatre emplacements par feuille, alignés sur une même rangée (y = 124 mm), espacés de 70 mm.
 *
 * @typedef {{correctId: number, wrongId: number, pos: [number, number], sheet: number, name: string}} ArucoCard
 */

/** Les dimensions physiques d'une feuille, en millimètres (écart entre les coins ArUco). */
export const SHEET_SIZE_MM = { width: 262, height: 175 };

/** Les quatre coins de chaque feuille, dans l'ordre : haut gauche, haut droit, bas droit, bas gauche. */
export const ARUCO_SHEETS = [
    { id: 1, corners: [90, 91, 93, 92] },
    { id: 2, corners: [94, 95, 97, 96] }
];

/** @type {Array<ArucoCard>} */
export const ARUCO_CARDS = [
    { correctId: 0, wrongId: 11, pos: [7, 124], sheet: 1, name: "Deux IA peuvent créer leur propre langage." },
    { correctId: 1, wrongId: 10, pos: [77, 124], sheet: 1, name: "L'IA peut améliorer le diagnostic de certaines maladies, en soutien au médecin." },
    { correctId: 2, wrongId: 9, pos: [147, 124], sheet: 1, name: "Une IA a une meilleure puissance de calcul qu'un humain." },
    { correctId: 3, wrongId: 8, pos: [217, 124], sheet: 1, name: "Les IA génératives sont très mauvaises en mathématiques." },
    { correctId: 4, wrongId: 15, pos: [7, 124], sheet: 2, name: "Les IA peuvent mentir." },
    { correctId: 5, wrongId: 14, pos: [77, 124], sheet: 2, name: "L'IA peut apprendre de façon autonome." },
    { correctId: 6, wrongId: 13, pos: [147, 124], sheet: 2, name: "Les IA récentes consomment moins d'énergie qu'une recherche Internet classique." },
    { correctId: 7, wrongId: 12, pos: [217, 124], sheet: 2, name: "L'IA générative peut créer du contenu original." }
];
