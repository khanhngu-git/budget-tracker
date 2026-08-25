"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [loading, user, router]);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
    </div>
  );
}
