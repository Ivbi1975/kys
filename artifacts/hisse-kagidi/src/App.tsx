import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useEffect, useState, Component } from "react";
import type { ReactNode } from "react";
const NotFound = lazy(() => import("@/pages/not-found"));
import { useTheme } from "@/lib/useTheme";
import PasswordGate from "@/components/PasswordGate";
const ReloadPrompt = import.meta.env.PROD
  ? lazy(() => import("@/components/ReloadPrompt"))
  : () => null;
import { SidebarNav } from "@/components/SidebarNav";
import { Menu } from "lucide-react";

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
const CopKutusuPage = lazy(() => import("@/pages/cop-kutusu"));
const KesimAlaniPage = lazy(() => import("@/pages/kesim-alani"));
const PrintPage = lazy(() => import("@/pages/print"));
const NotDuzenlemePage = lazy(() => import("@/pages/not-duzenleme"));
const AiPromptAyarlariPage = lazy(() => import("@/pages/ai-prompt-ayarlari"));
const ProjeDetayPage = lazy(() => import("@/pages/proje-detay"));
const KesimTakipPage = lazy(() => import("@/pages/kesim-takip"));
const KesimRaporPage = lazy(() => import("@/pages/kesim-rapor"));
const BagisHavuzuPage = lazy(() => import("@/pages/bagis-havuzu"));
const AiSiniflandirmaPage = lazy(() => import("@/pages/bagis-havuzu/AiSiniflandirmaPage"));
const SorunluBagislarPage = lazy(() => import("@/pages/sorunlu-bagislar"));
const ApiDokumantasyonPage = lazy(() => import("@/pages/api-dokumantasyon"));
const KullanimKilavuzuPage = lazy(() => import("@/pages/kullanim-kilavuzu"));

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRouterInner() {
  usePrefetchAdjacentRoutes();
  const [location] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem("sidebar-collapsed");
      return stored === null ? false : stored === "1";
    } catch { return true; }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const hideSidebar = location.startsWith("/print/") || location.startsWith("/rapor/") || location.startsWith("/not-duzenleme/");

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("sidebar-collapsed", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden">

      {!hideSidebar && (
        <div className="md:hidden flex items-center h-12 px-4 border-b bg-[hsl(222,47%,8%)] border-[hsl(222,40%,13%)] flex-shrink-0 z-10">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-white/60 hover:text-white/90 hover:bg-white/[0.07] transition-all"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 ml-2">
            <img src="/kurban-logo.png" alt="" className="h-5 w-5 object-contain" />
            <span className="text-[13px] font-semibold text-white/80">KYS</span>
          </div>
        </div>
      )}

      {!hideSidebar && (
        <div className="hidden md:flex flex-shrink-0">
          <SidebarNav collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        </div>
      )}

      {!hideSidebar && mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="md:hidden fixed inset-y-0 left-0 z-50 w-[260px] animate-in slide-in-from-left duration-200">
            <SidebarNav
              collapsed={false}
              onToggle={() => setMobileMenuOpen(false)}
              isMobileDrawer
              onMobileClose={() => setMobileMenuOpen(false)}
            />
          </div>
        </>
      )}

      <div className="flex-1 overflow-auto min-h-0">
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
              <Route path="/bagis-havuzu/:id/ai" component={AiSiniflandirmaPage} />
              <Route path="/bagis-havuzu/:id" component={BagisHavuzuPage} />
              <Route path="/sorunlu-bagislar/:id" component={SorunluBagislarPage} />
              <Route path="/kullanim-kilavuzu" component={KullanimKilavuzuPage} />
              <Route path="/cop-kutusu" component={CopKutusuPage} />
              <Route path="/api-dokumantasyon" component={ApiDokumantasyonPage} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}

function ProtectedRouter() {
  return (
    <PasswordGate>
      <ProtectedRouterInner />
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
        <Suspense fallback={null}>
          <ReloadPrompt />
        </Suspense>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
