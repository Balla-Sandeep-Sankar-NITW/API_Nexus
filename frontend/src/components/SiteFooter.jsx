import { Link } from "react-router-dom";
import { site } from "../siteConfig";

export default function SiteFooter({ compact = false }) {
  return (
    <footer className={`site-footer${compact ? " is-compact" : ""}`}>
      <span className="site-footer-note">{site.name} is free and open to everyone.</span>
      <nav aria-label="Footer">
        <Link to="/about">About</Link>
        <Link to="/help">Help</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/acceptable-use">Acceptable use</Link>
        <Link to="/cookies">Cookies</Link>
        {site.repoUrl && <a href={site.repoUrl} target="_blank" rel="noreferrer">GitHub</a>}
      </nav>
    </footer>
  );
}
