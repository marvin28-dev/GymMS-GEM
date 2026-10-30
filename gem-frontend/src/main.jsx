import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { LanguageProvider } from "./contexts/LanguageProvider";
import { installNumberGuard } from "./utils/numberGuard";
import { installLabelLinker } from "./utils/labelLinker";
import { installAutofillGuard } from "./utils/autofillGuard";
import translations from "./i18n/translations";
import SupportLinks from "./components/SupportLinks";
import { readStored } from "./utils/storage";

installNumberGuard();
installLabelLinker();
installAutofillGuard();

// Apply saved theme before first render to avoid flash. There are two themes;
// a browser still holding one of the ones we dropped falls back to dark rather
// than rendering against a palette that no longer exists.
const savedTheme = readStored('gem-theme') === 'light' ? 'light' : 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// It sits outside the language provider (that may be what failed), so it
// reads the chosen language itself. The error's text is for developers only.
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error(error, info?.componentStack); }
  render() {
    if (this.state.error) {
      const words = translations[readStored('gem-lang') === 'fr' ? 'fr' : 'en'].common;
      return (
        <div role="alert" style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ maxWidth: 420, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 24 }}>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>{words.crashTitle}</h1>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)', margin: '0 0 18px' }}>{words.crashText}</p>
            <button type="button" onClick={() => window.location.reload()} style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, color: '#0a0a0f', cursor: 'pointer' }}>{words.reload}</button>
            <SupportLinks quiet label={words.supportLine} style={{ marginTop: 16 }} />
            {import.meta.env.DEV && <pre style={{ marginTop: 16, whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--accent-red)' }}>{String(this.state.error)}</pre>}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
