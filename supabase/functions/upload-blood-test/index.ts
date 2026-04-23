import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "npm:openai@^4.80.0";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";
import { corsHeaders } from "../_shared/cors.ts";

const MODEL = Deno.env.get("AI_MODEL") ?? "gpt-4o-mini";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_BASE_URL = Deno.env.get("OPENAI_BASE_URL");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be set (supabase/functions/.env)");
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: OPENAI_BASE_URL });

async function sha256Hex(s: string): Promise<string> {
  const bytes = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  } catch {
    return "";
  }
}

// Keep in sync with lib/markers/categories.ts (the UI side). The edge
// function only needs the names for enum validation; descriptions live
// in the Next app.
const CATEGORIES = [
  "Lipids",
  "Metabolic",
  "Diabetes",
  "Liver",
  "Kidney",
  "Thyroid",
  "CBC",
  "Inflammation",
  "Cardiac",
  "Coagulation",
  "Vitamins",
  "Minerals",
  "Hormones",
  "Autoimmune",
  "Tumor Markers",
  "Infectious Disease",
  "Urinalysis",
  "Other",
] as const;
type Category = (typeof CATEGORIES)[number];
const CATEGORY_SET = new Set<string>(CATEGORIES);

// -----------------------------------------------------------------------------
// Unit canonicalization
//
// Labs (and the LLM pulling from them) write the same unit many different ways:
//   "10^3/uL", "10³/µL", "x10^3/uL", "K/uL"  -> all mean "thousand per µL"
//   "mg/dl",   "mg/dL"                         -> same
//   "mL/min/1.73m2", "mL/min/1.73m²"          -> same
// Every stored unit on blood_test_results is routed through canonicalUnit()
// so the UI never shows two forms of the same thing, and so our reference
// range lookup compares apples to apples.
// -----------------------------------------------------------------------------

const UNIT_CANONICAL: Record<string, string> = {
  // Thousands-per-microliter (cell counts)
  "10^3/ul": "K/µL",
  "10^3/µl": "K/µL",
  "x10^3/ul": "K/µL",
  "x10^3/µl": "K/µL",
  "k/ul": "K/µL",
  "k/µl": "K/µL",
  "thousand/ul": "K/µL",
  "thou/ul": "K/µL",
  // Millions-per-microliter (RBC)
  "10^6/ul": "M/µL",
  "10^6/µl": "M/µL",
  "x10^6/ul": "M/µL",
  "m/ul": "M/µL",
  "m/µl": "M/µL",
  "million/ul": "M/µL",
  // Bare per-microliter
  "/ul": "/µL",
  "/µl": "/µL",
  "/mm^3": "/µL",
  "/mm3": "/µL",
  // Mass per decilitre
  "mg/dl": "mg/dL",
  "ng/dl": "ng/dL",
  "g/dl": "g/dL",
  "ug/dl": "µg/dL",
  "µg/dl": "µg/dL",
  // Per litre
  "mg/l": "mg/L",
  "meq/l": "mEq/L",
  "mmol/l": "mmol/L",
  "miu/l": "mIU/L",
  "iu/l": "IU/L",
  "u/l": "U/L",
  // Per millilitre
  "pg/ml": "pg/mL",
  "ng/ml": "ng/mL",
  "ug/ml": "µg/mL",
  "µg/ml": "µg/mL",
  // Misc
  "fl": "fL",
  "pg": "pg",
  "%": "%",
  "mm/hr": "mm/hr",
  "mm/h": "mm/hr",
  "ratio": "ratio",
  // eGFR
  "ml/min/1.73m^2": "mL/min/1.73m²",
  "ml/min/1.73m2": "mL/min/1.73m²",
};

function canonicalUnit(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const folded = trimmed
    .replace(/μ/g, "µ") // Greek mu (U+03BC) -> micro sign (U+00B5)
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/⁶/g, "^6")
    .replace(/×/g, "x");
  const key = folded.toLowerCase().replace(/\s+/g, "");
  return UNIT_CANONICAL[key] ?? trimmed;
}

function buildPrompt(pdfText: string, fileName: string) {
  return `You are a medical data extraction assistant. Extract blood test results from this lab report text.

Lab report text:
${pdfText || "(PDF text could not be extracted - use filename for context: " + fileName + ")"}

Return a JSON object with this exact structure:
{
  "testDate": "YYYY-MM-DD or null if not found",
  "labName": "lab name or null",
  "patientName": "patient name or null",
  "results": [
    {
      "markerName": "marker name (e.g. Hemoglobin, Glucose, etc)",
      "value": 12.5,
      "unit": "g/dL",
      "referenceRangeLow": 12.0,
      "referenceRangeHigh": 16.0,
      "status": "normal" or "high" or "low" or "critical",
      "category": "one of: ${CATEGORIES.join(", ")}",
      "rawText": "original text from report"
    }
  ]
}

Rules:
- IMPORTANT: All output must be in English regardless of the language of the source document. Translate all marker names, units, lab names, and any other text fields into English.
- Use standard English medical terminology for marker names (e.g. "Hemoglobin", "Glucose", "White Blood Cells", "Cholesterol", etc.)
- Extract ALL lab markers/biomarkers you can find
- If a value is not numeric, set value to null
- If reference range is not given, set referenceRangeLow and referenceRangeHigh to null
- Determine status: normal if within range, high if above, low if below, critical if significantly out of range
- category MUST be exactly one of: ${CATEGORIES.join(", ")}. Use "Other" if nothing fits.
- Return ONLY valid JSON, no other text`;
}

