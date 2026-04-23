-- =============================================================================
-- Reference ranges on the canonical markers table.
--
-- Labs print wildly inconsistent and sometimes wrong reference ranges. We own
-- the truth for the markers we've catalogued — store an adult baseline range
-- per canonical marker (with the unit we expect values in), and have the
-- upload edge function override the lab's printed range + recompute status
-- when the extracted unit matches ours. When we have no reference here, the
-- LLM's extracted values are kept as-is.
--
-- Seeded ranges are a reasonable adult baseline using the units most US labs
-- report in. Sex- and age-specific ranges will move to a child table later.
-- =============================================================================

alter table public.markers
  add column ref_low double precision,
  add column ref_high double precision,
  add column ref_unit text,
  add column ref_note text;

-- Extend the RPC so one lookup returns everything the edge function needs.
drop function if exists public.categorize_markers(text[]);

create or replace function public.categorize_markers(names text[])
returns table (
  input_name text,
  category text,
  canonical_name text,
  ref_low double precision,
  ref_high double precision,
  ref_unit text
)
language sql stable security invoker
as $$
  select
    n as input_name,
    m.category,
    m.canonical_name,
    m.ref_low,
    m.ref_high,
    m.ref_unit
  from unnest(names) as n
  left join lateral (
    select category, canonical_name, ref_low, ref_high, ref_unit
    from public.markers
    where lower(canonical_name) = lower(n)
       or exists (select 1 from unnest(aliases) a where lower(a) = lower(n))
    limit 1
  ) m on true;
$$;

-- -----------------------------------------------------------------------------
-- Seed: adult baseline ranges. Markers with substantial sex/age variability
-- (hemoglobin, hematocrit, creatinine, ferritin, iron) are intentionally left
-- null until a per-demographic child table lands.
-- -----------------------------------------------------------------------------

-- Lipids
update public.markers set ref_low = 125, ref_high = 200, ref_unit = 'mg/dL' where canonical_name = 'Total Cholesterol';
update public.markers set ref_low = 0,   ref_high = 100, ref_unit = 'mg/dL' where canonical_name = 'LDL Cholesterol';
update public.markers set ref_low = 40,  ref_high = 60,  ref_unit = 'mg/dL' where canonical_name = 'HDL Cholesterol';
update public.markers set ref_low = 0,   ref_high = 150, ref_unit = 'mg/dL' where canonical_name = 'Triglycerides';
update public.markers set ref_low = 2,   ref_high = 30,  ref_unit = 'mg/dL' where canonical_name = 'VLDL Cholesterol';
update public.markers set ref_low = 0,   ref_high = 130, ref_unit = 'mg/dL' where canonical_name = 'Non-HDL Cholesterol';

-- Metabolic
update public.markers set ref_low = 70,  ref_high = 99,  ref_unit = 'mg/dL' where canonical_name = 'Glucose';
update public.markers set ref_low = 135, ref_high = 145, ref_unit = 'mEq/L' where canonical_name = 'Sodium';
update public.markers set ref_low = 3.5, ref_high = 5.0, ref_unit = 'mEq/L' where canonical_name = 'Potassium';
update public.markers set ref_low = 96,  ref_high = 106, ref_unit = 'mEq/L' where canonical_name = 'Chloride';
update public.markers set ref_low = 8.5, ref_high = 10.2, ref_unit = 'mg/dL' where canonical_name = 'Calcium';
update public.markers set ref_low = 22,  ref_high = 29,  ref_unit = 'mEq/L' where canonical_name = 'Bicarbonate';
update public.markers set ref_low = 7,   ref_high = 20,  ref_unit = 'mg/dL' where canonical_name = 'BUN';

-- Kidney
update public.markers set ref_low = 60, ref_high = null, ref_unit = 'mL/min/1.73m2', ref_note = 'eGFR >= 60 is considered normal kidney function.' where canonical_name = 'eGFR';

-- Liver
update public.markers set ref_low = 7,   ref_high = 56,  ref_unit = 'U/L'   where canonical_name = 'ALT';
update public.markers set ref_low = 10,  ref_high = 40,  ref_unit = 'U/L'   where canonical_name = 'AST';
update public.markers set ref_low = 44,  ref_high = 147, ref_unit = 'U/L'   where canonical_name = 'Alkaline Phosphatase';
update public.markers set ref_low = 0.1, ref_high = 1.2, ref_unit = 'mg/dL' where canonical_name = 'Total Bilirubin';
update public.markers set ref_low = 0,   ref_high = 0.3, ref_unit = 'mg/dL' where canonical_name = 'Direct Bilirubin';
update public.markers set ref_low = 3.4, ref_high = 5.4, ref_unit = 'g/dL'  where canonical_name = 'Albumin';
update public.markers set ref_low = 6.0, ref_high = 8.3, ref_unit = 'g/dL'  where canonical_name = 'Total Protein';
update public.markers set ref_low = 9,   ref_high = 48,  ref_unit = 'U/L'   where canonical_name = 'GGT';

-- Thyroid
update public.markers set ref_low = 0.4, ref_high = 4.0, ref_unit = 'mIU/L' where canonical_name = 'TSH';
update public.markers set ref_low = 0.8, ref_high = 1.8, ref_unit = 'ng/dL' where canonical_name = 'Free T4';
update public.markers set ref_low = 2.3, ref_high = 4.2, ref_unit = 'pg/mL' where canonical_name = 'Free T3';

-- CBC
update public.markers set ref_low = 4.5, ref_high = 11.0, ref_unit = '10^3/uL' where canonical_name = 'White Blood Cells';
update public.markers set ref_low = 150, ref_high = 450,  ref_unit = '10^3/uL' where canonical_name = 'Platelets';
update public.markers set ref_low = 80,  ref_high = 100,  ref_unit = 'fL'      where canonical_name = 'MCV';
update public.markers set ref_low = 27,  ref_high = 33,   ref_unit = 'pg'      where canonical_name = 'MCH';
update public.markers set ref_low = 32,  ref_high = 36,   ref_unit = 'g/dL'    where canonical_name = 'MCHC';

-- Vitamins
update public.markers set ref_low = 30,  ref_high = 100, ref_unit = 'ng/mL' where canonical_name = 'Vitamin D';
update public.markers set ref_low = 200, ref_high = 900, ref_unit = 'pg/mL' where canonical_name = 'Vitamin B12';
update public.markers set ref_low = 2.7, ref_high = 17,  ref_unit = 'ng/mL' where canonical_name = 'Folate';

-- Minerals
update public.markers set ref_low = 1.7, ref_high = 2.2, ref_unit = 'mg/dL' where canonical_name = 'Magnesium';

-- Diabetes
update public.markers set ref_low = 4.0, ref_high = 5.6, ref_unit = '%' where canonical_name = 'HbA1c';

-- Inflammation
update public.markers set ref_low = 0, ref_high = 3,   ref_unit = 'mg/L' where canonical_name = 'CRP';
update public.markers set ref_low = 0, ref_high = 1,   ref_unit = 'mg/L' where canonical_name = 'hs-CRP';
update public.markers set ref_low = 0, ref_high = 20,  ref_unit = 'mm/hr' where canonical_name = 'ESR';

-- Coagulation
update public.markers set ref_low = 0.8, ref_high = 1.2, ref_unit = 'ratio' where canonical_name = 'INR';
