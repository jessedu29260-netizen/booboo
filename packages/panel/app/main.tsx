import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Panel } from "../src/index";

// Thin bootstrap for the shipped, self-contained panel app. `booboo panel`
// serves this; it renders <Panel/> with no `api` prop, so the panel uses its
// default same-origin /api/* backend — standalone behaviour is unchanged.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Panel />
  </StrictMode>,
);
