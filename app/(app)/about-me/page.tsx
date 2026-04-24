import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile, getCurrentUser } from "@/lib/supabase/current-user";
import { AboutMeForm } from "./about-me-form";

export const dynamic = "force-dynamic";

export default async function AboutMePage() {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()]);
  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">About me</h1>
        <p className="text-sm text-muted-foreground">
          Context the AI uses when interpreting your results. Everything is optional and
          only visible to you.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>
            Date of birth and sex help scope reference ranges. Notes are free-form — list
            medications, conditions, or family history you&apos;d want the AI to know.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AboutMeForm
            userId={user.id}
            initialDateOfBirth={profile?.date_of_birth ?? null}
            initialSex={profile?.sex ?? null}
            initialNotes={profile?.notes ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
