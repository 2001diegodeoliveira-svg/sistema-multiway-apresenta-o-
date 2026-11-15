import React from "react";
import { createRoot } from "react-dom/client";
import { Observer } from "tailwindcss-intersect/observer";
import App from "./App";
import "./index.css";

Observer.start();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);