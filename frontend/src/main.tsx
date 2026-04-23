import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { PlannerProvider } from "./planner/store";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PlannerProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PlannerProvider>
  </React.StrictMode>
);
