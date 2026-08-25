import { RedirectIfAuthed } from "@/components/auth/route-guard";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <RedirectIfAuthed>
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          {children}
        </div>
      </div>
    </RedirectIfAuthed>
  );
}
