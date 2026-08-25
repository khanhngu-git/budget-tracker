import { RequireAuth } from "@/components/auth/route-guard";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return <RequireAuth>{children}</RequireAuth>;
}
