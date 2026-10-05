import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/600.css";
import "@fontsource/vazirmatn/700.css";
import "./index.css";
if (
  "serviceWorker" in navigator &&
  import.meta.env.PROD &&
  !("__TAURI_INTERNALS__" in window)
)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
