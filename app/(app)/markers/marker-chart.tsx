"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";

type Row = {
  test_date: string | null;
  value: number | null;
  unit: string | null;
  reference_range_low: number | null;
  reference_range_high: number | null;
};

export function MarkerChart({ markers }: { markers: string[] }) {
  const [selected, setSelected] = React.useState<string>(markers[0] ?? "");
  const [data, setData] = React.useState<Row[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!selected) return;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("blood_test_results")
      .select("value, unit, reference_range_low, reference_range_high, blood_tests!inner(test_date)")
      .eq("marker_name", selected)
      .order("test_date", { foreignTable: "blood_tests", ascending: true })
      .then(({ data }) => {
        const flat: Row[] = (data ?? []).map((r: {
          value: number | null;
          unit: string | null;
          reference_range_low: number | null;
          reference_range_high: number | null;
          blood_tests: { test_date: string | null } | { test_date: string | null }[] | null;
        }) => {
          const bt = Array.isArray(r.blood_tests) ? r.blood_tests[0] : r.blood_tests;
          return {
            value: r.value,
            unit: r.unit,
            reference_range_low: r.reference_range_low,
            reference_range_high: r.reference_range_high,
            test_date: bt?.test_date ?? null,
          };
        });
        setData(flat);
      })
      .then(() => setLoading(false));
  }, [selected]);

  const chartData = (data ?? [])
    .filter((d) => d.value !== null && d.test_date)
    .map((d) => ({
      date: d.test_date,
      value: d.value,
      label: format(new Date(d.test_date!), "MMM d"),
    }));

  const refLow = data?.find((d) => d.reference_range_low !== null)?.reference_range_low ?? null;
  const refHigh = data?.find((d) => d.reference_range_high !== null)?.reference_range_high ?? null;
  const unit = data?.find((d) => d.unit)?.unit ?? "";

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger>
            <SelectValue placeholder="Pick a marker" />
          </SelectTrigger>
          <SelectContent>
            {markers.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-72 w-full" />
      ) : chartData.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
          No numeric data for this marker.
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              {refLow !== null && refHigh !== null && (
                <ReferenceArea y1={refLow} y2={refHigh} fill="hsl(var(--primary))" fillOpacity={0.08} />
              )}
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                }}
                formatter={(value: number) => [`${value} ${unit}`, selected]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 4, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
