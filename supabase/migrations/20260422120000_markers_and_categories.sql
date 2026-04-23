-- =============================================================================
-- Canonical markers reference table + per-result category stamp.
--
-- `markers` is shared reference data (not per-user). Readable by any
-- authenticated user; only the service role (migrations / admin) writes.
--
-- On upload, the edge function resolves a category for each extracted row:
--   1. markers table match (case-insensitive)  -> table's category
--   2. category supplied by the LLM             -> use it
--   3. nothing usable                           -> 'other'
-- The resolved value is stamped onto blood_test_results.category so
-- historical rows are stable even if the lookup is edited later.
-- =============================================================================

create table public.markers (
  id bigserial primary key,
  canonical_name text not null,
  category text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive uniqueness on the name we match against.
create unique index markers_canonical_name_lower_uniq
  on public.markers (lower(canonical_name));

alter table public.markers enable row level security;

create policy "markers: authenticated read"
  on public.markers for select
  to authenticated
  using (true);

-- No insert/update/delete policies: edits happen via migrations / service role.

-- -----------------------------------------------------------------------------
-- Stamp extracted results with their resolved category.
-- Nullable for now; existing rows stay null and can be backfilled later.
-- -----------------------------------------------------------------------------

alter table public.blood_test_results
  add column category text;

create index blood_test_results_category_idx
  on public.blood_test_results (category);

-- -----------------------------------------------------------------------------
-- RPC: given a batch of marker names, return the table-matched category for
-- each (null if no match). One round-trip per upload instead of N lookups.
-- -----------------------------------------------------------------------------

create or replace function public.categorize_markers(names text[])
returns table (input_name text, category text)
language sql stable security invoker
as $$
  select n as input_name, m.category
  from unnest(names) as n
  left join public.markers m on lower(m.canonical_name) = lower(n);
$$;

-- -----------------------------------------------------------------------------
-- Seed: common markers grouped by category. Names are the English canonical
-- forms the extractor is asked to produce.
-- -----------------------------------------------------------------------------

insert into public.markers (canonical_name, category) values
  -- Lipids
  ('Total Cholesterol', 'Lipids'),
  ('LDL Cholesterol', 'Lipids'),
  ('HDL Cholesterol', 'Lipids'),
  ('Triglycerides', 'Lipids'),
  ('Non-HDL Cholesterol', 'Lipids'),
  ('VLDL Cholesterol', 'Lipids'),
  -- Metabolic / electrolytes
  ('Glucose', 'Metabolic'),
  ('Sodium', 'Metabolic'),
  ('Potassium', 'Metabolic'),
  ('Chloride', 'Metabolic'),
  ('Calcium', 'Metabolic'),
  ('Bicarbonate', 'Metabolic'),
  ('BUN', 'Metabolic'),
  -- Kidney
  ('Creatinine', 'Kidney'),
  ('eGFR', 'Kidney'),
  ('Uric Acid', 'Kidney'),
  -- Liver
  ('ALT', 'Liver'),
  ('AST', 'Liver'),
  ('Alkaline Phosphatase', 'Liver'),
  ('Total Bilirubin', 'Liver'),
  ('Direct Bilirubin', 'Liver'),
  ('Albumin', 'Liver'),
  ('Total Protein', 'Liver'),
  ('GGT', 'Liver'),
  -- Thyroid
  ('TSH', 'Thyroid'),
  ('Free T4', 'Thyroid'),
  ('Free T3', 'Thyroid'),
  -- CBC
  ('Hemoglobin', 'CBC'),
  ('Hematocrit', 'CBC'),
  ('Red Blood Cells', 'CBC'),
  ('White Blood Cells', 'CBC'),
  ('Platelets', 'CBC'),
  ('MCV', 'CBC'),
  ('MCH', 'CBC'),
  ('MCHC', 'CBC'),
  ('RDW', 'CBC'),
  -- Vitamins
  ('Vitamin D', 'Vitamins'),
  ('Vitamin B12', 'Vitamins'),
  ('Folate', 'Vitamins'),
  -- Minerals
  ('Iron', 'Minerals'),
  ('Ferritin', 'Minerals'),
  ('Magnesium', 'Minerals'),
  ('Zinc', 'Minerals'),
  -- Hormones
  ('Testosterone', 'Hormones'),
  ('Estradiol', 'Hormones'),
  ('Cortisol', 'Hormones'),
  -- Diabetes / glycemic
  ('HbA1c', 'Diabetes'),
  ('Insulin', 'Diabetes'),
  -- Inflammation
  ('CRP', 'Inflammation'),
  ('hs-CRP', 'Inflammation'),
  ('ESR', 'Inflammation'),
  -- Cardiac
  ('Troponin', 'Cardiac'),
  ('NT-proBNP', 'Cardiac'),
  -- Coagulation
  ('INR', 'Coagulation'),
  ('PT', 'Coagulation'),
  ('PTT', 'Coagulation'),
  ('D-Dimer', 'Coagulation'),
  -- Autoimmune
  ('ANA', 'Autoimmune'),
  ('Rheumatoid Factor', 'Autoimmune'),
  ('Anti-CCP', 'Autoimmune'),
  ('Anti-dsDNA', 'Autoimmune'),
  ('Complement C3', 'Autoimmune'),
  ('Complement C4', 'Autoimmune'),
  -- Tumor Markers
  ('PSA', 'Tumor Markers'),
  ('CEA', 'Tumor Markers'),
  ('AFP', 'Tumor Markers'),
  ('CA-125', 'Tumor Markers'),
  ('CA 19-9', 'Tumor Markers'),
  ('CA 15-3', 'Tumor Markers'),
  -- Infectious Disease
  ('HIV Antibody', 'Infectious Disease'),
  ('Hepatitis B Surface Antigen', 'Infectious Disease'),
  ('Hepatitis C Antibody', 'Infectious Disease'),
  ('Syphilis Antibody', 'Infectious Disease'),
  -- Urinalysis
  ('Urine Protein', 'Urinalysis'),
  ('Urine Glucose', 'Urinalysis'),
  ('Urine Ketones', 'Urinalysis'),
  ('Urine pH', 'Urinalysis'),
  ('Urine Specific Gravity', 'Urinalysis'),
  ('Microalbumin', 'Urinalysis');
