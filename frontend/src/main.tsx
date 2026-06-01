import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { PlanProvider } from "./app/PlanProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles/plani-tokens.css";
import "./styles/shell.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <PlanProvider>
          <App />
        </PlanProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
