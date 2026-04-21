import Link from "next/link";
import { format } from "date-fns";
import { TrendingDown, TrendingUp, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadDialog } from "@/components/upload-dialog";
import { createClient } from "@/lib/supabase/server";
import { Sparkline } from "./sparkline";

export const dynamic = "force-dynamic";

type Result = {
  id: number;
  blood_test_id: number;
  marker_name: string;
  value: number | null;
  unit: string | null;
  reference_range_low: number | null;
  reference_range_high: number | null;
  status: string | null;
};

type Test = {
  id: number;
  file_name: string;
  test_date: string | null;
  lab_name: string | null;
  created_at: string;
};

type Point = {
  date: string;
  value: number;
  low: number | null;
  high: number | null;
  status: string | null;
  unit: string | null;
};

function isAbnormal(s: string | null) {
  return s === "high" || s === "low" || s === "critical";
}

function statusBadge(status: string | null) {
  switch (status) {
    case "critical":
      return <Badge variant="destructive">critical</Badge>;
    case "high":
      return <Badge variant="destructive">high</Badge>;
    case "low":
      return <Badge variant="warning">low</Badge>;
    case "normal":
      return <Badge variant="success">normal</Badge>;
    default:
      return <Badge variant="outline">—</Badge>;
  }
}

function severityRank(s: string | null) {
  if (s === "critical") return 0;
  if (s === "high" || s === "low") return 1;
  return 2;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: tests }, { data: results }] = await Promise.all([
    supabase
      .from("blood_tests")
      .select("id, file_name, test_date, lab_name, created_at")
      .order("test_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("blood_test_results")
      .select("id, blood_test_id, marker_name, value, unit, reference_range_low, reference_range_high, status"),
  ]);

  const testsArr = (tests ?? []) as Test[];
  const resultsArr = (results ?? []) as Result[];
  const latestTest = testsArr[0] ?? null;

  const resultsByTest = new Map<number, Result[]>();
  for (const r of resultsArr) {
    const arr = resultsByTest.get(r.blood_test_id) ?? [];
    arr.push(r);
    resultsByTest.set(r.blood_test_id, arr);
  }

  const latestResults = latestTest ? resultsByTest.get(latestTest.id) ?? [] : [];
  const latestAbnormal = latestResults
    .filter((r) => isAbnormal(r.status))
    .sort((a, b) => severityRank(a.status) - severityRank(b.status));

  // Per-marker time series (ascending by test date) — used for trending + sparklines.
  const testDateById = new Map<number, string>();
  for (const t of testsArr) testDateById.set(t.id, t.test_date ?? t.created_at);

  const seriesByMarker = new Map<string, Point[]>();
  for (const r of resultsArr) {
    if (r.value === null) continue;
    const date = testDateById.get(r.blood_test_id);
    if (!date) continue;
    const arr = seriesByMarker.get(r.marker_name) ?? [];
    arr.push({
      date,
      value: r.value,
      low: r.reference_range_low,
      high: r.reference_range_high,
      status: r.status,
      unit: r.unit,
    });
    seriesByMarker.set(r.marker_name, arr);
  }
  for (const arr of seriesByMarker.values()) arr.sort((a, b) => a.date.localeCompare(b.date));

  // Trending the wrong way: currently normal, but moving toward a boundary.
  type Trend = {
    marker: string;
    direction: "up" | "down";
    value: number;
    unit: string | null;
    low: number;
    high: number;
    distance: number;
  };
  const trending: Trend[] = [];
  for (const [marker, arr] of seriesByMarker) {
    if (arr.length < 2) continue;
    const last = arr[arr.length - 1];
    const prev = arr[arr.length - 2];
    if (last.status !== "normal") continue;
    if (last.low === null || last.high === null) continue;
    const range = last.high - last.low;
    if (range <= 0) continue;
    const distLast = Math.min(last.high - last.value, last.value - last.low);
    const distPrev = Math.min(last.high - prev.value, prev.value - last.low);
    if (distLast >= distPrev) continue;
    if (distLast >= range * 0.2) continue;
    trending.push({
      marker,
      direction: last.value > prev.value ? "up" : "down",
      value: last.value,
      unit: last.unit,
      low: last.low,
      high: last.high,
      distance: distLast,
    });
  }
  trending.sort((a, b) => a.distance - b.distance);
  const trendingTop = trending.slice(0, 5);

  // Key markers: most frequent across all tests, limited to ones on the latest test.
  const latestMarkerSet = new Set(latestResults.map((r) => r.marker_name));
  const keyMarkers = [...seriesByMarker.entries()]
    .filter(([m]) => latestMarkerSet.has(m))
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 6)
    .map(([marker, points]) => {
      const latest = points[points.length - 1];
      return { marker, points, latest };
    });

  // Recent tests list
  const recentTests = testsArr.slice(0, 5).map((t) => ({
    ...t,
    markerCount: resultsByTest.get(t.id)?.length ?? 0,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Quick overview of your blood test results.</p>
        </div>
        <UploadDialog>
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload test
          </Button>
        </UploadDialog>
      </div>

      {!latestTest ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No tests yet. Upload a PDF to get started.
          </CardContent>
        </Card>
      ) : (
        <>
          {latestAbnormal.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Needs attention</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {latestAbnormal.slice(0, 5).map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-4 px-6 py-3">
                      <div className="min-w-0">
                        <Link
                          href={`/tests/${latestTest.id}`}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {r.marker_name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {r.reference_range_low !== null || r.reference_range_high !== null
                            ? `Range ${r.reference_range_low ?? "?"}–${r.reference_range_high ?? "?"} ${r.unit ?? ""}`
                            : "No reference range"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-sm">
                          {r.value ?? "—"}
                          {r.unit ? ` ${r.unit}` : ""}
                        </span>
                        {statusBadge(r.status)}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {trendingTop.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Trending toward out-of-range</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {trendingTop.map((t) => (
                    <li key={t.marker} className="flex items-center justify-between gap-4 px-6 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{t.marker}</p>
                        <p className="text-xs text-muted-foreground">
                          Range {t.low}–{t.high} {t.unit ?? ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-sm">
                          {t.value}
                          {t.unit ? ` ${t.unit}` : ""}
                        </span>
                        {t.direction === "up" ? (
                          <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {keyMarkers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Key markers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {keyMarkers.map(({ marker, points, latest }) => (
                    <Link
                      key={marker}
                      href="/markers"
                      className="rounded-lg border p-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium">{marker}</p>
                        {statusBadge(latest.status)}
                      </div>
                      <div className="mt-1 font-mono text-lg">
                        {latest.value}
                        {latest.unit ? <span className="ml-1 text-xs text-muted-foreground">{latest.unit}</span> : null}
                      </div>
                      <div className="mt-2">
                        <Sparkline data={points.map((p) => ({ date: p.date, value: p.value }))} low={latest.low} high={latest.high} />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent tests</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTests.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No tests yet. Upload your first PDF to get started.
            </div>
          ) : (
            <ul className="divide-y">
              {recentTests.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/tests/${t.id}`}
                    className="flex items-center justify-between py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.lab_name ? `${t.lab_name} · ` : ""}
                        {t.test_date ? format(new Date(t.test_date), "MMM d, yyyy") : "Date unknown"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{t.markerCount} markers</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
