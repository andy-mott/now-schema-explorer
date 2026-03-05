import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
});

/** Call in admin API route handlers for defense-in-depth */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) return null;
  return session;
}
