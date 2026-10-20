import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import Welcome from "./pages/Welcome";
const Dashboard=lazy(()=>import("./pages/Dashboard"));
const Analytics=lazy(()=>import("./pages/Analytics"));
const News=lazy(()=>import("./pages/News"));
const Simulations=lazy(()=>import("./pages/Simulations"));
const Simulator=lazy(()=>import("./pages/Simulator"));
import NotFound from "./pages/NotFound";
import AuthGate from "./components/AuthGate";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<p role="status" className="p-8">Loading workspace…</p>}><Routes>
          <Route path="/" element={<Index />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/pricing" element={<Welcome />} />
          <Route element={<AuthGate />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/news" element={<News />} />
          <Route path="/simulations" element={<Simulator />} />
          <Route path="/simulations/pilot" element={<Simulations />} />
          <Route path="*" element={<NotFound />} />
          </Route>
        </Routes></Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
