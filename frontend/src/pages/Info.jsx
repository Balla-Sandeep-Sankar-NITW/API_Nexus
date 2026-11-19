import { Link, useLocation } from "react-router-dom";
import PublicLayout from "../components/PublicLayout";
import { site, contactLine } from "../siteConfig";

export function About() {
  return (
    <PublicLayout title={`About ${site.name}`}>
      <p>
        {site.name} answers one question before you ship a change: <em>what breaks if I change this?</em> Import an
        OpenAPI file, and it draws every endpoint, schema and auth scheme as a connected map. Add the services,
        databases and third parties that specs don't describe, and the map shows what depends on what.
      </p>
      <p>It is free and open to everyone. There is nothing to unlock and no plan to pick.</p>
      <h2>What you can do</h2>
      <ul>
        <li>See the impact of a change in both directions, with the chain of dependencies that explains it.</li>
        <li>Score risk for each component and spot endpoints without authentication.</li>
        <li>Plan a freeze step by step and track it to done.</li>
        <li>Track deprecations and sunset dates, and see what's safe to remove.</li>
        <li>Compare versions and replay how the architecture changed over time.</li>
        <li>Try endpoints from the spec, with credentials that never leave your browser tab.</li>
        <li>Work together with roles, comments, mentions and change suggestions.</li>
      </ul>
      <h2>Get started</h2>
      <p>
        <Link to="/register">Create an account</Link>, make a project, then import an OpenAPI file. Not sure where to
        begin? The <Link to="/help">Help page</Link> walks through it, and the dashboard has a sample project you can
        open in one click.
      </p>
      <h2>Run by</h2>
      <p>{site.operator}. Version {site.version}.</p>
      {site.repoUrl && (
        <p>The code and issue tracker live on <a href={site.repoUrl} target="_blank" rel="noreferrer">GitHub</a>.</p>
      )}
    </PublicLayout>
  );
}

const FAQ = [
  ["How do I get my APIs into the map?", "Create a project, open the Versions tab and import an OpenAPI 3.x file as JSON or YAML. You'll see a preview of what will be created before anything is saved. You can also add nodes and links by hand for things a spec can't describe."],
  ["What do the roles mean?", "Leaders manage the project: imports, freezes, members, sharing and reviewing suggestions. Members edit the graph and comment. Viewers can read and comment but not change anything."],
  ["What does \"Needs attention\" on the dashboard show?", "Endpoints past their sunset date, change suggestions waiting for your review, and endpoints without any authentication in projects that define an auth scheme. Each item opens the screen where you can act on it."],
  ["Why was the first page slow?", "The server sleeps when nobody has used it for a while, so the very first request after a break can take up to a minute. After that it responds normally."],
  ["I didn't get the verification email.", "Check your spam folder first, then use \"Send a new verification link\" on the log in page. The link works for 24 hours. If it still doesn't arrive, double-check the address you typed."],
  ["I forgot my password.", "Choose \"Forgot your password?\" on the log in page. The reset link works for 30 minutes and signs you out of other devices."],
  ["Can I sign in without a password?", "Yes, if the server has it enabled you'll see \"Continue with GitHub\" on the log in page."],
  ["How do I delete my data?", "Open your profile settings, then Account. You can download everything first, then delete your account."],
  ["Is the API Explorer safe to use?", "Requests go out from the server, which blocks private and internal addresses. Credentials stay in your browser tab and are cleared when you log out. Only test APIs you're allowed to test."],
  ["Is it really free?", "Yes. It's free and open to everyone."],
];

export function Help() {
  return (
    <PublicLayout title="Help">
      <p>Quick answers to common questions. If yours isn't here, you can {contactLine()}.</p>
      <h2>Getting started in four steps</h2>
      <ol>
        <li>Create a project from the dashboard.</li>
        <li>Import an OpenAPI file in the Versions tab.</li>
        <li>Click any node on the graph to see what depends on it.</li>
        <li>Open Insights to see risk, security gaps and findings.</li>
      </ol>
      <h2>Questions</h2>
      <div className="faq">
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </PublicLayout>
  );
}

export function NotFound() {
  const { pathname } = useLocation();
  return (
    <PublicLayout title="We can't find that page">
      <p>
        There's nothing at <code>{pathname}</code>. The link may be old or mistyped.
      </p>
      <p><Link to="/" className="btn btn-primary">Go to your projects</Link></p>
    </PublicLayout>
  );
}
