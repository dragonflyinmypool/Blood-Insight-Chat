-- =============================================================================
-- Canonicalize marker names via an aliases column.
--
-- Problem: the LLM extracts "LDL Cholesterol" on one lab and "Low-Density
-- Lipoprotein (LDL) Cholesterol" on another. Same biomarker, different strings
-- -> the Results page shows them as separate entries.
--
-- Fix: each markers row gets an `aliases text[]` of alternate spellings. The
-- categorize_markers RPC now returns canonical_name alongside category, and
-- the upload edge function rewrites marker_name to the canonical form before
-- insert. Existing rows are backfilled here.
-- =============================================================================

alter table public.markers
  add column aliases text[] not null default '{}';

create index markers_aliases_gin on public.markers using gin (aliases);

-- -----------------------------------------------------------------------------
-- RPC now returns { input_name, category, canonical_name }. A `lateral` join
-- lets us return a single matched row per input, matching either the canonical
-- name or any alias case-insensitively.
-- -----------------------------------------------------------------------------

drop function if exists public.categorize_markers(text[]);

create or replace function public.categorize_markers(names text[])
returns table (input_name text, category text, canonical_name text)
language sql stable security invoker
as $$
  select
    n as input_name,
    m.category,
    m.canonical_name
  from unnest(names) as n
  left join lateral (
    select category, canonical_name
    from public.markers
    where lower(canonical_name) = lower(n)
       or exists (select 1 from unnest(aliases) a where lower(a) = lower(n))
    limit 1
  ) m on true;
$$;

-- -----------------------------------------------------------------------------
-- Seed aliases. Common long-form / abbreviation variants — extend over time.
-- -----------------------------------------------------------------------------

update public.markers set aliases = array[
  'Low-Density Lipoprotein (LDL) Cholesterol',
  'Low-Density Lipoprotein Cholesterol',
  'LDL-C',
  'LDL'
] where canonical_name = 'LDL Cholesterol';

update public.markers set aliases = array[
  'High-Density Lipoprotein (HDL) Cholesterol',
  'High-Density Lipoprotein Cholesterol',
  'HDL-C',
  'HDL'
] where canonical_name = 'HDL Cholesterol';

update public.markers set aliases = array[
  'Cholesterol',
  'Total Chol',
  'Serum Cholesterol'
] where canonical_name = 'Total Cholesterol';

update public.markers set aliases = array[
  'Very-Low-Density Lipoprotein (VLDL) Cholesterol',
  'VLDL-C',
  'VLDL'
] where canonical_name = 'VLDL Cholesterol';

update public.markers set aliases = array['Non-HDL', 'Non HDL Cholesterol'] where canonical_name = 'Non-HDL Cholesterol';
update public.markers set aliases = array['Trigs', 'TG'] where canonical_name = 'Triglycerides';

update public.markers set aliases = array['Hb', 'Hgb'] where canonical_name = 'Hemoglobin';
update public.markers set aliases = array['Hct', 'HCT'] where canonical_name = 'Hematocrit';
update public.markers set aliases = array['RBC', 'Erythrocytes'] where canonical_name = 'Red Blood Cells';
update public.markers set aliases = array['WBC', 'Leukocytes'] where canonical_name = 'White Blood Cells';
update public.markers set aliases = array['PLT'] where canonical_name = 'Platelets';

update public.markers set aliases = array['Fasting Glucose', 'Blood Glucose', 'Serum Glucose'] where canonical_name = 'Glucose';
update public.markers set aliases = array['Na', 'Na+'] where canonical_name = 'Sodium';
update public.markers set aliases = array['K', 'K+'] where canonical_name = 'Potassium';
update public.markers set aliases = array['Cl', 'Cl-'] where canonical_name = 'Chloride';
update public.markers set aliases = array['Ca', 'Total Calcium'] where canonical_name = 'Calcium';
update public.markers set aliases = array['CO2', 'HCO3', 'Total CO2'] where canonical_name = 'Bicarbonate';
update public.markers set aliases = array['Blood Urea Nitrogen', 'Urea Nitrogen', 'Urea'] where canonical_name = 'BUN';

