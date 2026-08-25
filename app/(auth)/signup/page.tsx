import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Sign up · Budget Tracker",
};

export default function SignupPage() {
  return (
    <>
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Create your account
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Start tracking your budget in a minute.
        </p>
      </header>
      <SignupForm />
    </>
  );
}
