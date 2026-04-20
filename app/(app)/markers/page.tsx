import { MarkerChart } from "./marker-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MarkersPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("marker_list");
  const markers = (data ?? []).map((r) => r.marker_name);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Marker history</h1>
        <p className="text-sm text-muted-foreground">Track how a biomarker changes across your tests.</p>
      </div>

      {markers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Upload a test first to see marker history.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Select a marker</CardTitle>
          </CardHeader>
          <CardContent>
            <MarkerChart markers={markers} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
