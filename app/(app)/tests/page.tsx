import Link from "next/link";
import { format } from "date-fns";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UploadDialog } from "@/components/upload-dialog";
import { TestRowActions } from "./row-actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TestsPage() {
  const supabase = await createClient();

  const { data: tests } = await supabase
    .from("blood_tests")
    .select("id, file_name, test_date, lab_name, patient_name, created_at")
    .order("created_at", { ascending: false });

  const withCounts = await Promise.all(
    (tests ?? []).map(async (t) => {
      const { count } = await supabase
        .from("blood_test_results")
        .select("id", { count: "exact", head: true })
        .eq("blood_test_id", t.id);
      return { ...t, resultCount: count ?? 0 };
    })
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Blood tests</h1>
          <p className="text-sm text-muted-foreground">All uploaded tests, newest first.</p>
        </div>
        <UploadDialog>
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload test
          </Button>
        </UploadDialog>
      </div>

      <Card>
        {withCounts.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No tests yet. Upload a PDF to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Test date</TableHead>
                <TableHead>Lab</TableHead>
                <TableHead className="text-right">Markers</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {withCounts.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link href={`/tests/${t.id}`} className="font-medium hover:underline">
                      {t.file_name}
                    </Link>
                    {t.patient_name && <div className="text-xs text-muted-foreground">{t.patient_name}</div>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.test_date ? format(new Date(t.test_date), "MMM d, yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{t.lab_name ?? "—"}</TableCell>
                  <TableCell className="text-right text-sm">{t.resultCount}</TableCell>
                  <TableCell className="text-right">
                    <TestRowActions id={t.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
