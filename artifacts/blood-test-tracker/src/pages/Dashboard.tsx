import { Link } from "wouter";
import { format } from "date-fns";
import { FileText, Upload, Plus, MessageSquare, AlertTriangle, CheckCircle2, TrendingUp, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/layout/Header";
import { UploadTestDialog } from "@/components/UploadTestDialog";
import { useListBloodTests, useGetBloodTestSummary } from "@workspace/api-client-react";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetBloodTestSummary();
  const { data: recentTests, isLoading: isLoadingTests } = useListBloodTests();

  const sortedTests = recentTests?.sort((a, b) => 
    new Date(b.testDate || b.createdAt).getTime() - new Date(a.testDate || a.createdAt).getTime()
  ).slice(0, 3);

  return (
    <>
      <Header title="Dashboard">
        <UploadTestDialog>
          <Button className="gap-2">
            <Upload className="h-4 w-4" />
            Upload PDF
          </Button>
        </UploadTestDialog>
      </Header>

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-8">
          
          {/* Welcome & Quick Actions */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h2>
              <p className="text-muted-foreground">Here is an overview of your recent health data.</p>
            </div>
            <Link href="/chat">
              <Button variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5 text-primary">
                <MessageSquare className="h-4 w-4" />
                Ask AI about results
              </Button>
            </Link>
          </div>

          {/* Stats Row */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Tests</CardTitle>
                <FileText className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoadingSummary ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-3xl font-bold text-foreground">{summary?.totalTests || 0}</div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {summary?.latestTestDate ? `Latest: ${format(new Date(summary.latestTestDate), 'MMM d, yyyy')}` : "No tests uploaded"}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Markers Tracked</CardTitle>
                <Activity className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoadingSummary ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-3xl font-bold text-foreground">{summary?.totalMarkers || 0}</div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Across all uploaded reports
                </p>
              </CardContent>
            </Card>

            <Card className="bg-destructive/5 border-destructive/10">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-destructive">Needs Attention</CardTitle>
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </CardHeader>
              <CardContent>
                {isLoadingSummary ? (
                  <Skeleton className="h-8 w-16 bg-destructive/10" />
                ) : (
                  <div className="text-3xl font-bold text-destructive">{summary?.abnormalCount || 0}</div>
                )}
                <p className="text-xs text-destructive/80 mt-1">
                  Markers outside optimal ranges
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-7">
            {/* Recent Tests */}
            <Card className="md:col-span-4">
              <CardHeader>
                <CardTitle>Recent Blood Tests</CardTitle>
                <CardDescription>Your latest uploaded laboratory results.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTests ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : sortedTests && sortedTests.length > 0 ? (
                  <div className="space-y-4">
                    {sortedTests.map((test) => (
                      <Link key={test.id} href={`/tests/${test.id}`}>
                        <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer group">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{test.fileName}</p>
                              <div className="flex items-center text-xs text-muted-foreground mt-1 gap-2">
                                <span>{test.testDate ? format(new Date(test.testDate), 'MMM d, yyyy') : format(new Date(test.createdAt), 'MMM d, yyyy')}</span>
                                <span>•</span>
                                <span>{test.labName || "Unknown Lab"}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-medium">{test.resultCount} markers</p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg">
                    <FileText className="mx-auto h-10 w-10 text-muted-foreground opacity-50 mb-3" />
                    <h3 className="text-lg font-medium">No tests yet</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">Upload your first blood test PDF to begin.</p>
                    <UploadTestDialog>
                      <Button size="sm">Upload PDF</Button>
                    </UploadTestDialog>
                  </div>
                )}
              </CardContent>
              {sortedTests && sortedTests.length > 0 && (
                <CardFooter className="pt-0 border-t mt-4 p-6">
                  <Link href="/tests" className="w-full">
                    <Button variant="ghost" className="w-full text-primary">View all tests</Button>
                  </Link>
                </CardFooter>
              )}
            </Card>

            {/* Common Markers */}
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>Commonly Tracked</CardTitle>
                <CardDescription>Frequently tested biomarkers across your reports.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingSummary ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : summary?.commonMarkers && summary.commonMarkers.length > 0 ? (
                  <div className="space-y-3">
                    {summary.commonMarkers.slice(0, 5).map((marker) => (
                      <Link key={marker} href={`/markers?name=${encodeURIComponent(marker)}`}>
                        <div className="flex items-center justify-between p-3 rounded-md bg-muted/40 hover:bg-muted transition-colors cursor-pointer group">
                          <span className="font-medium text-sm group-hover:text-primary transition-colors">{marker}</span>
                          <TrendingUp className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    Upload tests to see tracked markers.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
