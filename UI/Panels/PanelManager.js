import { PanelLsf } from "./PanelLsf.js";
import { PanelWelcome } from "./PanelWelcome.js";
import { PanelChatbot } from "./PanelChatbot.js";
import { PanelGuilty } from "./PanelGuilty.js";
import { PanelColors } from "./PanelColors.js";
import { PanelFinal } from "./PanelFinal.js";
import { PanelAruco } from "./PanelAruco.js";

export class PanelManager {

    /**
     * @param {TabManager} tabManager - only PanelWelcome needs it, to open the first enigma tab
     *        at the end of its transition. Passed through rather than imported, so that no panel
     *        has to reach back into the UIManager that is building them.
     */
    constructor(tabManager) {
        this.panelLsf = new PanelLsf();
        this.panelWelcome = new PanelWelcome(tabManager);
        this.panelChatbot = new PanelChatbot();
        this.panelGuilty = new PanelGuilty();
        this.panelColors = new PanelColors();
        this.panelFinal = new PanelFinal();
        this.panelAruco = new PanelAruco();
    }
}