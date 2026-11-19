// Legal pages. These are plain-language templates written for how API Nexus actually works.
// Have them reviewed for your country before you rely on them.
import { Link } from "react-router-dom";
import PublicLayout from "../components/PublicLayout";
import { site, contactLine } from "../siteConfig";

const S = ({ title, children }) => (
  <section>
    <h2>{title}</h2>
    {children}
  </section>
);

export function Terms() {
  return (
    <PublicLayout title="Terms of Service" updated={site.updated}>
      <p>
        These terms cover your use of {site.name}, run by {site.operator}. By creating an account or using the
        service you agree to them. If you don't agree, please don't use it.
      </p>
      <S title="The service">
        <p>
          {site.name} is free and open to everyone. It maps how APIs depend on each other from OpenAPI files and
          from what you add by hand, and it helps you plan changes. We may add, change or remove features at any time.
        </p>
      </S>
      <S title="Your account">
        <ul>
          <li>Give accurate details and keep your password private. You are responsible for what happens under your account.</li>
          <li>You must be at least 13 years old, or the minimum age in your country if it is higher.</li>
          <li>Tell us right away if you think someone else has access to your account.</li>
        </ul>
      </S>
      <S title="Your content">
        <p>
          You keep ownership of the projects, specs, comments and other content you add. You give us permission to
          store, process and display it only as needed to run the service for you and the people you share it with.
          You are responsible for having the right to upload what you upload. Don't upload secrets such as live
          passwords or private keys into specs or comments.
        </p>
      </S>
      <S title="Acceptable use">
        <p>
          You must follow our <Link to="/acceptable-use">Acceptable Use Policy</Link>. In short: don't abuse the
          API Explorer, attack other systems, or break the service for others.
        </p>
      </S>
      <S title="Sharing">
        <p>
          A project owner can turn on a public read-only link. Anyone with the link can see that project's graph until
          the link is turned off. Share it only with people you trust.
        </p>
      </S>
      <S title="No warranty">
        <p>
          The service is provided "as is" and "as available". Because it runs on free infrastructure, it can be slow
          to start, change, or be unavailable. Impact and risk results are guidance based on the data in your project
          and can be incomplete; check important changes yourself. We don't promise the service will be error-free
          or that your data will never be lost, so keep your own copy of anything important (you can export it from
          your profile settings).
        </p>
      </S>
      <S title="Limit of liability">
        <p>
          To the extent the law allows, {site.operator} is not liable for indirect or consequential losses, or for loss
          of data, profit or business, arising from your use of the service. Nothing here limits rights you have by law
          that can't be limited.
        </p>
      </S>
      <S title="Ending your use">
        <p>
          You can delete your account at any time from profile settings. We may suspend or remove accounts that break
          these terms or put the service or other people at risk.
        </p>
      </S>
      <S title="Changes">
        <p>
          We may update these terms. When we make an important change we will update the date above and, where we can,
          tell you in the app. Using the service after a change means you accept it.
        </p>
      </S>
      <S title="Contact">
        <p>Questions about these terms? You can {contactLine()}.</p>
      </S>
    </PublicLayout>
  );
}

