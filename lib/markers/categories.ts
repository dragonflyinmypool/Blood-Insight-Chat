// Canonical list of marker categories. Order here is the display order
// used on the test detail page. Edit this file to add, rename, or reorder.
//
// Keep in sync with the CATEGORIES enum in
// supabase/functions/upload-blood-test/index.ts — the LLM is told to pick
// from that list; this file adds the UI-facing description + ordering.

export const CATEGORY_DEFINITIONS = [
  {
    name: "Lipids",
    description: "Cholesterol and fats in your blood — key indicators of cardiovascular risk.",
  },
  {
    name: "Metabolic",
    description: "Electrolytes, glucose, and kidney basics — your body's chemical baseline.",
  },
  {
    name: "Diabetes",
    description: "Long-term and short-term glucose control indicators.",
  },
  {
    name: "Liver",
    description: "Enzymes and proteins that show how your liver is processing and detoxifying.",
  },
  {
    name: "Kidney",
    description: "Filtration markers that gauge how well your kidneys are clearing waste.",
  },
  {
    name: "Thyroid",
    description: "Hormones regulating metabolism, energy, and temperature.",
  },
  {
    name: "CBC",
    description: "Red cells, white cells, and platelets — the core complete blood count.",
  },
  {
    name: "Inflammation",
    description: "Markers signaling infection, injury, or chronic inflammation.",
  },
  {
    name: "Cardiac",
    description: "Proteins released when heart muscle is stressed or damaged.",
  },
  {
    name: "Coagulation",
    description: "How quickly your blood clots — key before surgery or on blood thinners.",
  },
  {
    name: "Vitamins",
    description: "Vitamin levels linked to energy, immunity, and cellular health.",
  },
  {
    name: "Minerals",
    description: "Iron and trace elements your body needs for oxygen transport and enzyme function.",
  },
  {
    name: "Hormones",
    description: "Sex, stress, and regulatory hormones that influence mood, energy, and reproduction.",
  },
  {
    name: "Autoimmune",
    description: "Antibodies that suggest the immune system may be attacking the body.",
  },
  {
    name: "Tumor Markers",
    description: "Proteins associated with specific cancers; used for screening or monitoring.",
  },
  {
    name: "Infectious Disease",
    description: "Antibodies or antigens from viral, bacterial, or parasitic infections.",
  },
  {
    name: "Urinalysis",
    description: "Chemistry and cells in urine — screens kidney function and urinary tract health.",
  },
  {
    name: "Other",
    description: "Markers that didn't fit into the categories above.",
  },
] as const;

export type Category = (typeof CATEGORY_DEFINITIONS)[number]["name"];

export const CATEGORY_NAMES = CATEGORY_DEFINITIONS.map((c) => c.name) as readonly Category[];

const CATEGORY_META_MAP = new Map<Category, { description: string; order: number }>(
  CATEGORY_DEFINITIONS.map((c, i) => [c.name, { description: c.description, order: i }])
);

export function categoryMeta(name: string): { description: string; order: number; resolved: Category } {
  const meta = CATEGORY_META_MAP.get(name as Category);
  if (meta) return { ...meta, resolved: name as Category };
  const other = CATEGORY_META_MAP.get("Other")!;
  return { ...other, resolved: "Other" };
}
