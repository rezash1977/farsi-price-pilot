import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Compare from "./pages/Compare";
import Uploads from "./pages/Uploads";
import WhatsApp from "./pages/WhatsApp";
import Alerts from "./pages/Alerts";
import Vendors from "./pages/Vendors";
import Settings from "./pages/Settings";
import PriceAnalysis from "./pages/PriceAnalysis";
import ChatDataProcessor from "./pages/ChatDataProcessor";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Layout><Index /></Layout>} />
            <Route path="/compare" element={<Layout><Compare /></Layout>} />
            <Route path="/price-analysis" element={<Layout><PriceAnalysis /></Layout>} />
            <Route path="/chat-data" element={<Layout><ChatDataProcessor /></Layout>} />
            <Route path="/ingest/uploads" element={<Layout><Uploads /></Layout>} />
            <Route path="/ingest/whatsapp" element={<Layout><WhatsApp /></Layout>} />
            <Route path="/alerts" element={<Layout><Alerts /></Layout>} />
            <Route path="/vendors" element={<Layout><Vendors /></Layout>} />
            <Route path="/settings" element={<Layout><Settings /></Layout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
