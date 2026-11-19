import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logomark from "./ui/Logomark";
import SiteFooter from "./SiteFooter";

// Frame for About / Help / legal pages. Works signed in or out.
export default function PublicLayout({ title, updated, children, wide = false }) {
  const { user } = useAuth();
  return (
    <div className="public-shell">
      <header className="public-bar">
        <Link to="/" className="public-brand"><Logomark size={24} /> API Nexus</Link>
        <span className="toolbar-spacer" />
        {user ? (
          <Link to="/" className="btn btn-sm">Back to projects</Link>
        ) : (
          <>
            <Link to="/login" className="btn btn-sm">Log in</Link>
            <Link to="/register" className="btn btn-sm btn-primary">Create account</Link>
          </>
        )}
      </header>
      <main className={`public-main${wide ? " is-wide" : ""}`}>
        <article className="doc">
          <h1>{title}</h1>
          {updated && <p className="doc-updated">Last updated {updated}</p>}
          {children}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
