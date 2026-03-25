import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";
import { useTheme } from "@/lib/useTheme";
import PasswordGate from "@/components/PasswordGate";

const KesimAlaniPage = lazy(() => import("@/pages/kesim-alani"));
const PrintPage = lazy(() => import("@/pages/print"));
const NotDuzenlemePage = lazy(() => import("@/pages/not-duzenleme"));
const AiPromptAyarlariPage = lazy(() => import("@/pages/ai-prompt-ayarlari"));
const ProjeDetayPage = lazy(() => import("@/pages/proje-detay"));
const KesimTakipPage = lazy(() => import("@/pages/kesim-takip"));
const KesimRaporPage = lazy(() => import("@/pages/kesim-rapor"));

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

const queryClient = new QueryClient();

function ProtectedRouter() {
  return (
    <PasswordGate>
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/kesim/:id" component={KesimAlaniPage} />
          <Route path="/print/:id" component={PrintPage} />
          <Route path="/rapor/:id" component={KesimRaporPage} />
          <Route path="/not-duzenleme/:id" component={NotDuzenlemePage} />
          <Route path="/ai-prompt-ayarlari" component={AiPromptAyarlariPage} />
          <Route path="/proje/:id" component={ProjeDetayPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </PasswordGate>
  );
}

function AppRouter() {
  const [location] = useLocation();
  if (location.startsWith("/takip/")) {
    return (
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/takip/:token" component={KesimTakipPage} />
        </Switch>
      </Suspense>
    );
  }
  return <ProtectedRouter />;
}

function App() {
  useTheme();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
