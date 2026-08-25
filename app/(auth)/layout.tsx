import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { RedirectIfAuthed } from "@/components/auth/route-guard";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <RedirectIfAuthed>
      <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-surface-muted px-4 py-14">
        <Logo />
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8">
          {children}
        </div>
        <Link
          href="/"
          className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          Back to home
        </Link>
      </div>
    </RedirectIfAuthed>
  );
}
