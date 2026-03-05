"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const publicNavItems = [
  { href: "/explorer", label: "Explorer" },
  { href: "/compare", label: "Compare" },
];

export function Header() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const navItems = session?.user?.isAdmin
    ? [...publicNavItems, { href: "/admin", label: "Admin" }]
    : publicNavItems;

  return (
    <header className="border-b bg-background">
      <div className="flex h-14 items-center px-6">
        <Link href="/" className="mr-8 flex items-center gap-2 font-semibold">
          <span className="text-lg">Now Schema Explorer</span>
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                pathname?.startsWith(item.href)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span
            className="text-[10px] text-muted-foreground/50 font-mono select-all"
            title="Build version"
          >
            {process.env.NEXT_PUBLIC_COMMIT_HASH}
          </span>

          {status === "loading" ? (
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          ) : session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full p-0"
                >
                  {session.user.image ? (
                    <Image
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                      {session.user.name?.[0] || "?"}
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                  {session.user.name || session.user.email}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut()}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => signIn("github")}
            >
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
