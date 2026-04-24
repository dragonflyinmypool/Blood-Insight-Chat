import { cache } from "react";
import { createClient } from "./server";

// React.cache dedupes these calls within a single server render —
// middleware runs separately, but layouts + pages now share one DB roundtrip.

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, onboarded, date_of_birth, sex, notes")
    .eq("id", user.id)
    .maybeSingle();

  return data;
});
