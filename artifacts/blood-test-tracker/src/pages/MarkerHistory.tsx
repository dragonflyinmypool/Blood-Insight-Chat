import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import { Activity, Search, FlaskConical, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useListMarkerHistory, getListMarkerHistoryQueryKey, useGetBloodTestSummary } from "@workspace/api-client-react";

export default function MarkerHistory() {
  const [search, setSearch] = useState("");
  const { data: summary } = useGetBloodTestSummary();
  
  // Parse URL params
  const urlParams = new URLSearchParams(window.location.search);
  const selectedMarkerUrl = urlParams.get('name');
  
  const [selectedMarker, setSelectedMarker] = useState<string | null>(selectedMarkerUrl);

  const { data: history, isLoading } = useListMarkerHistory(
    { markerName: selectedMarker || undefined },
    { query: { enabled: !!selectedMarker, queryKey: getListMarkerHistoryQueryKey({ markerName: selectedMarker || undefined }) } }
  );

  // Filter common markers based on search
  const filteredMarkers = summary?.commonMarkers?.filter(m => 
    m.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleSelectMarker = (marker: string) => {
    setSelectedMarker(marker);
    window.history.replaceState(null, '', `?name=${encodeURIComponent(marker)}`);
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return [];
    
    // Sort chronologically
    return [...history]
      .sort((a, b) => new Date(a.testDate || "").getTime() - new Date(b.testDate || "").getTime())
      .filter(item => item.value !== null)
      .map(item => ({
        ...item,
        dateFormatted: item.testDate ? format(new Date(item.testDate), 'MMM yyyy') : 'Unknown',
        timestamp: new Date(item.testDate || "").getTime()
      }));
  }, [history]);

  // Find overall reference ranges to shade background
  const refRanges = useMemo(() => {
    if (chartData.length === 0) return null;
    // Take the most recent test's reference ranges
    const latest = chartData[chartData.length - 1];
    if (latest.referenceRangeLow !== null && latest.referenceRangeHigh !== null) {
      return { low: latest.referenceRangeLow, high: latest.referenceRangeHigh };
    }
    return null;
  }, [chartData]);

  // Calculate stats
  const stats = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].value as number;
    const last = chartData[chartData.length - 1].value as number;
    const diff = last - first;
    const percentChange = (diff / first) * 100;
    return {
      latest: last,
      trend: percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'flat',
      change: Math.abs(percentChange).toFixed(1) + '%'
    };
  }, [chartData]);

  return (
    <>
      <Header title="Marker History" />

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar for marker selection */}
        <div className="w-72 border-r bg-muted/10 flex flex-col h-full overflow-hidden hidden md:flex shrink-0">
          <div className="p-4 border-b bg-background">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search markers..." 
                className="pl-9 bg-muted/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {filteredMarkers.map((marker) => (
              <button
                key={marker}
                onClick={() => handleSelectMarker(marker)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium mb-1 transition-colors ${
                  selectedMarker === marker 
                    ? "bg-primary/10 text-primary" 
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {marker}
              </button>
            ))}
            {filteredMarkers.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No markers found
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Mobile Marker Selector */}
          <div className="md:hidden mb-6">
            <label className="text-sm font-medium mb-2 block">Select Biomarker</label>
            <select 
              className="w-full h-10 px-3 rounded-md border bg-background"
              value={selectedMarker || ""}
              onChange={(e) => handleSelectMarker(e.target.value)}
            >
              <option value="" disabled>Select a marker...</option>
              {summary?.commonMarkers.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {!selectedMarker ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto opacity-50 mt-20">
              <Activity className="h-16 w-16 mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Select a biomarker</h2>
              <p className="text-muted-foreground">Choose a marker from the list to see its historical trends across all your uploaded blood tests.</p>
            </div>
          ) : isLoading ? (
            <div className="space-y-6">
              <div className="h-32 rounded-xl bg-muted animate-pulse" />
              <div className="h-[400px] rounded-xl bg-muted animate-pulse" />
            </div>
          ) : chartData.length > 0 ? (
            <div className="space-y-6 max-w-5xl mx-auto">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-3xl font-bold tracking-tight text-foreground">{selectedMarker}</h2>
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                    {chartData[0].unit}
                  </Badge>
                </div>
                <p className="text-muted-foreground">Historical data across {chartData.length} tests</p>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="py-4 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Latest Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">{stats?.latest}</span>
                      <span className="text-sm font-medium text-muted-foreground">{chartData[0].unit}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-4 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Reference Range</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">
                        {refRanges ? `${refRanges.low} - ${refRanges.high}` : "N/A"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-4 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Historical Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats ? (
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center text-xl font-bold ${
                          stats.trend === 'up' ? 'text-red-500' : stats.trend === 'down' ? 'text-emerald-500' : 'text-muted-foreground'
                        }`}>
                          <TrendingUp className={`mr-1 h-5 w-5 ${stats.trend === 'down' ? 'rotate-180' : ''}`} />
                          {stats.change}
                        </span>
                        <span className="text-xs text-muted-foreground">vs first test</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not enough data</span>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Main Chart */}
              <Card className="pt-6">
                <CardContent>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis 
                          dataKey="dateFormatted" 
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                          dy={10}
                        />
                        <YAxis 
                          domain={['auto', 'auto']} 
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                          dx={-10}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            boxShadow: 'var(--shadow-md)'
                          }}
                          labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
                          formatter={(value: number) => [`${value} ${chartData[0]?.unit || ''}`, 'Value']}
                        />
                        
                        {refRanges && (
                          <ReferenceArea 
                            y1={refRanges.low} 
                            y2={refRanges.high} 
                            fill="hsl(var(--emerald-500) / 0.1)" 
                            fillOpacity={1} 
                            strokeOpacity={0}
                          />
                        )}
                        
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={3}
                          dot={{ r: 5, fill: "hsl(var(--background))", stroke: "hsl(var(--primary))", strokeWidth: 2 }}
                          activeDot={{ r: 7, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Data Table */}
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/40 text-muted-foreground uppercase text-xs font-medium">
                      <tr>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Result</th>
                        <th className="px-6 py-3">Reference</th>
                        <th className="px-6 py-3">Source Test</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[...chartData].reverse().map((item) => (
                        <tr key={item.bloodTestId} className="hover:bg-muted/30">
                          <td className="px-6 py-4 font-medium text-foreground">
                            {item.testDate ? format(new Date(item.testDate), 'MMM d, yyyy') : 'Unknown'}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold">{item.value}</span> <span className="text-muted-foreground text-xs">{item.unit}</span>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {item.referenceRangeLow !== null && item.referenceRangeHigh !== null 
                              ? `${item.referenceRangeLow} - ${item.referenceRangeHigh}`
                              : '-'}
                          </td>
                          <td className="px-6 py-4 text-primary font-medium">
                            <a href={`/tests/${item.bloodTestId}`} className="hover:underline flex items-center gap-1">
                              View Report <FlaskConical className="h-3 w-3" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

            </div>
          ) : (
            <div className="text-center py-20 bg-card border rounded-xl max-w-3xl mx-auto">
              <FlaskConical className="mx-auto h-12 w-12 text-muted-foreground opacity-30 mb-4" />
              <h3 className="text-xl font-semibold">No data found</h3>
              <p className="text-muted-foreground mt-2">We couldn't find historical data for {selectedMarker}.</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
