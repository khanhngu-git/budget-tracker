"use client";

import { useAuth } from "@/lib/auth/auth-context";

export default function DashboardPage() {
  const { user, logOut } = useAuth();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <span className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Budget Tracker
        </span>
        <button
          type="button"
          onClick={logOut}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Log out
        </button>
      </header>

      <main className="flex flex-1 flex-col gap-2 px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Welcome{user?.displayName ? `, ${user.displayName}` : ""}.
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Signed in as {user?.email}.
        </p>
      </main>
    </div>
  );
}
