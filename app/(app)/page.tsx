import Link from "next/link";
import { format } from "date-fns";
import { Activity, AlertTriangle, Calendar, FlaskConical, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "@/components/upload-dialog";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: summaryRows }, { data: recent }] = await Promise.all([
    supabase.rpc("blood_test_summary"),
    supabase
      .from("blood_tests")
      .select("id, file_name, test_date, lab_name, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const summary = summaryRows?.[0] ?? {
    total_tests: 0,
    total_markers: 0,
    abnormal_count: 0,
    latest_test_date: null,
  };

  // marker counts per test for the recent list
  const recentWithCounts = await Promise.all(
    (recent ?? []).map(async (t) => {
      const { count } = await supabase
        .from("blood_test_results")
        .select("id", { count: "exact", head: true })
        .eq("blood_test_id", t.id);
      return { ...t, resultCount: count ?? 0 };
    })
  );

  const stats = [
    { label: "Total tests", value: summary.total_tests, icon: FlaskConical },
    { label: "Markers tracked", value: summary.total_markers, icon: Activity },
    { label: "Abnormal results", value: summary.abnormal_count, icon: AlertTriangle },
    {
      label: "Latest test",
      value: summary.latest_test_date ? format(new Date(summary.latest_test_date), "MMM d, yyyy") : "—",
      icon: Calendar,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your blood test history at a glance.</p>
        </div>
        <UploadDialog>
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload test
          </Button>
        </UploadDialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent tests</CardTitle>
        </CardHeader>
        <CardContent>
          {recentWithCounts.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No tests yet. Upload your first PDF to get started.
            </div>
          ) : (
            <ul className="divide-y">
              {recentWithCounts.map((t) => (
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
                    <span className="text-xs text-muted-foreground">{t.resultCount} markers</span>
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
