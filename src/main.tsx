import React from "react"
import ReactDOM from "react-dom/client"
// Base styles first, so each component stylesheet can refine them.
import "./index.css"
import App from "./App"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
