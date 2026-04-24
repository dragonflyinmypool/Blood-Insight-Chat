-- =============================================================================
-- Marker FK + canonical catalog expansion.
--
-- Problem: blood_test_results.marker_name was free text. The upload path tried
-- to normalize via categorize_markers(), but any miss (e.g. the LLM emits
-- "ALT (Alanine Aminotransferase)") produced a duplicate that lived forever.
--
-- Fix (this migration):
--   1. Add blood_test_results.marker_id bigint references markers(id). When we
--      can match a row to a canonical marker, the FK is set and dedup is done
--      by the database, not by string comparison.
--   2. Rewrite categorize_markers() to return marker_id and to match on a
--      normalized form of the name (lowercased, parentheticals stripped). This
--      alone catches the "ALT (Alanine Aminotransferase)" family for free.
--   3. Massively expand the canonical catalog: new entries for CBC differential,
--      extra liver/lipid/thyroid/hormone/vitamin markers, many more aliases.
--   4. Backfill existing rows through the new matcher so current duplicates
--      collapse onto canonical marker_ids.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schema change: FK column on blood_test_results.
-- -----------------------------------------------------------------------------

alter table public.blood_test_results
  add column marker_id bigint references public.markers(id) on delete set null;

create index blood_test_results_marker_id_idx
  on public.blood_test_results (marker_id);

-- -----------------------------------------------------------------------------
-- Name normalizer. Strips parentheticals and collapses whitespace so the LLM's
-- favorite variants ("ALT (Alanine Aminotransferase)",
-- "Alanine Aminotransferase (ALT)", "Vitamin D (25-Hydroxy)") reduce to plain
-- forms that match either the canonical name or an alias.
-- -----------------------------------------------------------------------------

