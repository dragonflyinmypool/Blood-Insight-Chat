import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/current-user";
import { OnboardingForm } from "./form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()]);

  if (!user) redirect("/login");
  if (profile?.onboarded) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Activity className="h-5 w-5" />
          </div>
          <div className="text-lg font-semibold">Welcome to Blood Insight</div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tell us your name</CardTitle>
            <CardDescription>
              We&apos;ll use this on your dashboard. You can change it any time in settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm
              initialName={profile?.display_name ?? user.email?.split("@")[0] ?? ""}
              userId={user.id}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
