import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ConfirmToken from "./components/ConfirmToken";
import AdminIndex from "./pages/admin/AdminIndex";
import DashboardPage from "./pages/admin/Dashboard";
import UsersPage from "./pages/admin/Users";
import MoviesPage from "./pages/admin/Movies";
import ShowtimesPage from "./pages/admin/Showtimes";
import ToysPage from "./pages/admin/Toys";
import TransactionsPage from "./pages/admin/Transactions";
import Checkout from "./pages/Checkout";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { adminLoginApi } from "@/lib/api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
    },
  },
});

const AdminLoginView = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    try {
      setLoading(true);
      setError("");
      // const { token } = await adminLoginApi({ email, password });
      // localStorage.setItem("adminToken", token);
      if (email === 'admin@email.com' && password === 'admin') {
        localStorage.setItem("adminToken", 'adminToken');
      } else {
        setError("Đăng nhập thất bại");
        return;
      }
      localStorage.setItem("adminEmail", email);
      window.dispatchEvent(new Event("admin-auth-changed"));
      navigate("/admin", { replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm bg-white">
        <CardHeader>
          <CardTitle>Đăng nhập Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <form onSubmit={handleLogin}>
              <div>
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Mật khẩu</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div className="flex justify-end">
                <Button disabled={loading} type="submit">
                  {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                </Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const AdminGate = () => {
  const [hasToken, setHasToken] = useState<boolean>(!!localStorage.getItem("adminToken"));
  useEffect(() => {
    const onAuthChanged = () => setHasToken(!!localStorage.getItem("adminToken"));
    window.addEventListener("admin-auth-changed", onAuthChanged as any);
    window.addEventListener("storage", onAuthChanged as any);
    return () => {
      window.removeEventListener("admin-auth-changed", onAuthChanged as any);
      window.removeEventListener("storage", onAuthChanged as any);
    };
  }, []);
  if (!hasToken) return <AdminLoginView />;
  return (
    <Routes>
      <Route path="/" element={<AdminIndex />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/users" element={<UsersPage />} />
      <Route path="/movies" element={<MoviesPage />} />
      <Route path="/showtimes" element={<ShowtimesPage />} />
      <Route path="/toys" element={<ToysPage />} />
      <Route path="/transactions" element={<TransactionsPage />} />
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/reset-password" element={<ConfirmToken />} />
          <Route path="/admin/*" element={<AdminGate />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
