import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Sign up · Budget Tracker",
};

export default function SignupPage() {
  return (
    <>
      <header className="mb-6 flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Create your account
        </h1>
        <p className="text-sm text-muted">Free to start. No card required.</p>
      </header>
      <SignupForm />
    </>
  );
}
