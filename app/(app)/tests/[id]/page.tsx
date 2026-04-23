import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StartChatButton } from "./start-chat";
import { createClient } from "@/lib/supabase/server";
import { categoryMeta, type Category } from "@/lib/markers/categories";

export const dynamic = "force-dynamic";

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

export default async function TestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (Number.isNaN(id)) notFound();

  const supabase = await createClient();

  const { data: test } = await supabase.from("blood_tests").select("*").eq("id", id).maybeSingle();
  if (!test) notFound();

  const { data: results } = await supabase
    .from("blood_test_results")
    .select("*")
    .eq("blood_test_id", id)
    .order("marker_name");

  const rows = results ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/tests"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to tests
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{test.file_name}</h1>
            <p className="text-sm text-muted-foreground">
              {test.lab_name ? `${test.lab_name} · ` : ""}
              {test.test_date ? format(new Date(test.test_date), "MMMM d, yyyy") : "Date unknown"}
            </p>
          </div>
          <StartChatButton bloodTestId={test.id} testDate={test.test_date}>
            <Button variant="outline">
              <MessageCircle className="mr-2 h-4 w-4" />
              Ask AI about this test
            </Button>
          </StartChatButton>
        </div>
      </div>

      {test.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{test.notes}</CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No markers were extracted.
          </CardContent>
        </Card>
      ) : (
        <>
          <ResultsOverview rows={rows} />
          {groupByCategory(rows).map(([cat, catRows]) => {
            const meta = categoryMeta(cat);
            const abnormal = catRows.filter((r) => isAbnormal(r.status)).length;
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
                        {abnormal} of {catRows.length} abnormal
                      </Badge>
                    ) : (
                      <Badge variant="success" className="shrink-0">
                        All {catRows.length} normal
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Marker</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead>Reference range</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {catRows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.marker_name}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {r.value ?? "—"} {r.unit ?? ""}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {r.reference_range_low !== null || r.reference_range_high !== null
                              ? `${r.reference_range_low ?? "?"} – ${r.reference_range_high ?? "?"}`
                              : "—"}
                          </TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}

type ResultRow = {
  id: number;
  marker_name: string;
  value: number | null;
  unit: string | null;
  reference_range_low: number | null;
  reference_range_high: number | null;
  status: string | null;
  category: string | null;
};

function isAbnormal(status: string | null): boolean {
  return status === "high" || status === "low" || status === "critical";
}

function groupByCategory(rows: ResultRow[]): [Category, ResultRow[]][] {
  const groups = new Map<Category, ResultRow[]>();
  for (const r of rows) {
    const { resolved } = categoryMeta(r.category ?? "Other");
    if (!groups.has(resolved)) groups.set(resolved, []);
    groups.get(resolved)!.push(r);
  }
  return [...groups.entries()].sort(
    ([a], [b]) => categoryMeta(a).order - categoryMeta(b).order
  );
}

function ResultsOverview({ rows }: { rows: ResultRow[] }) {
  const total = rows.length;
  const abnormal = rows.filter((r) => isAbnormal(r.status)).length;
  const categoriesPresent = new Set(rows.map((r) => categoryMeta(r.category ?? "Other").resolved)).size;
  return (
    <Card>
      <CardContent className="flex flex-wrap items-baseline gap-x-6 gap-y-2 py-4 text-sm">
        <span>
          <span className="font-semibold">{total}</span> markers
        </span>
        <span>
          <span className="font-semibold">{categoriesPresent}</span>{" "}
          {categoriesPresent === 1 ? "category" : "categories"}
        </span>
        <span className={abnormal > 0 ? "text-destructive" : "text-muted-foreground"}>
          <span className="font-semibold">{abnormal}</span> abnormal
        </span>
      </CardContent>
    </Card>
  );
}
