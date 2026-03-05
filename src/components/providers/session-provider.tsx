"use client";

import { SessionProvider } from "next-auth/react";

export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NEXT_PUBLIC_AUTH_ENABLED !== "true") {
    return <>{children}</>;
  }
  return <SessionProvider>{children}</SessionProvider>;
}
