import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { MessageSquare, Plus, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";
import { useListChatConversations, useCreateChatConversation, useDeleteChatConversation, getListChatConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function ChatHub() {
  const [, setLocation] = useLocation();
  const { data: conversations, isLoading } = useListChatConversations();
  const createMutation = useCreateChatConversation();
  const deleteMutation = useDeleteChatConversation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleNewChat = () => {
    createMutation.mutate(
      { data: { title: "New Health Discussion" } },
      {
        onSuccess: (chat) => {
          setLocation(`/chat/${chat.id}`);
        }
      }
    );
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Conversation deleted" });
        queryClient.invalidateQueries({ queryKey: getListChatConversationsQueryKey() });
      }
    });
  };

  const sortedConversations = conversations?.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <>
      <Header title="AI Health Assistant">
        <Button onClick={handleNewChat} disabled={createMutation.isPending} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Chat</span>
        </Button>
      </Header>

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-8">
          
          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-8 md:p-10 text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">Discuss your lab results</h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-6">
              Ask questions about your biomarkers, get simple explanations for complex medical terms, and understand what your blood work means for your health.
            </p>
            <Button onClick={handleNewChat} size="lg" className="rounded-full px-8">
              Start a new conversation
            </Button>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4 px-1">Recent Conversations</h3>
            
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 rounded-lg bg-card border animate-pulse" />
                ))}
              </div>
            ) : sortedConversations && sortedConversations.length > 0 ? (
              <div className="space-y-3">
                {sortedConversations.map((chat) => (
                  <Link key={chat.id} href={`/chat/${chat.id}`}>
                    <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer group">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <MessageSquare className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-medium text-foreground group-hover:text-primary transition-colors">
                              {chat.title}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {format(new Date(chat.createdAt), 'MMM d, yyyy • h:mm a')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => handleDelete(chat.id, e)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0 duration-300" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed rounded-xl bg-card/50">
                <p className="text-muted-foreground">No past conversations.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
