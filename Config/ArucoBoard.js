/**
 * The true/false card enigma : the statements, and where each card must be laid on the board.
 * This is the only file to edit to change the statements, the expected answers or the physical
 * layout of the game.
 *
 * ── The setup ───────────────────────────────────────────────────────────────────
 * Two printed sheets, each marked by four Aruco markers at its corners (DICT_4X4_100) :
 *
 *      sheet 1 : corners 90 (top left), 91 (top right), 93 (bottom right), 92 (bottom left)
 *      sheet 2 : corners 94 (top left), 95 (top right), 97 (bottom right), 96 (bottom left)
 *
 * Those four corners give the homography that flattens the sheet. Once it is known, the position
 * of any marker is expressed in millimetres in the frame of the sheet, whatever the angle the
 * camera looks from. The `pos` values below are written in that frame.
 *
 * ── The cards ───────────────────────────────────────────────────────────────────
 * Each card carries TWO markers, one per face. The team turns the card to the side it believes
 * is right, then lays it in its slot. A card counts as correct when `correctId` is the marker
 * the camera sees at `pos`.
 *
 * Careful : `correctId` is NOT "the true face". It is the face that answers the statement
 * correctly — so the "false" face for a false statement, such as the ones about mathematics
 * or about energy consumption.
 *
 * Four slots per sheet, on a single row (y = 124 mm), 70 mm apart.
 *
 * @typedef {{correctId: number, wrongId: number, pos: [number, number], sheet: number, name: string}} ArucoCard
 */

/** Physical size of one sheet, in millimetres (distance between the ArUco corners). */
export const SHEET_SIZE_MM = { width: 262, height: 175 };

/** The four corners of each sheet, in order : top left, top right, bottom right, bottom left. */
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
