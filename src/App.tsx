import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import News from "./pages/News";
import SocioEconomics from "./pages/SocioEconomics";
import NotFound from "./pages/NotFound";
import AuthGate from "./components/AuthGate";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthGate>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/news" element={<News />} />
          <Route path="/socioeconomics" element={<SocioEconomics />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </AuthGate>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
