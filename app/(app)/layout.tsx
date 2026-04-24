import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/current-user";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()]);

  if (!user) redirect("/login");

  return (
    <AppShell displayName={profile?.display_name ?? null} email={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
