import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/current-user";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()]);

  if (!user) redirect("/login");
  if (!profile?.onboarded) redirect("/onboarding");

  return (
    <AppShell displayName={profile.display_name} email={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
