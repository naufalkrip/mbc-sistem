import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ToastProvider } from "./contexts/ToastContext";
import { HeaderActionProvider } from "./contexts/HeaderActionContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ToastProvider>
        <HeaderActionProvider>
          <App />
        </HeaderActionProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);