type ExtractedResult = {
  markerName: string;
  value?: number | null;
  unit?: string | null;
  referenceRangeLow?: number | null;
  referenceRangeHigh?: number | null;
  status?: string | null;
  category?: string | null;
  rawText?: string | null;
};

type Extracted = {
  testDate?: string | null;
  labName?: string | null;
  patientName?: string | null;
  results?: ExtractedResult[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // Supabase client acting as the calling user — RLS is enforced.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  let body: { fileName?: string; pdfBase64?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const { fileName, pdfBase64, notes } = body;
  if (!fileName || !pdfBase64) {
    return new Response(JSON.stringify({ error: "fileName and pdfBase64 are required" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const contentHash = await sha256Hex(pdfBase64);

  // Dedup within this user's tests only.
  const { data: existing } = await supabase
    .from("blood_tests")
    .select("id, file_name, test_date, created_at")
    .eq("content_hash", contentHash)
    .maybeSingle();

  if (existing) {
    const uploadedOn = new Date(existing.created_at).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    return new Response(
      JSON.stringify({
        error: `This blood test has already been uploaded (originally added on ${uploadedOn} as "${existing.file_name}").`,
      }),
      { status: 409, headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  }

  const pdfBytes = base64ToBytes(pdfBase64);

  // User-scoped storage path satisfies the storage RLS policy.
  await supabase.storage
    .from("blood-tests")
    .upload(`${user.id}/${contentHash}.pdf`, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  const pdfText = await extractPdfText(pdfBytes);

  let extracted: Extracted = {};
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: buildPrompt(pdfText, fileName) }],
      response_format: { type: "json_object" },
    });
    const content = completion.choices[0]?.message?.content ?? "{}";
    extracted = JSON.parse(content);
  } catch (err) {
    console.error("AI extraction failed", err);
    extracted = { results: [] };
  }

  // user_id is filled automatically by the `default auth.uid()` column default.
  const { data: inserted, error: insertErr } = await supabase
    .from("blood_tests")
    .insert({
      file_name: fileName,
      content_hash: contentHash,
      test_date: extracted.testDate ?? null,
      lab_name: extracted.labName ?? null,
      patient_name: extracted.patientName ?? null,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (insertErr || !inserted) {
    return new Response(JSON.stringify({ error: insertErr?.message ?? "Insert failed" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const extractedResults = extracted.results ?? [];

  // Resolve category, canonical name, and our own reference range via one
  // batched RPC. categorize_markers returns everything we have about a marker
  // in the canonical table. Ranges from the lab are ignored whenever we have
  // our own: labs print wildly inconsistent/wrong ranges, so we trust ours
  // and recompute status accordingly.
  type MarkerRef = {
    category?: string;
    canonical_name?: string;
    ref_low?: number | null;
    ref_high?: number | null;
    ref_unit?: string | null;
  };
  const refByName = new Map<string, MarkerRef>();
  if (extractedResults.length > 0) {
    const names = extractedResults.map((r) => r.markerName).filter(Boolean);
    const { data: mapping } = await supabase.rpc("categorize_markers", { names });
    for (const row of mapping ?? []) {
      refByName.set(row.input_name.toLowerCase(), {
        category: row.category ?? undefined,
        canonical_name: row.canonical_name ?? undefined,
        ref_low: row.ref_low,
        ref_high: row.ref_high,
        ref_unit: row.ref_unit,
      });
    }
  }

  function normUnit(u: string | null | undefined): string {
    return (u ?? "").toLowerCase().replace(/\s+/g, "");
  }

  function resolveCategory(r: ExtractedResult, ref: MarkerRef | undefined): Category {
    if (ref?.category && CATEGORY_SET.has(ref.category)) return ref.category as Category;
    if (r.category && CATEGORY_SET.has(r.category)) return r.category as Category;
    return "Other";
  }

  function computeStatus(
    value: number | null | undefined,
    low: number | null | undefined,
    high: number | null | undefined
  ): string | null {
    if (value == null) return null;
    if (high != null && value > high) return "high";
    if (low != null && value < low) return "low";
    if (low != null || high != null) return "normal";
    return null;
  }

  const rows = extractedResults.map((r) => {
    const ref = refByName.get(r.markerName?.toLowerCase() ?? "");
    const canonicalName = ref?.canonical_name ?? r.markerName;

    // If our canonical marker has a reference range AND the lab reported in
    // the same unit, swap in our range and recompute status. Otherwise keep
    // what the LLM extracted (range + status).
    const ourRefKnown = ref && (ref.ref_low != null || ref.ref_high != null);
    const unitMatches = ref?.ref_unit ? normUnit(r.unit) === normUnit(ref.ref_unit) : false;
    const useOurRef = ourRefKnown && unitMatches;

    const refLow = useOurRef ? ref!.ref_low ?? null : r.referenceRangeLow ?? null;
    const refHigh = useOurRef ? ref!.ref_high ?? null : r.referenceRangeHigh ?? null;
    const status = useOurRef
      ? computeStatus(r.value ?? null, refLow, refHigh)
      : r.status ?? null;

    return {
      blood_test_id: inserted.id,
      marker_name: canonicalName,
      value: r.value ?? null,
      unit: r.unit ?? null,
      reference_range_low: refLow,
      reference_range_high: refHigh,
      status,
      category: resolveCategory(r, ref),
      raw_text: r.rawText ?? null,
    };
  });

  if (rows.length > 0) {
    await supabase.from("blood_test_results").insert(rows);
  }

  const { data: saved } = await supabase
    .from("blood_test_results")
    .select("*")
    .eq("blood_test_id", inserted.id);

  return new Response(JSON.stringify({ ...inserted, results: saved ?? [] }), {
    status: 201,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
