// Public details shown on the legal, About and Help pages. Set these in the frontend's
// environment (Vercel -> Settings -> Environment Variables); all are optional.
export const site = {
  name: "API Nexus",
  operator: import.meta.env.VITE_OPERATOR_NAME || "the API Nexus maintainers",
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL || "",
  repoUrl: import.meta.env.VITE_REPO_URL || "",       // e.g. https://github.com/you/API_Nexus
  version: "1.1.0",
  updated: "November 19, 2026",
};

export function contactLine() {
  if (site.contactEmail) return `email ${site.contactEmail}`;
  if (site.repoUrl) return "open an issue on our GitHub page";
  return "use the contact option linked in the footer";
}
