-- =============================================================================
-- Canonicalize seeded ref_unit values so they match what the edge function
-- will write after unit-normalization. Adds no new columns — just rewrites
-- the seeded unit strings to their canonical forms.
-- =============================================================================

update public.markers
  set ref_unit = 'K/µL'
  where ref_unit = '10^3/uL';

update public.markers
  set ref_unit = 'mL/min/1.73m²'
  where ref_unit = 'mL/min/1.73m2';
