import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import TestsList from "@/pages/TestsList";
import TestDetail from "@/pages/TestDetail";
import MarkerHistory from "@/pages/MarkerHistory";
import ChatHub from "@/pages/ChatHub";
import ActiveChat from "@/pages/ActiveChat";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

function Router() {
  return (
    <Switch>
      <Route path="/">
        <AppLayout><Dashboard /></AppLayout>
      </Route>
      <Route path="/tests">
        <AppLayout><TestsList /></AppLayout>
      </Route>
      <Route path="/tests/:id">
        <AppLayout><TestDetail /></AppLayout>
      </Route>
      <Route path="/markers">
        <AppLayout><MarkerHistory /></AppLayout>
      </Route>
      <Route path="/chat">
        <AppLayout><ChatHub /></AppLayout>
      </Route>
      <Route path="/chat/:id">
        <AppLayout><ActiveChat /></AppLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
