// Auth.js auto-detects RAILWAY_PUBLIC_DOMAIN but without protocol, causing
// "Invalid URL" errors. Set AUTH_URL with protocol before importing next-auth.
if (process.env.RAILWAY_PUBLIC_DOMAIN && !process.env.AUTH_URL) {
  process.env.AUTH_URL = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
}

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const authEnabled = !!(
  process.env.AUTH_SECRET &&
  process.env.AUTH_GITHUB_ID &&
  process.env.AUTH_GITHUB_SECRET
);

const result = authEnabled
  ? NextAuth({
      providers: [GitHub],
      session: { strategy: "jwt" },
      callbacks: {
        jwt({ token, profile }) {
          if (profile) {
            token.githubId = String(profile.id);
          }
          return token;
        },
        session({ session, token }) {
          if (token.githubId) {
            session.user.githubId = token.githubId as string;
            session.user.isAdmin =
              token.githubId === process.env.ADMIN_GITHUB_ID;
          }
          return session;
        },
      },
    })
  : null;

export const handlers = result?.handlers ?? {
  GET: () => new Response("Auth not configured", { status: 503 }),
  POST: () => new Response("Auth not configured", { status: 503 }),
};
export const auth = result?.auth ?? (() => Promise.resolve(null));
export const signIn = result?.signIn ?? (() => Promise.resolve());
export const signOut = result?.signOut ?? (() => Promise.resolve());
export { authEnabled };

/** Call in admin API route handlers for defense-in-depth.
 *  When auth is not configured, allows all requests through. */
export async function requireAdmin() {
  if (!authEnabled) return true;
  const session = await auth();
  if (!session?.user?.isAdmin) return null;
  return session;
}
