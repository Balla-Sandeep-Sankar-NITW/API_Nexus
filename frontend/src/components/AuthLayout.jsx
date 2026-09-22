import Logomark from "./ui/Logomark";
import AuthIllustration from "./AuthIllustration";

// Shared frame for log in / create account: a preview of the real
// dependency graph next to the form, on a light theme throughout (no dark
// panel). Collapses to just the centered card on narrow screens.
export default function AuthLayout({ children }) {
  return (
    <div className="auth-shell">
      <aside className="auth-illustration">
        <div className="auth-illustration-brand">
          <Logomark />
          API Nexus
        </div>
        <AuthIllustration />
        <p className="auth-illustration-caption">
          See how your APIs depend on each other, and what would break if one changed.
        </p>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-brand">
            <Logomark />
            API Nexus
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
