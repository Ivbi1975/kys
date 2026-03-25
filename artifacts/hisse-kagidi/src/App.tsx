import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import KesimAlaniPage from "@/pages/kesim-alani";
import PrintPage from "@/pages/print";
import NotFound from "@/pages/not-found";
import NotDuzenlemePage from "@/pages/not-duzenleme";
import AiPromptAyarlariPage from "@/pages/ai-prompt-ayarlari";
import ProjeDetayPage from "@/pages/proje-detay";
import KesimTakipPage from "@/pages/kesim-takip";
import KesimRaporPage from "@/pages/kesim-rapor";
import { useTheme } from "@/lib/useTheme";
import PasswordGate from "@/components/PasswordGate";

const queryClient = new QueryClient();

function ProtectedRouter() {
  return (
    <PasswordGate>
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
    </PasswordGate>
  );
}

function AppRouter() {
  const [location] = useLocation();
  if (location.startsWith("/takip/")) {
    return (
      <Switch>
        <Route path="/takip/:token" component={KesimTakipPage} />
      </Switch>
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
