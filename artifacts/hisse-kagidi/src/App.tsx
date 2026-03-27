import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useEffect, Component } from "react";
import type { ReactNode } from "react";
const NotFound = lazy(() => import("@/pages/not-found"));
import { useTheme } from "@/lib/useTheme";
import PasswordGate from "@/components/PasswordGate";
import ReloadPrompt from "@/components/ReloadPrompt";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
          <h1 className="text-xl font-semibold text-destructive">Bir hata oluştu</h1>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {this.state.error?.message || "Beklenmeyen bir hata oluştu."}
          </p>
          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = import.meta.env.BASE_URL || "/";
            }}
          >
            Ana Sayfaya Dön
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const Home = lazy(() => import("@/pages/home"));
const KesimAlaniPage = lazy(() => import("@/pages/kesim-alani"));
const PrintPage = lazy(() => import("@/pages/print"));
const NotDuzenlemePage = lazy(() => import("@/pages/not-duzenleme"));
const AiPromptAyarlariPage = lazy(() => import("@/pages/ai-prompt-ayarlari"));
const ProjeDetayPage = lazy(() => import("@/pages/proje-detay"));
const KesimTakipPage = lazy(() => import("@/pages/kesim-takip"));
const KesimRaporPage = lazy(() => import("@/pages/kesim-rapor"));

function usePrefetchAdjacentRoutes() {
  const [location] = useLocation();
  useEffect(() => {
    const timer = setTimeout(() => {
      if (location === "/") {
        import("@/pages/kesim-alani");
        import("@/pages/proje-detay");
      } else if (location.startsWith("/kesim/")) {
        import("@/pages/home");
        import("@/pages/print");
      } else if (location.startsWith("/proje/")) {
        import("@/pages/home");
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [location]);
}

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

const queryClient = new QueryClient();

function ProtectedRouter() {
  usePrefetchAdjacentRoutes();
  return (
    <PasswordGate>
      <ErrorBoundary>
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
      </ErrorBoundary>
    </PasswordGate>
  );
}

function AppRouter() {
  const [location] = useLocation();
  if (location.startsWith("/takip/")) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <Switch>
            <Route path="/takip/:token" component={KesimTakipPage} />
          </Switch>
        </Suspense>
      </ErrorBoundary>
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
        <ReloadPrompt />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
