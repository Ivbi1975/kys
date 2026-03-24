import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import KesimAlaniPage from "@/pages/kesim-alani";
import PrintPage from "@/pages/print";
import NotFound from "@/pages/not-found";
import NotDuzenlemePage from "@/pages/not-duzenleme";
import AiPromptAyarlariPage from "@/pages/ai-prompt-ayarlari";
import CatismaTespitiPage from "@/pages/catisma-tespiti";
import ProjeDetayPage from "@/pages/proje-detay";
import { useTheme } from "@/lib/useTheme";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/kesim/:id" component={KesimAlaniPage} />
      <Route path="/print/:id" component={PrintPage} />
      <Route path="/not-duzenleme/:id" component={NotDuzenlemePage} />
      <Route path="/ai-prompt-ayarlari" component={AiPromptAyarlariPage} />
      <Route path="/catisma-tespiti" component={CatismaTespitiPage} />
      <Route path="/proje/:id" component={ProjeDetayPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useTheme();
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
