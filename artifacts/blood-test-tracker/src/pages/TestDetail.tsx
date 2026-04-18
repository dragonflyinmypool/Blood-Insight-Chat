import { useParams, Link } from "wouter";
import { format } from "date-fns";
import { ArrowLeft, Calendar, User, FlaskConical, AlertCircle, MessageSquare, ExternalLink, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/layout/Header";
import { useGetBloodTest, getGetBloodTestQueryKey, useCreateChatConversation } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

export default function TestDetail() {
  const { id } = useParams();
  const testId = id ? parseInt(id) : 0;
  const [, setLocation] = useLocation();
  
  const { data: test, isLoading } = useGetBloodTest(testId, {
    query: { enabled: !!testId, queryKey: getGetBloodTestQueryKey(testId) }
  });

  const createChatMutation = useCreateChatConversation();

  const handleStartChat = () => {
    if (!test) return;
    
    createChatMutation.mutate(
      {
        data: {
          title: `Discussion: ${test.fileName}`,
          bloodTestId: test.id
        }
      },
      {
        onSuccess: (chat) => {
          setLocation(`/chat/${chat.id}`);
        }
      }
    );
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">Unknown</Badge>;
    
    const s = status.toLowerCase();
    if (s.includes('high')) return <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20">High</Badge>;
    if (s.includes('low')) return <Badge variant="destructive" className="bg-orange-500/10 text-orange-600 border-orange-500/20 hover:bg-orange-500/20">Low</Badge>;
    if (s.includes('normal') || s.includes('in range')) return <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20">Normal</Badge>;
    
    return <Badge variant="secondary">{status}</Badge>;
  };

  if (isLoading) {
    return (
      <>
        <Header title="Loading Report..." />
        <div className="p-6 max-w-5xl mx-auto w-full space-y-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </>
    );
  }

  if (!test) {
    return (
      <>
        <Header title="Report Not Found" />
        <div className="p-6 text-center">
          <h2 className="text-xl font-semibold">Test not found</h2>
          <Link href="/tests">
            <Button className="mt-4">Back to Tests</Button>
          </Link>
        </div>
      </>
    );
  }

  // Count abnormal results
  const abnormalCount = test.results.filter(r => 
    r.status && !r.status.toLowerCase().includes('normal') && !r.status.toLowerCase().includes('in range')
  ).length;

  return (
    <>
      <Header title="Test Details">
        <Link href="/tests">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
        </Link>
        <Button 
          onClick={handleStartChat} 
          disabled={createChatMutation.isPending}
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">Analyze with AI</span>
        </Button>
      </Header>

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* Header Card */}
          <Card className="border-t-4 border-t-primary">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl font-bold">{test.fileName}</CardTitle>
                  <CardDescription className="text-base mt-1">Uploaded {format(new Date(test.createdAt), 'MMMM d, yyyy')}</CardDescription>
                </div>
                {abnormalCount > 0 && (
                  <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-4 py-2 rounded-lg border border-destructive/20 font-medium">
                    <AlertCircle className="h-5 w-5" />
                    {abnormalCount} marker{abnormalCount !== 1 ? 's' : ''} outside optimal range
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pt-2">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Collection Date</p>
                  <p className="font-semibold text-foreground">
                    {test.testDate ? format(new Date(test.testDate), 'MMM d, yyyy') : "Unknown"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <FlaskConical className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Laboratory</p>
                  <p className="font-semibold text-foreground">{test.labName || "Unknown"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Patient Name</p>
                  <p className="font-semibold text-foreground">{test.patientName || "Unknown"}</p>
                </div>
              </div>
            </CardContent>
            {test.notes && (
              <div className="px-6 pb-6 pt-0">
                <div className="bg-muted/50 rounded-lg p-4 text-sm border">
                  <span className="font-medium block mb-1">Notes</span>
                  <p className="text-muted-foreground whitespace-pre-wrap">{test.notes}</p>
                </div>
              </div>
            )}
          </Card>

          {/* Results Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-5 border-b bg-muted/20">
              <div>
                <CardTitle className="text-xl">Biomarker Results</CardTitle>
                <CardDescription>Extracted {test.results.length} markers from the report</CardDescription>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/40 text-muted-foreground uppercase font-medium">
                  <tr>
                    <th className="px-6 py-4 rounded-tl-lg">Biomarker</th>
                    <th className="px-6 py-4">Result</th>
                    <th className="px-6 py-4">Reference Range</th>
                    <th className="px-6 py-4 rounded-tr-lg">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {test.results.map((result) => (
                    <tr key={result.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">
                        <Link href={`/markers?name=${encodeURIComponent(result.markerName)}`}>
                          <span className="hover:text-primary hover:underline cursor-pointer flex items-center gap-1.5">
                            {result.markerName}
                            <Activity className="h-3 w-3 opacity-50" />
                          </span>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-baseline gap-1">
                          <span className={`text-base font-bold ${
                            result.status?.toLowerCase().includes('high') ? 'text-red-600' :
                            result.status?.toLowerCase().includes('low') ? 'text-orange-600' : ''
                          }`}>
                            {result.value !== null ? result.value : '-'}
                          </span>
                          <span className="text-muted-foreground text-xs">{result.unit || ''}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {result.referenceRangeLow !== null && result.referenceRangeHigh !== null 
                          ? `${result.referenceRangeLow} - ${result.referenceRangeHigh} ${result.unit || ''}`
                          : '-'}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(result.status)}
                      </td>
                    </tr>
                  ))}
                  {test.results.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                        No results could be extracted from this PDF.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

        </div>
      </main>
    </>
  );
}
