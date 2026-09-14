import { PanelLsf } from "./PanelLsf.js";
import { PanelWelcome } from "./PanelWelcome.js";
import { PanelChatbot } from "./PanelChatbot.js";
import { PanelGuilty } from "./PanelGuilty.js";
import { PanelColors } from "./PanelColors.js";
import { PanelFinal } from "./PanelFinal.js";
import { PanelAruco } from "./PanelAruco.js";

export class PanelManager {
    constructor() {
        this.panelLsf = new PanelLsf();
        this.panelWelcome = new PanelWelcome();
        this.panelChatbot = new PanelChatbot();
        this.panelGuilty = new PanelGuilty();
        this.panelColors = new PanelColors();
        this.panelFinal = new PanelFinal();
        this.panelAruco = new PanelAruco();
    }
}