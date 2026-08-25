import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in · Budget Tracker",
};

export default function LoginPage() {
  return (
    <>
      <header className="mb-6 flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-sm text-muted">Log in to pick up where you left off.</p>
      </header>
      <LoginForm />
    </>
  );
}
