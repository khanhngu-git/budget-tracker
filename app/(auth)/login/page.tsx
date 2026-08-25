import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in · Budget Tracker",
};

export default function LoginPage() {
  return (
    <>
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Welcome back
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Log in to your budget.
        </p>
      </header>
      <LoginForm />
    </>
  );
}
