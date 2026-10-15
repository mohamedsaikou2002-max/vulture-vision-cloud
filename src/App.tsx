import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
const Dashboard=lazy(()=>import("./pages/Dashboard"));
const Analytics=lazy(()=>import("./pages/Analytics"));
const News=lazy(()=>import("./pages/News"));
const SocioEconomics=lazy(()=>import("./pages/SocioEconomics"));
const Simulations=lazy(()=>import("./pages/Simulations"));
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
        <Suspense fallback={<p role="status" className="p-8">Loading workspace…</p>}><Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/news" element={<News />} />
          <Route path="/socioeconomics" element={<SocioEconomics />} />
          <Route path="/simulations" element={<Simulations />} />
          <Route path="*" element={<NotFound />} />
        </Routes></Suspense>
      </BrowserRouter>
      </AuthGate>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
