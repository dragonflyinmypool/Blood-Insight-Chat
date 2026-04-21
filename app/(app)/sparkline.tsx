"use client";

import { Line, LineChart, ReferenceArea, ResponsiveContainer, YAxis } from "recharts";

type Point = { date: string; value: number };

export function Sparkline({
  data,
  low,
  high,
}: {
  data: Point[];
  low: number | null;
  high: number | null;
}) {
  if (data.length === 0) return null;

  const values = data.map((d) => d.value);
  const dataMin = Math.min(...values, low ?? Infinity);
  const dataMax = Math.max(...values, high ?? -Infinity);
  const pad = (dataMax - dataMin) * 0.1 || 1;
  const domain: [number, number] = [dataMin - pad, dataMax + pad];

  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={domain} />
          {low !== null && high !== null && (
            <ReferenceArea y1={low} y2={high} fill="hsl(var(--primary))" fillOpacity={0.08} />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
