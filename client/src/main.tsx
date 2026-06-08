import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// Register all extended rulesets before anything renders.
import "./lib/core/registerAll";

createRoot(document.getElementById("root")!).render(<App />);