update public.markers set aliases = array['Serum Creatinine', 'Cr'] where canonical_name = 'Creatinine';
update public.markers set aliases = array['Estimated GFR', 'Glomerular Filtration Rate', 'GFR'] where canonical_name = 'eGFR';

update public.markers set aliases = array[
  'SGPT',
  'Alanine Aminotransferase',
  'Alanine Transaminase'
] where canonical_name = 'ALT';

update public.markers set aliases = array[
  'SGOT',
  'Aspartate Aminotransferase',
  'Aspartate Transaminase'
] where canonical_name = 'AST';

update public.markers set aliases = array['ALP', 'Alk Phos'] where canonical_name = 'Alkaline Phosphatase';
update public.markers set aliases = array['Bilirubin Total', 'Bilirubin'] where canonical_name = 'Total Bilirubin';
update public.markers set aliases = array['Bilirubin Direct', 'Conjugated Bilirubin'] where canonical_name = 'Direct Bilirubin';
update public.markers set aliases = array['Gamma-GT', 'Gamma-Glutamyl Transferase', 'Gamma Glutamyl Transferase'] where canonical_name = 'GGT';

update public.markers set aliases = array['Thyroid Stimulating Hormone', 'Thyrotropin'] where canonical_name = 'TSH';
update public.markers set aliases = array['FT4', 'Thyroxine Free', 'Free Thyroxine'] where canonical_name = 'Free T4';
update public.markers set aliases = array['FT3', 'Triiodothyronine Free', 'Free Triiodothyronine'] where canonical_name = 'Free T3';

update public.markers set aliases = array['25-Hydroxy Vitamin D', '25-OH Vitamin D', 'Vitamin D 25-Hydroxy', 'Vitamin D, 25-Hydroxy'] where canonical_name = 'Vitamin D';
update public.markers set aliases = array['Cobalamin', 'B12'] where canonical_name = 'Vitamin B12';
update public.markers set aliases = array['Folic Acid'] where canonical_name = 'Folate';

update public.markers set aliases = array['Serum Iron', 'Fe'] where canonical_name = 'Iron';
update public.markers set aliases = array['Serum Ferritin'] where canonical_name = 'Ferritin';
update public.markers set aliases = array['Mg', 'Serum Magnesium'] where canonical_name = 'Magnesium';

update public.markers set aliases = array['Hemoglobin A1c', 'A1c', 'Glycated Hemoglobin', 'Glycosylated Hemoglobin'] where canonical_name = 'HbA1c';

update public.markers set aliases = array['C-Reactive Protein'] where canonical_name = 'CRP';
update public.markers set aliases = array['High-Sensitivity CRP', 'High-Sensitivity C-Reactive Protein', 'hsCRP'] where canonical_name = 'hs-CRP';
update public.markers set aliases = array['Erythrocyte Sedimentation Rate', 'Sed Rate'] where canonical_name = 'ESR';

update public.markers set aliases = array['Prostate-Specific Antigen'] where canonical_name = 'PSA';
update public.markers set aliases = array['Carcinoembryonic Antigen'] where canonical_name = 'CEA';
update public.markers set aliases = array['Alpha-Fetoprotein', 'Alpha Fetoprotein'] where canonical_name = 'AFP';

-- -----------------------------------------------------------------------------
-- Backfill: rewrite existing marker_name values to the canonical form so the
-- Results page dedupes correctly. Leaves unmatched names untouched.
-- -----------------------------------------------------------------------------

update public.blood_test_results r
set marker_name = m.canonical_name
from public.markers m
where r.marker_name is not null
  and r.marker_name <> m.canonical_name
  and (
    lower(m.canonical_name) = lower(r.marker_name)
    or exists (select 1 from unnest(m.aliases) a where lower(a) = lower(r.marker_name))
  );
