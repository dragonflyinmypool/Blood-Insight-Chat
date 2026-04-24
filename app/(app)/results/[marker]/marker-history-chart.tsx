"use client";

import { format } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = {
  id: number;
  date: string;
  value: number;
  unit: string | null;
  status: string | null;
};

function statusColor(status: string | null): string {
  switch (status) {
    case "critical":
    case "high":
      return "hsl(var(--destructive))";
    case "low":
      return "#d97706"; // amber-600 — matches the warning badge family
    case "normal":
      return "#16a34a"; // green-600
    default:
      return "hsl(var(--muted-foreground))";
  }
}

export function MarkerHistoryChart({
  points,
  refLow,
  refHigh,
  unit,
}: {
  points: Point[];
  refLow: number | null;
  refHigh: number | null;
  unit: string | null;
}) {
  const data = points.map((p) => ({ ...p, ts: new Date(p.date).getTime() }));

  const values = data.map((d) => d.value);
  const lo = Math.min(...values, refLow ?? Infinity);
  const hi = Math.max(...values, refHigh ?? -Infinity);
  const span = hi - lo || Math.abs(hi) || 1;
  const yMin = lo - span * 0.15;
  const yMax = hi + span * 0.15;

  const bandLow = refLow ?? yMin;
  const bandHigh = refHigh ?? yMax;
  const hasBand = refLow !== null || refHigh !== null;

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="ts"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={(ts) => format(new Date(ts), "MMM yyyy")}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />
          <YAxis
            domain={[yMin, yMax]}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            width={48}
          />
          {hasBand && (
            <ReferenceArea
              y1={bandLow}
              y2={bandHigh}
              fill="#16a34a"
              fillOpacity={0.1}
              stroke="#16a34a"
              strokeOpacity={0.3}
              strokeDasharray="3 3"
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              color: "hsl(var(--popover-foreground))",
              fontSize: 12,
            }}
            labelFormatter={(ts) => format(new Date(ts as number), "MMM d, yyyy")}
            formatter={(value: number, _name, item) => {
              const status = (item?.payload as Point | undefined)?.status;
              return [
                `${value}${unit ? ` ${unit}` : ""}${status ? ` · ${status}` : ""}`,
                "Value",
              ];
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--foreground))"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload, index } = props as {
                cx: number;
                cy: number;
                payload: Point;
                index: number;
              };
              return (
                <circle
                  key={payload.id ?? index}
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill={statusColor(payload.status)}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
