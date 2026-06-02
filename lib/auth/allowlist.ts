// Controls which Google accounts may sign in to the web app.
//
// Historically the Google OAuth app was "Internal" to the zencity.io Google
// Workspace, so Google itself guaranteed that only @zencity.io users could
// authenticate. The OAuth app is now "External", so that guarantee no longer
// exists and access must be enforced here instead.
//
// A sign-in is permitted when the email is on an allowed domain (default:
// zencity.io) OR is an explicitly allow-listed address (default: the external
// test user). Both lists can be extended via environment variables without a
// code change:
//   AUTH_ALLOWED_DOMAINS="zencity.io,example.com"
//   AUTH_ALLOWED_EMAILS="someone@gmail.com,other@outlook.com"

const DEFAULT_ALLOWED_DOMAINS = ["zencity.io"];
const DEFAULT_ALLOWED_EMAILS = ["gil.alroy@gmail.com"];

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

const allowedDomains = [
  ...DEFAULT_ALLOWED_DOMAINS.map((domain) => domain.toLowerCase()),
  ...parseList(process.env.AUTH_ALLOWED_DOMAINS),
];

const allowedEmails = [
  ...DEFAULT_ALLOWED_EMAILS.map((email) => email.toLowerCase()),
  ...parseList(process.env.AUTH_ALLOWED_EMAILS),
];

/**
 * Returns true if the given email is permitted to access the app.
 * Comparison is case-insensitive. A missing email is never allowed.
 */
export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  if (allowedEmails.includes(normalized)) return true;

  const domain = normalized.split("@")[1];
  return domain ? allowedDomains.includes(domain) : false;
}
