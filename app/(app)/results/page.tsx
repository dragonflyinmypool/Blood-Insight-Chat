import { format } from "date-fns";
import { Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UploadDialog } from "@/components/upload-dialog";
import { createClient } from "@/lib/supabase/server";
import { categoryMeta, type Category } from "@/lib/markers/categories";

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
  test_date: string | null;
  created_at: string;
};

type Latest = Result & {
  test_date: string | null;
  readings: number;
};

function isAbnormal(status: string | null): boolean {
  return status === "high" || status === "low" || status === "critical";
}

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

export default async function ResultsPage() {
  const supabase = await createClient();

  const [resultsRes, testsRes] = await Promise.all([
    supabase
      .from("blood_test_results")
      .select(
        "id, marker_name, value, unit, reference_range_low, reference_range_high, status, category, blood_test_id"
      ),
    supabase.from("blood_tests").select("id, test_date, created_at"),
  ]);

  const results = (resultsRes.data ?? []) as Result[];
  const tests = (testsRes.data ?? []) as Test[];

  const testById = new Map(tests.map((t) => [t.id, t]));

  // Collapse to latest reading per marker (case-insensitive match on name).
  const byMarker = new Map<string, Latest>();
  const countByMarker = new Map<string, number>();

  for (const r of results) {
    const key = r.marker_name.trim().toLowerCase();
    countByMarker.set(key, (countByMarker.get(key) ?? 0) + 1);

    const test = testById.get(r.blood_test_id);
    const sortKey = test?.test_date ?? test?.created_at ?? "";
    const prev = byMarker.get(key);
    const prevTest = prev ? testById.get(prev.blood_test_id) : undefined;
    const prevSortKey = prevTest?.test_date ?? prevTest?.created_at ?? "";

    if (!prev || sortKey > prevSortKey) {
      byMarker.set(key, { ...r, test_date: test?.test_date ?? null, readings: 0 });
    }
  }

  const latest = [...byMarker.entries()].map(([key, m]) => ({
    ...m,
    readings: countByMarker.get(key) ?? 1,
  }));

  const totalAbnormal = latest.filter((m) => isAbnormal(m.status)).length;

  if (latest.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
          <p className="text-sm text-muted-foreground">
            Explore every marker across all your tests, grouped by category.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              Upload your first blood test to start tracking markers here.
            </p>
            <UploadDialog>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload test
              </Button>
            </UploadDialog>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group latest-per-marker by category.
  const byCategory = new Map<Category, Latest[]>();
  for (const m of latest) {
    const { resolved } = categoryMeta(m.category ?? "Other");
    if (!byCategory.has(resolved)) byCategory.set(resolved, []);
    byCategory.get(resolved)!.push(m);
  }
  const groups = [...byCategory.entries()].sort(
    ([a], [b]) => categoryMeta(a).order - categoryMeta(b).order
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
          <p className="text-sm text-muted-foreground">
            Latest value for every marker across all your tests, grouped by category.
          </p>
        </div>
        <UploadDialog>
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Upload test
          </Button>
        </UploadDialog>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-baseline gap-x-6 gap-y-2 py-4 text-sm">
          <span>
            <span className="font-semibold">{latest.length}</span> markers tracked
          </span>
          <span>
            <span className="font-semibold">{groups.length}</span>{" "}
            {groups.length === 1 ? "category" : "categories"}
          </span>
          <span className={totalAbnormal > 0 ? "text-destructive" : "text-muted-foreground"}>
            <span className="font-semibold">{totalAbnormal}</span> currently abnormal
          </span>
        </CardContent>
      </Card>

      {groups.map(([cat, catMarkers]) => {
        const meta = categoryMeta(cat);
        const abnormal = catMarkers.filter((m) => isAbnormal(m.status)).length;
        // Abnormal first, then alphabetical, so issues surface at the top.
        const sorted = [...catMarkers].sort((a, b) => {
          const ra = isAbnormal(a.status) ? 0 : 1;
          const rb = isAbnormal(b.status) ? 0 : 1;
          if (ra !== rb) return ra - rb;
          return a.marker_name.localeCompare(b.marker_name);
        });
        return (
          <Card key={cat}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle>{meta.resolved}</CardTitle>
                  <CardDescription>{meta.description}</CardDescription>
                </div>
                {abnormal > 0 ? (
                  <Badge variant="destructive" className="shrink-0">
                    {abnormal} of {catMarkers.length} abnormal
                  </Badge>
                ) : (
                  <Badge variant="success" className="shrink-0">
                    All {catMarkers.length} normal
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marker</TableHead>
                    <TableHead className="text-right">Latest value</TableHead>
                    <TableHead>Reference range</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Measured</TableHead>
                    <TableHead className="text-right">Readings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.marker_name}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {m.value ?? "—"} {m.unit ?? ""}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.reference_range_low !== null || m.reference_range_high !== null
                          ? `${m.reference_range_low ?? "?"} – ${m.reference_range_high ?? "?"}`
                          : "—"}
                      </TableCell>
                      <TableCell>{statusBadge(m.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.test_date ? format(new Date(m.test_date), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">{m.readings}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
