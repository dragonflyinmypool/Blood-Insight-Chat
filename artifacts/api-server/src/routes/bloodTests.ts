import { Router, type IRouter } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { db, bloodTestsTable, bloodTestResultsTable } from "@workspace/db";
import {
  UploadBloodTestBody,
  GetBloodTestParams,
  DeleteBloodTestParams,
  ListMarkerHistoryQueryParams,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import pdfParse from "pdf-parse";

const router: IRouter = Router();

async function extractBloodTestData(pdfBase64: string, fileName: string) {
  const buffer = Buffer.from(pdfBase64, "base64");
  let pdfText = "";
  try {
    const parsed = await pdfParse(buffer);
    pdfText = parsed.text;
  } catch {
    pdfText = "";
  }

  const prompt = `You are a medical data extraction assistant. Extract blood test results from this lab report text.

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
- Extract ALL lab markers/biomarkers you can find
- If a value is not numeric, set value to null
- If reference range is not given, set referenceRangeLow and referenceRangeHigh to null
- Determine status: normal if within range, high if above, low if below, critical if significantly out of range
- Return ONLY valid JSON, no other text`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const data = JSON.parse(content);
  return data;
}

router.get("/blood-tests", async (_req, res): Promise<void> => {
  const tests = await db
    .select({
      id: bloodTestsTable.id,
      fileName: bloodTestsTable.fileName,
      testDate: bloodTestsTable.testDate,
      labName: bloodTestsTable.labName,
      patientName: bloodTestsTable.patientName,
      notes: bloodTestsTable.notes,
      createdAt: bloodTestsTable.createdAt,
      resultCount: sql<number>`(SELECT COUNT(*) FROM blood_test_results WHERE blood_test_id = ${bloodTestsTable.id})::int`,
    })
    .from(bloodTestsTable)
    .orderBy(desc(bloodTestsTable.createdAt));

  res.json(tests);
});

router.post("/blood-tests", async (req, res): Promise<void> => {
  const parsed = UploadBloodTestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { fileName, pdfBase64, notes } = parsed.data;

  let extracted: {
    testDate?: string | null;
    labName?: string | null;
    patientName?: string | null;
    results?: Array<{
      markerName: string;
      value?: number | null;
      unit?: string | null;
      referenceRangeLow?: number | null;
      referenceRangeHigh?: number | null;
      status?: string | null;
      rawText?: string | null;
    }>;
  } = {};

  try {
    extracted = await extractBloodTestData(pdfBase64, fileName);
  } catch {
    extracted = { results: [] };
  }

  const [bloodTest] = await db
    .insert(bloodTestsTable)
    .values({
      fileName,
      testDate: extracted.testDate ?? null,
      labName: extracted.labName ?? null,
      patientName: extracted.patientName ?? null,
      notes: notes ?? null,
    })
    .returning();

  const results = extracted.results ?? [];
  if (results.length > 0) {
    await db.insert(bloodTestResultsTable).values(
      results.map((r) => ({
        bloodTestId: bloodTest.id,
        markerName: r.markerName,
        value: r.value ?? null,
        unit: r.unit ?? null,
        referenceRangeLow: r.referenceRangeLow ?? null,
        referenceRangeHigh: r.referenceRangeHigh ?? null,
        status: r.status ?? null,
        rawText: r.rawText ?? null,
      }))
    );
  }

  const testResults = await db
    .select()
    .from(bloodTestResultsTable)
    .where(eq(bloodTestResultsTable.bloodTestId, bloodTest.id));

  res.status(201).json({ ...bloodTest, results: testResults });
});

router.get("/blood-tests/summary", async (_req, res): Promise<void> => {
  const [totals] = await db
    .select({
      totalTests: sql<number>`COUNT(DISTINCT ${bloodTestsTable.id})::int`,
      totalMarkers: sql<number>`COUNT(${bloodTestResultsTable.id})::int`,
      abnormalCount: sql<number>`COUNT(CASE WHEN ${bloodTestResultsTable.status} IN ('high', 'low', 'critical') THEN 1 END)::int`,
    })
    .from(bloodTestsTable)
    .leftJoin(bloodTestResultsTable, eq(bloodTestResultsTable.bloodTestId, bloodTestsTable.id));

  const latestTest = await db
    .select({ testDate: bloodTestsTable.testDate })
    .from(bloodTestsTable)
    .orderBy(desc(bloodTestsTable.createdAt))
    .limit(1);

  const commonMarkersRows = await db
    .select({ markerName: bloodTestResultsTable.markerName })
    .from(bloodTestResultsTable)
    .groupBy(bloodTestResultsTable.markerName)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(10);

  res.json({
    totalTests: totals?.totalTests ?? 0,
    totalMarkers: totals?.totalMarkers ?? 0,
    abnormalCount: totals?.abnormalCount ?? 0,
    latestTestDate: latestTest[0]?.testDate ?? null,
    commonMarkers: commonMarkersRows.map((r) => r.markerName),
  });
});

router.get("/blood-tests/markers", async (req, res): Promise<void> => {
  const params = ListMarkerHistoryQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let query = db
    .select({
      markerName: bloodTestResultsTable.markerName,
      testDate: bloodTestsTable.testDate,
      value: bloodTestResultsTable.value,
      unit: bloodTestResultsTable.unit,
      status: bloodTestResultsTable.status,
      referenceRangeLow: bloodTestResultsTable.referenceRangeLow,
      referenceRangeHigh: bloodTestResultsTable.referenceRangeHigh,
      bloodTestId: bloodTestResultsTable.bloodTestId,
    })
    .from(bloodTestResultsTable)
    .innerJoin(bloodTestsTable, eq(bloodTestsTable.id, bloodTestResultsTable.bloodTestId))
    .orderBy(bloodTestsTable.testDate);

  if (params.data.markerName) {
    const results = await db
      .select({
        markerName: bloodTestResultsTable.markerName,
        testDate: bloodTestsTable.testDate,
        value: bloodTestResultsTable.value,
        unit: bloodTestResultsTable.unit,
        status: bloodTestResultsTable.status,
        referenceRangeLow: bloodTestResultsTable.referenceRangeLow,
        referenceRangeHigh: bloodTestResultsTable.referenceRangeHigh,
        bloodTestId: bloodTestResultsTable.bloodTestId,
      })
      .from(bloodTestResultsTable)
      .innerJoin(bloodTestsTable, eq(bloodTestsTable.id, bloodTestResultsTable.bloodTestId))
      .where(eq(bloodTestResultsTable.markerName, params.data.markerName))
      .orderBy(bloodTestsTable.testDate);
    res.json(results);
    return;
  }

  const results = await query;
  res.json(results);
});

router.get("/blood-tests/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetBloodTestParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [test] = await db
    .select()
    .from(bloodTestsTable)
    .where(eq(bloodTestsTable.id, params.data.id));

  if (!test) {
    res.status(404).json({ error: "Blood test not found" });
    return;
  }

  const results = await db
    .select()
    .from(bloodTestResultsTable)
    .where(eq(bloodTestResultsTable.bloodTestId, params.data.id));

  res.json({ ...test, results });
});

router.delete("/blood-tests/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteBloodTestParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(bloodTestsTable)
    .where(eq(bloodTestsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Blood test not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
