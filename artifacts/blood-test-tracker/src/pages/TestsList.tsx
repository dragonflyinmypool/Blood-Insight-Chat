import { Link } from "wouter";
import { format } from "date-fns";
import { FileText, Upload, Plus, Calendar, FlaskConical, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/layout/Header";
import { UploadTestDialog } from "@/components/UploadTestDialog";
import { useListBloodTests, useDeleteBloodTest, getListBloodTestsQueryKey, getGetBloodTestSummaryQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function TestsList() {
  const [search, setSearch] = useState("");
  const { data: tests, isLoading } = useListBloodTests();
  const deleteMutation = useDeleteBloodTest();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sortedTests = tests?.sort((a, b) => 
    new Date(b.testDate || b.createdAt).getTime() - new Date(a.testDate || a.createdAt).getTime()
  ) || [];

  const filteredTests = sortedTests.filter(test => 
    test.fileName.toLowerCase().includes(search.toLowerCase()) || 
    (test.labName && test.labName.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Test deleted successfully" });
        queryClient.invalidateQueries({ queryKey: getListBloodTestsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBloodTestSummaryQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to delete test", variant: "destructive" });
      }
    });
  };

  return (
    <>
      <Header title="Blood Tests">
        <UploadTestDialog>
          <Button className="gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload PDF</span>
          </Button>
        </UploadTestDialog>
      </Header>

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search tests or labs..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {tests?.length || 0} total reports
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-40 rounded-xl border bg-card animate-pulse" />
              ))}
            </div>
          ) : filteredTests.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTests.map((test) => (
                <Link key={test.id} href={`/tests/${test.id}`}>
                  <div className="group flex flex-col h-full bg-card border rounded-xl p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer relative overflow-hidden">
                    
                    <div className="flex justify-between items-start mb-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete this blood test report and all extracted markers.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={(e) => handleDelete(test.id, e as any)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg line-clamp-2 leading-tight mb-1">{test.fileName}</h3>
                      {test.labName && (
                        <div className="flex items-center text-sm text-muted-foreground gap-1.5 mt-2">
                          <FlaskConical className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{test.labName}</span>
                        </div>
                      )}
                      <div className="flex items-center text-sm text-muted-foreground gap-1.5 mt-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>{test.testDate ? format(new Date(test.testDate), 'MMM d, yyyy') : format(new Date(test.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                    
                    <div className="mt-5 pt-4 border-t flex items-center justify-between text-sm">
                      <span className="font-medium px-2.5 py-1 bg-muted rounded-full">{test.resultCount} markers</span>
                      <span className="text-primary font-medium group-hover:underline">View Details →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 border-2 border-dashed rounded-xl bg-card">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground opacity-30 mb-4" />
              <h3 className="text-xl font-semibold text-foreground">No reports found</h3>
              <p className="text-muted-foreground mt-2 mb-6 max-w-sm mx-auto">
                {search ? "No blood tests match your search criteria." : "You haven't uploaded any blood test reports yet."}
              </p>
              {!search && (
                <UploadTestDialog>
                  <Button className="gap-2">
                    <Upload className="h-4 w-4" />
                    Upload your first report
                  </Button>
                </UploadTestDialog>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
