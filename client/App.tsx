import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";
import Index from "./pages/user/Index";
import NotFound from "./pages/NotFound";
import ConfirmToken from "./pages/user/ConfirmToken";
import Checkout from "./pages/user/Checkout";
import Booking from "./pages/user/Booking";
import Account from "./pages/user/Account";
import SuccessPayment from "./pages/user/SuccessPayment";
import { AdminGate } from "@/admin/auth/AdminGate";
import QRPaymentPage from "./components/user/QRPaymentPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/successPayment" element={<SuccessPayment />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/account" element={<Account />} />
          <Route path="/reset-password" element={<ConfirmToken />} />
          <Route path="/admin/*" element={<AdminGate />} />
          <Route path="/qr-payment" element={<QRPaymentPage/>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