export function Privacy() {
  return (
    <PublicLayout title="Privacy Policy" updated={site.updated}>
      <p>
        This explains what {site.name} stores about you, why, who helps us run it, and the choices you have. We
        collect only what the service needs, and we don't sell your data or show ads.
      </p>
      <S title="What we store">
        <ul>
          <li><strong>Account:</strong> your name, email address, and a hashed password (we never store the password itself). If you sign in with GitHub, your GitHub user ID.</li>
          <li><strong>Your work:</strong> projects, imported OpenAPI specs, graph nodes and links, comments, snapshots, freeze plans and notifications.</li>
          <li><strong>Activity:</strong> an audit log of changes in each project, and a history of your sign-ins (time and success or failure). We don't store IP addresses in that history.</li>
          <li><strong>API Explorer:</strong> the requests you send are made from our server. Request and response bodies are not stored, and credentials you enter stay in your browser tab and are cleared when you log out.</li>
        </ul>
      </S>
      <S title="Why we use it">
        <p>
          To run your account, show your projects to you and your teammates, send the emails you ask for (verification
          and password reset), keep the service secure, and fix problems. We don't use your data for advertising or
          profiling.
        </p>
      </S>
      <S title="Who else handles it">
        <p>We use a few services to run {site.name}. Each only receives what it needs:</p>
        <ul>
          <li>Web hosting and database providers store the app and its data.</li>
          <li>An email delivery provider receives your email address and the message when we send you a verification or reset email.</li>
          <li>GitHub, only if you choose "Continue with GitHub". It tells us your name and verified email.</li>
          <li>Google Fonts serves the typefaces, which means your browser contacts Google when pages load.</li>
        </ul>
      </S>
      <S title="Cookies and local storage">
        <p>
          We don't use advertising or analytics cookies. See the <Link to="/cookies">Cookies page</Link> for the
          small amount of browser storage the app uses to keep you signed in.
        </p>
      </S>
      <S title="Keeping and deleting data">
        <p>
          We keep your data while your account exists. You can delete your account in profile settings; that removes
          your profile, sign-in history, notifications and comments. Projects you own are passed to another leader of
          the project if there is one, otherwise they are deleted with all their data. Copies held in the database
          host's backups can take a short time to age out.
        </p>
      </S>
      <S title="Your choices">
        <ul>
          <li><strong>Access and portability:</strong> download everything we hold about you from profile settings.</li>
          <li><strong>Correction:</strong> change your name in profile settings, or reset your password at any time.</li>
          <li><strong>Deletion:</strong> delete your account from profile settings.</li>
          <li><strong>Sign out everywhere:</strong> end every active session from profile settings.</li>
        </ul>
        <p>For anything else, {contactLine()}.</p>
      </S>
      <S title="Security">
        <p>
          Passwords are hashed, emailed links expire and can be used once, sign-in attempts are rate limited, and the
          API Explorer blocks requests to private and internal addresses. No service is perfectly secure, so use a
          strong, unique password.
        </p>
      </S>
      <S title="Children">
        <p>{site.name} is not meant for children under 13, and we don't knowingly collect their data.</p>
      </S>
      <S title="Changes">
        <p>If this policy changes in a way that matters, we'll update the date above and tell you in the app where we can.</p>
      </S>
    </PublicLayout>
  );
}

export function AcceptableUse() {
  return (
    <PublicLayout title="Acceptable Use Policy" updated={site.updated}>
      <p>
        {site.name} is free for everyone, and we want to keep it that way. These rules protect the service and the people
        who use it.
      </p>
      <S title="Don't">
        <ul>
          <li>Use the API Explorer to attack, scan or overload any system, or to reach systems you don't have permission to test.</li>
          <li>Try to get around the Explorer's safeguards, such as the block on private and internal addresses, or the rate limits.</li>
          <li>Break into accounts, guess passwords, or access projects you haven't been given access to.</li>
          <li>Upload malware, or content that is illegal or infringes other people's rights.</li>
          <li>Put real secrets (live keys, passwords, tokens) into specs, notes or comments.</li>
          <li>Create accounts automatically, send spam, or put heavy load on the service.</li>
          <li>Probe, test or scrape the service in a way that harms its performance for others.</li>
        </ul>
      </S>
      <S title="Do">
        <ul>
          <li>Only test APIs you own or have permission to test.</li>
          <li>Report security problems to us privately, and give us reasonable time to fix them.</li>
          <li>Respect the people you invite to your projects.</li>
        </ul>
      </S>
      <S title="What happens if rules are broken">
        <p>We may limit features, remove content, or suspend accounts. For serious abuse we may report it to the relevant authorities.</p>
      </S>
      <S title="Reporting abuse or a security issue">
        <p>Please {contactLine()} and include what you saw and where. Don't include passwords or private data.</p>
      </S>
    </PublicLayout>
  );
}

export function Cookies() {
  return (
    <PublicLayout title="Cookies and browser storage" updated={site.updated}>
      <p>
        {site.name} doesn't use advertising, tracking or analytics cookies, so there is no cookie banner to dismiss. The
        app does keep a few small items in your browser so it works:
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th scope="col">What</th><th scope="col">Why</th><th scope="col">How long</th></tr>
          </thead>
          <tbody>
            <tr><td>Sign-in tokens (local storage)</td><td>Keep you signed in between visits</td><td>Until you log out, sign out everywhere, or the session expires</td></tr>
            <tr><td>API Explorer credentials (browser tab)</td><td>Let you try endpoints without retyping tokens</td><td>Cleared when you close the tab or log out</td></tr>
            <tr><td>Interface preferences</td><td>Remember small choices such as filters</td><td>Until you clear your browser data</td></tr>
          </tbody>
        </table>
      </div>
      <S title="Third parties">
        <p>
          The typefaces load from Google Fonts, so your browser contacts Google when a page opens. If you choose
          "Continue with GitHub", GitHub sets its own cookies on github.com while you sign in.
        </p>
      </S>
      <S title="Clearing it">
        <p>
          Logging out removes the sign-in tokens. You can also clear this site's data in your browser settings at any
          time; you'll just need to log in again.
        </p>
      </S>
    </PublicLayout>
  );
}
