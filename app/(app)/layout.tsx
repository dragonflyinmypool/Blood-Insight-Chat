import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { UploadQueueProvider } from "@/components/upload-queue-provider";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/current-user";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()]);

  if (!user) redirect("/login");

  return (
    <UploadQueueProvider>
      <AppShell displayName={profile?.display_name ?? null} email={user.email ?? ""}>
        {children}
      </AppShell>
    </UploadQueueProvider>
  );
}
