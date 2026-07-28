import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { ConfirmDialogProvider } from "./components/ConfirmDialog.jsx";
import { initializeFilePersistence } from "./data/filePersistence.js";
import "@fontsource/noto-sans-sc/400.css";
import "@fontsource/noto-sans-sc/500.css";
import "@fontsource/noto-sans-sc/600.css";
import "@fontsource/noto-sans-sc/700.css";
import "@fontsource/noto-serif-sc/600.css";
import "@fontsource/noto-serif-sc/700.css";
import "@fontsource/noto-serif-sc/800.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./styles.css";

async function startApp() {
  await initializeFilePersistence();
  createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <ConfirmDialogProvider>
        <App />
      </ConfirmDialogProvider>
    </React.StrictMode>,
  );
}

startApp();
