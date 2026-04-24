import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { categoryMeta } from "@/lib/markers/categories";
import { MarkerHistoryChart } from "./marker-history-chart";
import { PdfLink } from "./pdf-link";

export const dynamic = "force-dynamic";

type Result = {
  id: number;
  marker_name: string;
  value: number | null;
  unit: string | null;
  reference_range_low: number | null;
  reference_range_high: number | null;
  status: string | null;
  category: string | null;
  blood_test_id: number;
};

type Test = {
  id: number;
  file_name: string;
  test_date: string | null;
  lab_name: string | null;
  content_hash: string | null;
  created_at: string;
};

function statusBadge(status: string | null) {
  switch (status) {
    case "high":
    case "critical":
      return <Badge variant="destructive">{status}</Badge>;
    case "low":
      return <Badge variant="warning">low</Badge>;
    case "normal":
      return <Badge variant="success">normal</Badge>;
    default:
      return <Badge variant="outline">—</Badge>;
  }
}

export default async function MarkerDetailPage({
  params,
}: {
  params: Promise<{ marker: string }>;
}) {
  const { marker: markerParam } = await params;
  const markerSlug = decodeURIComponent(markerParam).trim().toLowerCase();

  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  if (!user) notFound();

  const { data: resultsData } = await supabase
    .from("blood_test_results")
    .select(
      "id, marker_name, value, unit, reference_range_low, reference_range_high, status, category, blood_test_id"
    );

  const allResults = (resultsData ?? []) as Result[];
  const rows = allResults.filter(
    (r) => r.marker_name.trim().toLowerCase() === markerSlug
  );

  if (rows.length === 0) notFound();

  const testIds = [...new Set(rows.map((r) => r.blood_test_id))];
  const { data: testsData } = await supabase
    .from("blood_tests")
    .select("id, file_name, test_date, lab_name, content_hash, created_at")
    .in("id", testIds);

  const testById = new Map(((testsData ?? []) as Test[]).map((t) => [t.id, t]));

  // Sort newest-first for the readings table and header; chart wants oldest-first.
  const byDateDesc = [...rows].sort((a, b) => {
    const ta = testById.get(a.blood_test_id);
    const tb = testById.get(b.blood_test_id);
    const ka = ta?.test_date ?? ta?.created_at ?? "";
    const kb = tb?.test_date ?? tb?.created_at ?? "";
    return kb.localeCompare(ka);
  });

  const latest = byDateDesc[0];
  const latestUnit = latest.unit;

  // Display name: use the most recent row's marker_name so casing matches what
  // the extractor saw on the latest PDF.
  const displayName = latest.marker_name;
  const category = latest.category ?? "Other";
  const categoryResolved = categoryMeta(category).resolved;

  // Chart: only readings whose unit matches the latest reading (case-insensitive,
  // since older rows may predate the unit canonicalizer and still say "mg/dl"
  // while newer ones say "mg/dL"). Everything else stays in the table.
  const unitKey = (u: string | null) => (u ?? "").trim().toLowerCase();
  const latestUnitKey = unitKey(latestUnit);
  const chartPoints = [...rows]
    .map((r) => {
      const t = testById.get(r.blood_test_id);
      const date = t?.test_date ?? t?.created_at ?? null;
      return {
        id: r.id,
        date,
        value: r.value,
        unit: r.unit,
        status: r.status,
      };
    })
    .filter(
      (p): p is { id: number; date: string; value: number; unit: string | null; status: string | null } =>
        p.date !== null && p.value !== null && unitKey(p.unit) === latestUnitKey
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const hiddenFromChart = rows.length - chartPoints.length;

  const refLow = latest.reference_range_low;
  const refHigh = latest.reference_range_high;
  const hasRange = refLow !== null || refHigh !== null;

  const rangeLabel = hasRange
    ? `${refLow ?? "?"} – ${refHigh ?? "?"}${latestUnit ? ` ${latestUnit}` : ""}`
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href="/results">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to results
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
          <Badge variant="outline" className="shrink-0">
            {categoryResolved}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {chartPoints.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No numeric readings to chart.
            </p>
          ) : (
            <>
              <MarkerHistoryChart
                points={chartPoints}
                refLow={refLow}
                refHigh={refHigh}
                unit={latestUnit}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>
                  {rangeLabel ? (
                    <>
                      Healthy range: <span className="font-medium text-foreground">{rangeLabel}</span>
                    </>
                  ) : (
                    "No reference range available for this marker."
                  )}
                </span>
                {hiddenFromChart > 0 && (
                  <span>
                    {hiddenFromChart} reading{hiddenFromChart === 1 ? "" : "s"} hidden
                    (different unit)
                  </span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Readings ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Reference range</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byDateDesc.map((r) => {
                const test = testById.get(r.blood_test_id);
                const date = test?.test_date ?? test?.created_at ?? null;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      {date ? format(new Date(date), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {r.value ?? "—"} {r.unit ?? ""}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.reference_range_low !== null || r.reference_range_high !== null
                        ? `${r.reference_range_low ?? "?"} – ${r.reference_range_high ?? "?"}`
                        : "—"}
                    </TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell>
                      <PdfLink
                        userId={user.id}
                        contentHash={test?.content_hash ?? null}
                        fileName={test?.file_name ?? "test.pdf"}
                        testId={r.blood_test_id}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
