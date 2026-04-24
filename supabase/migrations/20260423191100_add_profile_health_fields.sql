-- Add personal health context to profiles so the AI has something to ground on
-- when interpreting results, and so age-specific reference ranges can be gated
-- later. All fields are optional — the user can fill them in whenever.

alter table public.profiles
  add column date_of_birth date,
  add column sex text check (sex in ('male', 'female', 'other', 'prefer_not_to_say')),
  add column notes text;
