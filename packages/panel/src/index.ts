// Library entry — the panel ships as a mountable React component (mirroring
// @booboo-brain/viewer's BoobooView). A host app renders <Panel /> and injects
// its own backend via the `api` prop; standalone it uses same-origin /api/*.
export { Panel, type ApiFn } from "./Panel";

export const PANEL_VERSION = "0.4.0";
