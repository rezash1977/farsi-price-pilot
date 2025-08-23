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
            <Route path="/compare" element={<Layout><div className="p-8 text-center">مقایسه قیمت‌ها - در حال توسعه</div></Layout>} />
            <Route path="/ingest/uploads" element={<Layout><div className="p-8 text-center">آپلود فایل - در حال توسعه</div></Layout>} />
            <Route path="/ingest/whatsapp" element={<Layout><div className="p-8 text-center">دریافت از واتس‌اپ - در حال توسعه</div></Layout>} />
            <Route path="/alerts" element={<Layout><div className="p-8 text-center">هشدار قیمت - در حال توسعه</div></Layout>} />
            <Route path="/vendors" element={<Layout><div className="p-8 text-center">فروشنده‌ها - در حال توسعه</div></Layout>} />
            <Route path="/settings" element={<Layout><div className="p-8 text-center">تنظیمات - در حال توسعه</div></Layout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