create or replace function public.marker_normalize(name text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      regexp_replace(
        lower(coalesce(name, '')),
        '\s*\([^)]*\)\s*', ' ', 'g'
      ),
      '\s+', ' ', 'g'
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- RPC: match a batch of marker names to canonical rows. Returns id + category
-- + canonical_name + ref range in one round trip. The match predicate is:
--   normalized(canonical_name) == normalized(input)
--   OR any alias normalizes to the input
-- -----------------------------------------------------------------------------

drop function if exists public.categorize_markers(text[]);

create or replace function public.categorize_markers(names text[])
returns table (
  input_name text,
  marker_id bigint,
  category text,
  canonical_name text,
  ref_low double precision,
  ref_high double precision,
  ref_unit text
)
language sql
stable
security invoker
as $$
  select
    n as input_name,
    m.id as marker_id,
    m.category,
    m.canonical_name,
    m.ref_low,
    m.ref_high,
    m.ref_unit
  from unnest(names) as n
  left join lateral (
    select id, category, canonical_name, ref_low, ref_high, ref_unit
    from public.markers mm
    where public.marker_normalize(mm.canonical_name) = public.marker_normalize(n)
       or exists (
         select 1
         from unnest(mm.aliases) a
         where public.marker_normalize(a) = public.marker_normalize(n)
       )
    limit 1
  ) m on true;
$$;

-- -----------------------------------------------------------------------------
-- Expand aliases on existing canonical markers so the LLM's long-form and
-- short-form variants all converge.
-- -----------------------------------------------------------------------------

update public.markers set aliases = aliases || array[
  'Cholesterol Total', 'Cholesterol, Total', 'Total Chol', 'Cholesterol Serum'
] where canonical_name = 'Total Cholesterol';

update public.markers set aliases = aliases || array[
  'LDL', 'LDL-C', 'LDL Cholesterol Calc', 'LDL Calculated', 'LDL Direct'
] where canonical_name = 'LDL Cholesterol';

update public.markers set aliases = aliases || array[
  'HDL', 'HDL-C', 'HDL Cholesterol Direct'
] where canonical_name = 'HDL Cholesterol';

update public.markers set aliases = aliases || array['VLDL-C', 'VLDL', 'VLDL Calc']
  where canonical_name = 'VLDL Cholesterol';

update public.markers set aliases = aliases || array['Trig', 'Trigs', 'TG']
  where canonical_name = 'Triglycerides';

update public.markers set aliases = aliases || array['WBC', 'WBC Count', 'White Blood Cell Count', 'Leukocytes', 'Leukocyte Count']
  where canonical_name = 'White Blood Cells';

update public.markers set aliases = aliases || array['RBC', 'RBC Count', 'Red Blood Cell Count', 'Erythrocytes', 'Erythrocyte Count']
  where canonical_name = 'Red Blood Cells';

update public.markers set aliases = aliases || array['PLT', 'PLT Count', 'Platelet Count', 'Platelet']
  where canonical_name = 'Platelets';

update public.markers set aliases = aliases || array['Mean Corpuscular Volume']
  where canonical_name = 'MCV';

update public.markers set aliases = aliases || array['Mean Corpuscular Hemoglobin']
  where canonical_name = 'MCH';

update public.markers set aliases = aliases || array['Mean Corpuscular Hemoglobin Concentration']
  where canonical_name = 'MCHC';

update public.markers set aliases = aliases || array[
  'Red Cell Distribution Width', 'Red Blood Cell Distribution Width',
  'RDW-CV', 'RDW CV'
] where canonical_name = 'RDW';

update public.markers set aliases = aliases || array['Hb', 'Hgb', 'HGB']
  where canonical_name = 'Hemoglobin';

update public.markers set aliases = aliases || array['Hct', 'HCT', 'PCV', 'Packed Cell Volume']
  where canonical_name = 'Hematocrit';

update public.markers set aliases = aliases || array[
  'Vitamin D Total', 'Vitamin D, Total', 'Vitamin D3', 'Vitamin D 25 OH',
  '25 OH Vitamin D', '25(OH)D', '25-Hydroxyvitamin D'
] where canonical_name = 'Vitamin D';

update public.markers set aliases = aliases || array[
  'Thyroxine, Free', 'T4 Free', 'FT4 Index'
] where canonical_name = 'Free T4';

update public.markers set aliases = aliases || array[
  'Triiodothyronine, Free', 'T3 Free'
] where canonical_name = 'Free T3';

update public.markers set aliases = aliases || array[
  'Thyrotropin', 'TSH 3rd Generation', 'Thyroid Stimulating Hormone'
] where canonical_name = 'TSH';

update public.markers set aliases = aliases || array['A1C', 'A1c', 'Glycohemoglobin']
  where canonical_name = 'HbA1c';

update public.markers set aliases = aliases || array['hsCRP', 'High Sensitivity CRP', 'HS CRP']
  where canonical_name = 'hs-CRP';

update public.markers set aliases = aliases || array['Sed Rate', 'ESR Westergren', 'Erythrocyte Sedimentation Rate']
  where canonical_name = 'ESR';

update public.markers set aliases = aliases || array['Serum Iron']
  where canonical_name = 'Iron';

-- -----------------------------------------------------------------------------
-- New canonical markers. on conflict do nothing so re-running the migration
-- (or overlapping names) is safe.
-- -----------------------------------------------------------------------------

insert into public.markers (canonical_name, category, aliases, ref_low, ref_high, ref_unit) values

-- Lipids extras
('Apolipoprotein A1', 'Lipids',
  array['ApoA1', 'Apo A-I', 'Apolipoprotein A-I', 'Apo A1'],
  null, null, null),
('Apolipoprotein B', 'Lipids',
  array['ApoB', 'Apo B', 'Apolipoprotein B-100', 'Apo B100'],
  null, null, null),
('Lipoprotein(a)', 'Lipids',
  array['Lp(a)', 'Lipoprotein a', 'LP(a)', 'Lipoprotein Little a'],
  null, null, null),
('LDL Particle Number', 'Lipids',
  array['LDL-P', 'LDL Particle', 'LDL Particles'],
  null, null, null),
('HDL Particle Number', 'Lipids',
  array['HDL-P', 'HDL Particle', 'HDL Particles'],
  null, null, null),
('Small Dense LDL', 'Lipids',
  array['sdLDL', 'Small-Dense LDL', 'Small LDL', 'LDL Small Dense'],
  null, null, null),

-- Metabolic extras
('Anion Gap', 'Metabolic', array['AG'], 7, 16, 'mEq/L'),
('Osmolality', 'Metabolic', array['Serum Osmolality', 'Osmol', 'Plasma Osmolality'], 275, 295, 'mOsm/kg'),
('Lactate', 'Metabolic', array['Lactic Acid', 'Blood Lactate'], 0.5, 2.2, 'mmol/L'),
('Ammonia', 'Metabolic', array['NH3', 'Serum Ammonia', 'Blood Ammonia'], 15, 45, 'µg/dL'),
('Phosphorus', 'Metabolic', array['Phosphate', 'PO4', 'Inorganic Phosphate', 'Serum Phosphorus'], 2.5, 4.5, 'mg/dL'),
('Ionized Calcium', 'Metabolic', array['Free Calcium', 'Ca Ionized', 'iCa'], 4.6, 5.3, 'mg/dL'),

-- Diabetes extras
('C-Peptide', 'Diabetes', array['C Peptide', 'Connecting Peptide', 'Insulin C-Peptide'], 0.8, 3.1, 'ng/mL'),
('Fructosamine', 'Diabetes', array[]::text[], 190, 270, 'µmol/L'),
('Fasting Insulin', 'Diabetes', array['Insulin Fasting', 'Insulin (Fasting)'], 2, 20, 'µIU/mL'),
('HOMA-IR', 'Diabetes', array['Homeostatic Model Assessment IR', 'Insulin Resistance'], null, null, null),

-- Liver extras
('Indirect Bilirubin', 'Liver', array['Unconjugated Bilirubin', 'Bilirubin Indirect'], 0.1, 1.0, 'mg/dL'),
('Globulin', 'Liver', array['Total Globulin', 'Serum Globulin'], 2.0, 3.5, 'g/dL'),
('A/G Ratio', 'Liver', array['Albumin/Globulin Ratio', 'Albumin Globulin Ratio', 'Alb/Glob Ratio'], 1.1, 2.5, 'ratio'),

-- Kidney extras
('Cystatin C', 'Kidney', array['Serum Cystatin C'], 0.5, 1.0, 'mg/L'),
('BUN/Creatinine Ratio', 'Kidney', array['BUN Creatinine Ratio', 'BUN/Cr Ratio', 'Urea/Creatinine Ratio'], 10, 20, 'ratio'),
('Albumin/Creatinine Ratio', 'Kidney', array['ACR', 'Urine ACR', 'Microalbumin/Creatinine Ratio', 'Urine Albumin/Creatinine'], 0, 30, 'mg/g'),

-- Thyroid extras
('Total T3', 'Thyroid', array['T3 Total', 'Triiodothyronine Total', 'Total Triiodothyronine', 'T3, Total'], 0.8, 2.0, 'ng/mL'),
('Total T4', 'Thyroid', array['T4 Total', 'Thyroxine Total', 'Total Thyroxine', 'T4, Total'], 4.5, 12.0, 'µg/dL'),
('Reverse T3', 'Thyroid', array['rT3', 'RT3', 'Reverse Triiodothyronine'], 9.2, 24.1, 'ng/dL'),
('Thyroglobulin', 'Thyroid', array['Tg'], 1.4, 29.2, 'ng/mL'),
('Thyroid Peroxidase Antibody', 'Thyroid',
  array['TPO', 'TPOAb', 'Anti-TPO', 'TPO Antibodies', 'Anti-Thyroid Peroxidase', 'Thyroid Peroxidase Antibodies'],
  0, 9, 'IU/mL'),
('Thyroglobulin Antibody', 'Thyroid',
  array['TgAb', 'Anti-Tg', 'Thyroglobulin Ab', 'Anti-Thyroglobulin', 'Thyroglobulin Antibodies'],
  0, 4, 'IU/mL'),

-- CBC differential (this was the biggest gap)
('Neutrophils', 'CBC', array['Neutrophil %', 'Neut %', 'Neutrophil Percentage', 'Polys', 'Polymorphonuclear', 'Neut', 'Segs', 'Segmented Neutrophils'], 40, 74, '%'),
('Absolute Neutrophils', 'CBC', array['Absolute Neutrophil Count', 'ANC', 'Neutrophil Count', 'Neutrophils Absolute', 'Neut Absolute'], 1.5, 7.8, 'K/µL'),
('Lymphocytes', 'CBC', array['Lymphocyte %', 'Lymph %', 'Lymphs', 'Lymphocyte Percentage', 'Lymph'], 19, 48, '%'),
('Absolute Lymphocytes', 'CBC', array['Absolute Lymphocyte Count', 'ALC', 'Lymphocyte Count', 'Lymphocytes Absolute', 'Lymph Absolute'], 0.85, 3.9, 'K/µL'),
('Monocytes', 'CBC', array['Monocyte %', 'Mono %', 'Monos', 'Monocyte Percentage', 'Mono'], 2, 10, '%'),
('Absolute Monocytes', 'CBC', array['Absolute Monocyte Count', 'AMC', 'Monocyte Count', 'Monocytes Absolute', 'Mono Absolute'], 0.2, 0.95, 'K/µL'),
('Eosinophils', 'CBC', array['Eosinophil %', 'Eos %', 'Eosinophil Percentage', 'Eos'], 0, 6, '%'),
('Absolute Eosinophils', 'CBC', array['Absolute Eosinophil Count', 'AEC', 'Eosinophil Count', 'Eosinophils Absolute', 'Eos Absolute'], 0, 0.5, 'K/µL'),
('Basophils', 'CBC', array['Basophil %', 'Baso %', 'Basophil Percentage', 'Baso'], 0, 2, '%'),
('Absolute Basophils', 'CBC', array['Absolute Basophil Count', 'ABC', 'Basophil Count', 'Basophils Absolute', 'Baso Absolute'], 0, 0.2, 'K/µL'),
('Immature Granulocytes', 'CBC', array['IG', 'IG %', 'Bands', 'Band Cells', 'Band Neutrophils'], 0, 0.03, 'K/µL'),
('Nucleated RBC', 'CBC', array['NRBC', 'nRBC', 'Nucleated Red Blood Cells'], 0, 0, '/100 WBC'),
('Reticulocytes', 'CBC', array['Retic %', 'Reticulocyte Percentage', 'Retic'], 0.5, 2.5, '%'),
('Absolute Reticulocytes', 'CBC', array['Reticulocyte Count', 'Retic Count', 'Absolute Retic'], 25, 100, 'K/µL'),
('Mean Platelet Volume', 'CBC', array['MPV'], 7.5, 11.5, 'fL'),
('Platelet Distribution Width', 'CBC', array['PDW'], 9, 17, '%'),
('Plateletcrit', 'CBC', array['PCT (Plateletcrit)'], 0.17, 0.35, '%'),

-- Inflammation extras
('Procalcitonin', 'Inflammation', array['Procal', 'Serum Procalcitonin'], 0, 0.1, 'ng/mL'),

-- Cardiac extras
('CK-MB', 'Cardiac', array['Creatine Kinase MB', 'CK Cardiac', 'CKMB', 'CK-MB Mass'], 0, 6.3, 'ng/mL'),
('Creatine Kinase', 'Cardiac', array['CK', 'CK Total', 'CPK', 'Creatine Phosphokinase', 'Total CK'], 22, 198, 'U/L'),
('LDH', 'Cardiac', array['Lactate Dehydrogenase', 'LD', 'Lactic Dehydrogenase'], 140, 280, 'U/L'),
('BNP', 'Cardiac', array['B-type Natriuretic Peptide', 'Brain Natriuretic Peptide'], 0, 100, 'pg/mL'),
('Myoglobin', 'Cardiac', array['Serum Myoglobin'], 25, 72, 'ng/mL'),
('High-Sensitivity Troponin', 'Cardiac', array['hs-Troponin', 'hsTnT', 'hsTn', 'High-Sensitivity Cardiac Troponin', 'hs-Troponin T', 'hs-Troponin I'], 0, 14, 'ng/L'),

-- Coagulation extras
('Fibrinogen', 'Coagulation', array['Fibrinogen Activity', 'Fibrinogen Level'], 200, 400, 'mg/dL'),
('Antithrombin III', 'Coagulation', array['AT-III', 'AT3', 'Antithrombin', 'ATIII', 'Antithrombin Activity'], 80, 120, '%'),
('Protein C', 'Coagulation', array['Protein C Activity', 'Protein C Functional'], 70, 140, '%'),
('Protein S', 'Coagulation', array['Protein S Activity', 'Protein S Free'], 65, 140, '%'),
('D-Dimer Quantitative', 'Coagulation', array['D Dimer', 'Quantitative D-Dimer'], 0, 500, 'ng/mL FEU'),

-- Vitamins extras
('Vitamin A', 'Vitamins', array['Retinol', 'Serum Retinol'], 32.5, 78, 'µg/dL'),
('Vitamin E', 'Vitamins', array['Tocopherol', 'Alpha-Tocopherol', 'Alpha Tocopherol'], 5.5, 17, 'mg/L'),
('Vitamin K', 'Vitamins', array['Phylloquinone', 'Vitamin K1'], 0.1, 2.2, 'ng/mL'),
('Vitamin B1', 'Vitamins', array['Thiamine', 'Thiamin'], 70, 180, 'nmol/L'),
('Vitamin B2', 'Vitamins', array['Riboflavin'], 137, 370, 'nmol/L'),
('Vitamin B3', 'Vitamins', array['Niacin', 'Nicotinamide'], null, null, null),
('Vitamin B6', 'Vitamins', array['Pyridoxine', 'Pyridoxal 5-Phosphate', 'PLP', 'P5P', 'Pyridoxal Phosphate'], 5, 50, 'ng/mL'),
('Vitamin C', 'Vitamins', array['Ascorbic Acid', 'Ascorbate', 'L-Ascorbate'], 0.4, 2.0, 'mg/dL'),
('Methylmalonic Acid', 'Vitamins', array['MMA', 'Serum MMA'], 0, 0.4, 'µmol/L'),
('Homocysteine', 'Vitamins', array['Hcy', 'Total Homocysteine'], 0, 15, 'µmol/L'),

-- Minerals extras
('TIBC', 'Minerals', array['Total Iron Binding Capacity'], 250, 450, 'µg/dL'),
('Transferrin', 'Minerals', array['Serum Transferrin'], 200, 360, 'mg/dL'),
('Transferrin Saturation', 'Minerals', array['Iron Saturation', '% Saturation', 'Transferrin Sat', 'Iron Sat', 'Tsat'], 20, 50, '%'),
('UIBC', 'Minerals', array['Unsaturated Iron Binding Capacity'], 111, 343, 'µg/dL'),
('Copper', 'Minerals', array['Cu', 'Serum Copper'], 70, 140, 'µg/dL'),
('Ceruloplasmin', 'Minerals', array['Serum Ceruloplasmin'], 20, 60, 'mg/dL'),
('Selenium', 'Minerals', array['Se', 'Serum Selenium'], 70, 150, 'µg/L'),

-- Hormones extras
('Free Testosterone', 'Hormones', array['Testosterone Free', 'Free Testosterone Level', 'Testosterone, Free'], 5, 21, 'pg/mL'),
('Bioavailable Testosterone', 'Hormones', array['Bio T', 'Testosterone Bioavailable', 'Bio-Available Testosterone'], 110, 575, 'ng/dL'),
('Total Testosterone', 'Hormones', array['Testosterone Total', 'Testosterone, Total', 'Serum Testosterone'], 264, 916, 'ng/dL'),
('SHBG', 'Hormones', array['Sex Hormone Binding Globulin', 'Sex Hormone-Binding Globulin'], 10, 57, 'nmol/L'),
('DHEA-S', 'Hormones', array['DHEA Sulfate', 'DHEAS', 'Dehydroepiandrosterone Sulfate', 'DHEA-Sulfate'], 80, 560, 'µg/dL'),
('FSH', 'Hormones', array['Follicle Stimulating Hormone', 'Follicle-Stimulating Hormone', 'Follitropin'], 1.5, 12.4, 'mIU/mL'),
('LH', 'Hormones', array['Luteinizing Hormone', 'Lutropin'], 1.7, 8.6, 'mIU/mL'),
('Prolactin', 'Hormones', array['PRL', 'Serum Prolactin'], 4, 15.2, 'ng/mL'),
('Progesterone', 'Hormones', array['Serum Progesterone'], 0.2, 1.4, 'ng/mL'),
('Estrone', 'Hormones', array['E1'], 10, 60, 'pg/mL'),
('Estriol', 'Hormones', array['E3', 'Unconjugated Estriol'], null, null, null),
('Growth Hormone', 'Hormones', array['GH', 'Somatotropin', 'HGH'], 0, 5, 'ng/mL'),
('IGF-1', 'Hormones', array['Insulin-Like Growth Factor 1', 'Somatomedin C', 'IGF1', 'Insulin Like Growth Factor 1'], 98, 282, 'ng/mL'),
('ACTH', 'Hormones', array['Adrenocorticotropic Hormone', 'Corticotropin'], 7.2, 63, 'pg/mL'),
('Aldosterone', 'Hormones', array['Serum Aldosterone'], 0, 30, 'ng/dL'),
('Renin', 'Hormones', array['Plasma Renin Activity', 'PRA', 'Direct Renin'], 0.25, 5.82, 'ng/mL/hr'),
('17-Hydroxyprogesterone', 'Hormones', array['17-OHP', '17 OH Progesterone', '17-OH Progesterone'], 32, 307, 'ng/dL'),
('Parathyroid Hormone', 'Hormones', array['PTH', 'Intact PTH', 'iPTH', 'PTH Intact'], 15, 65, 'pg/mL'),
('1,25-Dihydroxy Vitamin D', 'Hormones', array['Calcitriol', '1,25-OH Vitamin D', '1,25-Dihydroxyvitamin D', '1,25 Vit D'], 19.9, 79.3, 'pg/mL'),

-- Autoimmune extras
('Anti-Sm', 'Autoimmune', array['Smith Antibody', 'Anti-Smith', 'Sm Antibody'], 0, 0.9, 'AI'),
('Anti-SSA', 'Autoimmune', array['SSA', 'Anti-Ro', 'Ro Antibody', 'Anti-SSA/Ro', 'SS-A Antibody'], 0, 0.9, 'AI'),
('Anti-SSB', 'Autoimmune', array['SSB', 'Anti-La', 'La Antibody', 'Anti-SSB/La', 'SS-B Antibody'], 0, 0.9, 'AI'),
('Anti-Jo1', 'Autoimmune', array['Jo-1 Antibody', 'Jo1 Antibody', 'Jo-1'], 0, 0.9, 'AI'),
('Anti-Scl-70', 'Autoimmune', array['Scl-70 Antibody', 'Topoisomerase Antibody', 'Scl70 Antibody'], 0, 0.9, 'AI'),
('Anti-Centromere', 'Autoimmune', array['Centromere Antibody', 'ACA'], 0, 0.9, 'AI'),
('Anti-MPO', 'Autoimmune', array['MPO', 'Myeloperoxidase Antibody', 'MPO-ANCA'], 0, 20, 'AU/mL'),
('Anti-PR3', 'Autoimmune', array['PR3', 'Proteinase 3 Antibody', 'PR3-ANCA'], 0, 20, 'AU/mL'),
('ANCA', 'Autoimmune', array['Antineutrophil Cytoplasmic Antibody', 'c-ANCA', 'p-ANCA'], null, null, null),
('IgG', 'Autoimmune', array['Immunoglobulin G', 'Total IgG'], 700, 1600, 'mg/dL'),
('IgA', 'Autoimmune', array['Immunoglobulin A', 'Total IgA'], 70, 400, 'mg/dL'),
('IgM', 'Autoimmune', array['Immunoglobulin M', 'Total IgM'], 40, 230, 'mg/dL'),
('IgE', 'Autoimmune', array['Immunoglobulin E', 'Total IgE'], 0, 100, 'IU/mL'),

-- Tumor Markers extras
('Beta-hCG', 'Tumor Markers', array['Human Chorionic Gonadotropin', 'hCG', 'B-hCG', 'Beta Human Chorionic Gonadotropin', 'Quantitative hCG', 'Beta HCG'], 0, 5, 'mIU/mL'),
('Chromogranin A', 'Tumor Markers', array['CgA'], 0, 95, 'ng/mL'),
('Calcitonin', 'Tumor Markers', array['Serum Calcitonin'], 0, 10, 'pg/mL'),

-- Infectious Disease extras
('Hepatitis A Antibody', 'Infectious Disease', array['HAV Ab', 'Anti-HAV', 'Hep A Antibody'], null, null, null),
('Hepatitis B Core Antibody', 'Infectious Disease', array['HBcAb', 'Anti-HBc', 'Hep B Core Ab'], null, null, null),
('Hepatitis B Surface Antibody', 'Infectious Disease', array['HBsAb', 'Anti-HBs', 'Hep B Surface Ab'], null, null, null),
('CMV IgG', 'Infectious Disease', array['Cytomegalovirus IgG', 'CMV Antibody IgG'], null, null, null),
('CMV IgM', 'Infectious Disease', array['Cytomegalovirus IgM', 'CMV Antibody IgM'], null, null, null),
('EBV IgG', 'Infectious Disease', array['Epstein-Barr Virus IgG', 'EBV Antibody IgG', 'Epstein Barr IgG'], null, null, null),
('EBV IgM', 'Infectious Disease', array['Epstein-Barr Virus IgM', 'EBV Antibody IgM'], null, null, null),
('Varicella IgG', 'Infectious Disease', array['VZV IgG', 'Chickenpox Antibody', 'Varicella-Zoster IgG'], null, null, null),
('Measles IgG', 'Infectious Disease', array['Rubeola IgG', 'Measles Antibody'], null, null, null),
('Mumps IgG', 'Infectious Disease', array['Mumps Antibody'], null, null, null),
('Rubella IgG', 'Infectious Disease', array['Rubella Antibody', 'German Measles Antibody'], null, null, null),
('COVID-19 Antibody', 'Infectious Disease', array['SARS-CoV-2 Antibody', 'COVID Ab', 'SARS-CoV-2 Ab', 'SARS CoV 2 Antibody'], null, null, null),
('H. pylori Antibody', 'Infectious Disease', array['Helicobacter Pylori Antibody', 'H Pylori', 'H. pylori Ab'], null, null, null),

-- Urinalysis extras
('Urine Creatinine', 'Urinalysis', array['Creatinine Urine', 'UCr'], null, null, 'mg/dL'),
('Urine Sodium', 'Urinalysis', array['Urine Na', 'Sodium Urine'], null, null, 'mEq/L'),
('Urine WBC', 'Urinalysis', array['Urine White Blood Cells', 'Leukocytes Urine', 'WBC Urine'], 0, 5, '/hpf'),
('Urine RBC', 'Urinalysis', array['Urine Red Blood Cells', 'RBC Urine'], 0, 4, '/hpf'),
('Urine Bacteria', 'Urinalysis', array['Bacteria Urine'], null, null, null),
('Urine Nitrites', 'Urinalysis', array['Urine Nitrite', 'Nitrites Urine'], null, null, null),
('Urine Leukocyte Esterase', 'Urinalysis', array['Leukocyte Esterase', 'Urine LE', 'LE'], null, null, null),
('Urine Bilirubin', 'Urinalysis', array['Bilirubin Urine'], null, null, null),
('Urine Urobilinogen', 'Urinalysis', array['Urobilinogen', 'Urine UBG', 'Urobilinogen Urine'], 0.2, 1.0, 'mg/dL'),
('Urine Albumin', 'Urinalysis', array['Albumin Urine', 'Urinary Albumin'], 0, 30, 'mg/g creat'),

-- Misc/Other
('Blood Group', 'Other', array['ABO Group', 'Blood Type', 'ABO Blood Group', 'Blood Group ABO'], null, null, null),
('Rh Factor', 'Other', array['Rh Type', 'Rh', 'Rh(D)', 'Rh D'], null, null, null)

on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Backfill: set marker_id on existing blood_test_results via the new matcher,
-- and rewrite marker_name to the canonical form. Rows still unmatched after
-- this keep marker_id NULL and live in "Other".
-- -----------------------------------------------------------------------------

update public.blood_test_results r
set
  marker_id = m.id,
  marker_name = m.canonical_name,
  category = coalesce(r.category, m.category)
from public.markers m
where r.marker_id is null
  and r.marker_name is not null
  and (
    public.marker_normalize(m.canonical_name) = public.marker_normalize(r.marker_name)
    or exists (
      select 1 from unnest(m.aliases) a
      where public.marker_normalize(a) = public.marker_normalize(r.marker_name)
    )
  );

-- Any row still without a category lands in 'Other' so the Results page groups it.
update public.blood_test_results
set category = 'Other'
where category is null;
