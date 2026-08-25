"use client";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";

export default function DashboardPage() {
  const { user, logOut } = useAuth();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <Logo href="/dashboard" />
          <Button variant="outline" size="sm" onClick={logOut}>
            Log out
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}.
        </h1>
        <p className="mt-2 text-sm text-muted">Signed in as {user?.email}.</p>
      </main>
    </div>
  );
}
