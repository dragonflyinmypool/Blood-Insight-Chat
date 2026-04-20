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
- Return ONLY valid JSON, no other text`;
}

type ExtractedResult = {
  markerName: string;
  value?: number | null;
  unit?: string | null;
  referenceRangeLow?: number | null;
  referenceRangeHigh?: number | null;
  status?: string | null;
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

  const rows = (extracted.results ?? []).map((r) => ({
    blood_test_id: inserted.id,
    marker_name: r.markerName,
    value: r.value ?? null,
    unit: r.unit ?? null,
    reference_range_low: r.referenceRangeLow ?? null,
    reference_range_high: r.referenceRangeHigh ?? null,
    status: r.status ?? null,
    raw_text: r.rawText ?? null,
  }));

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
