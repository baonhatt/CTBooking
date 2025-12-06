import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { Ticket, Loader2, Menu, User, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  onBookClick: () => void;
}
const auth = useAuth();
export default function Header({ onBookClick }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isForgetPassOpen, setIsForgetPassOpen] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);
  const [isForgetLoading, setIsForgetLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [forgetPassEmail, setForgetPassEmail] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [showRegisterPass, setShowRegisterPass] = useState(false);
  const [showRegisterConfirmPass, setShowRegisterConfirmPass] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const readAuth = () => {
      const raw = localStorage.getItem("authUser");
      if (!raw) {
        setUserName(null);
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        const name =
          parsed?.user?.username ||
          parsed?.username ||
          (parsed?.user?.email || parsed?.email || "").split("@")[0];
        if (name) setUserName(name);
      } catch {
        setUserName(null);
      }
    };
    readAuth();
    const onAuthChanged = () => readAuth();
    const onOpenLogin = () => setIsLoginOpen(true);
    window.addEventListener("user-auth-changed", onAuthChanged as any);
    window.addEventListener("storage", onAuthChanged as any);
    window.addEventListener("open-login", onOpenLogin as any);
    return () => {
      window.removeEventListener("user-auth-changed", onAuthChanged as any);
      window.removeEventListener("storage", onAuthChanged as any);
      window.removeEventListener("open-login", onOpenLogin as any);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("authUser");
    setUserName(null);
    window.dispatchEvent(new Event("user-auth-changed"));
    toast({ title: "Đã đăng xuất" });
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoginLoading(true);
      const data = await auth.login(loginEmail, loginPassword);
      if (data?.status === "success") {
        localStorage.setItem("authUser", JSON.stringify({ user: data.user }));
        setUserName(data.user.username);
        window.dispatchEvent(new Event("user-auth-changed"));
        toast({ title: "Đăng nhập thành công", description: data.user.email });
        setIsLoginOpen(false);
        setLoginEmail("");
        setLoginPassword("");
      }
    } catch (err: any) {
      toast({ title: "Đăng nhập thất bại", description: err.message });
    } finally {
      setIsLoginLoading(false);
    }
  };
  const openRegister = () => {
    setIsRegisterOpen(true);
    setIsLoginOpen(false);
  };
  const openLogin = () => {
    setIsLoginOpen(true);
    setIsRegisterOpen(false);
  };
  const openForgetPass = () => {
    setIsForgetPassOpen(true);
    setIsLoginOpen(false);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerPassword !== registerConfirmPassword) {
      toast({ title: "Mật khẩu không khớp" });
      return;
    }
    try {
      setIsRegisterLoading(true);
      const data = await auth.register(
        registerEmail,
        registerPassword,
        registerName,
      );
      if (data?.status === "success") {
        localStorage.setItem("authUser", JSON.stringify({ user: data.user }));
        setUserName(data.user.username);
        window.dispatchEvent(new Event("user-auth-changed"));
        toast({ title: "Đăng ký thành công", description: data.user.email });
        setIsRegisterOpen(false);
        setRegisterEmail("");
        setRegisterPassword("");
        setRegisterConfirmPassword("");
        setIsLoginOpen(true);
      }
    } catch (err: any) {
      toast({ title: "Đăng ký thất bại", description: err.message });
    } finally {
      setIsRegisterLoading(false);
    }
  };
  const handleForgetPassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsForgetLoading(true);
      const data = await auth.forgetPass(forgetPassEmail);
      if (data?.status === "success") {
        toast({ title: "Thông báo hệ thống!", description: data.message });
        setIsForgetPassOpen(false);
        setForgetPassEmail("");
      }
    } catch (err: any) {
      toast({ title: "Thông báo hệ thống!", description: err.message });
    } finally {
      setIsForgetLoading(false);
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-black/95 backdrop-blur-md border-b border-white/10"
          : "bg-transparent",
      )}
    >
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 animate-fade-in">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold text-white">C</span>
          </div>
          <h1 className="hidden md:block text-2xl font-bold text-blue-400">CINESPHERE</h1>
        </div>

        <nav className="hidden md:flex items-center gap-8 animate-fade-in delay-200">
          <button
            onClick={() => scrollToSection("hero")}
            className="text-white hover:text-blue-400 transition-colors duration-300 font-medium"
          >
            Phim Hot
          </button>
          <button
            onClick={() => scrollToSection("technology")}
            className="text-white hover:text-blue-400 transition-colors duration-300 font-medium"
          >
            Công Nghệ
          </button>
          <button
            onClick={() => scrollToSection("products")}
            className="text-white hover:text-blue-400 transition-colors duration-300 font-medium"
          >
            Cửa Hàng
          </button>
        </nav>
        <div className="flex items-center gap-4 animate-fade-in delay-250">
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="border-white/20 text-black"
                >
                  <Menu className="h-4 w-4" aria-label="Menu" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-black/90 border border-white/20 text-white">
                <DropdownMenuItem onClick={() => scrollToSection("hero")}>
                  Phim Hot
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => scrollToSection("technology")}>
                  Công Nghệ
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => scrollToSection("products")}>
                  Cửa Hàng
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {userName ? (
                  <>
                    <DropdownMenuItem>Chào, {userName}</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout}>
                      Đăng xuất
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => setIsLoginOpen(true)}>
                      Đăng nhập
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsRegisterOpen(true)}>
                      Đăng ký
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsForgetPassOpen(true)}>
                      Quên mật khẩu
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {userName ? (
            <div className="hidden md:flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 text-white font-medium hover:text-blue-400">
                    <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                    <span>{userName}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-black/90 border border-white/20 text-white">
                  <DropdownMenuItem onClick={handleLogout}>
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
              <DialogTrigger asChild>
                <button
                  className="hidden md:inline-block text-white hover:text-blue-400 transition-colors duration-300 font-medium"
                  onClick={openLogin}
                >
                  Đăng nhập
                </button>
              </DialogTrigger>
              <DialogContent className="bg-gradient-dark border border-white/10">
                <DialogHeader>
                  <DialogTitle className="text-blue-400">Đăng nhập</DialogTitle>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleLoginSubmit}>
                  <div>
                    <label className="text-sm text-gray-300 mb-1 block">
                      Email
                    </label>
                    <Input
                      type="email"
                      placeholder="you@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      maxLength={50}
                      disabled={isLoginLoading}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300 mb-1 block">
                      Mật khẩu
                    </label>
                    <div className="relative">
                      <Input
                        type={showLoginPass ? "text" : "password"}
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        maxLength={50}
                        pattern="^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$"
                        title="Mật khẩu phải có ít nhất 6 ký tự, bao gồm cả chữ cái và số"
                        disabled={isLoginLoading}
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                        onClick={() => setShowLoginPass((v) => !v)}
                        aria-label={
                          showLoginPass ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"
                        }
                      >
                        {showLoginPass ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoginLoading}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                  >
                    {isLoginLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Đang đăng nhập...
                      </span>
                    ) : (
                      "Đăng nhập"
                    )}
                  </Button>
                  <div className="flex justify-between items-center">
                    <div></div>
                    <Button
                      variant="link"
                      className="text-sm text-blue-400 hover:text-blue-300"
                      type="button"
                      onClick={() => {
                        openForgetPass();
                      }}
                    >
                      Quên mật khẩu?
                    </Button>
                  </div>
                  <div className="relative w-full">
                    <span className="absolute inset-x-0 bottom-0 h-[1px] bg-gray-400"></span>
                  </div>
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="link"
                      className="text-sm text-blue-400 hover:text-blue-300 pt-6"
                      type="button"
                      onClick={() => {
                        openRegister();
                      }}
                    >
                      Bạn chưa có tài khoản? Đăng ký
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
            <DialogContent className="bg-gradient-dark border border-white/10">
              <DialogHeader>
                <DialogTitle className="text-blue-400 text-center">
                  ĐĂNG KÝ
                </DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleRegisterSubmit}>
                <div>
                  <label className="text-sm text-gray-300 mb-1 block">
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="you@email.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    maxLength={50}
                    disabled={isRegisterLoading}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-1 block">
                    Tên
                  </label>
                  <Input
                    type="text"
                    placeholder="Họ và tên"
                    value={registerName}
                    maxLength={50}
                    onChange={(e) => setRegisterName(e.target.value)}
                    disabled={isRegisterLoading}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-1 block">
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <Input
                      type={showRegisterPass ? "text" : "password"}
                      placeholder="••••••••"
                      value={registerPassword}
                      maxLength={50}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      required
                      pattern="^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$"
                      title="Mật khẩu phải có ít nhất 6 ký tự, bao gồm cả chữ cái và số"
                      disabled={isRegisterLoading}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                      onClick={() => setShowRegisterPass((v) => !v)}
                      aria-label={
                        showRegisterPass ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"
                      }
                    >
                      {showRegisterPass ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-1 block">
                    Nhập Lại Mật khẩu
                  </label>
                  <div className="relative">
                    <Input
                      type={showRegisterConfirmPass ? "text" : "password"}
                      placeholder="••••••••"
                      value={registerConfirmPassword}
                      maxLength={50}
                      onChange={(e) =>
                        setRegisterConfirmPassword(e.target.value)
                      }
                      required
                      pattern="^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$"
                      title="Mật khẩu phải có ít nhất 6 ký tự, bao gồm cả chữ cái và số"
                      disabled={isRegisterLoading}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                      onClick={() => setShowRegisterConfirmPass((v) => !v)}
                      aria-label={
                        showRegisterConfirmPass
                          ? "Ẩn mật khẩu"
                          : "Hiển thị mật khẩu"
                      }
                    >
                      {showRegisterConfirmPass ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={isRegisterLoading}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                >
                  {isRegisterLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang đăng ký...
                    </span>
                  ) : (
                    "Đăng ký"
                  )}
                </Button>
                <div className="flex justify-center">
                  <Button
                    variant="link"
                    className="text-sm text-blue-400 hover:text-blue-300"
                    type="button"
                    onClick={() => {
                      openLogin();
                    }}
                  >
                    Đã có tài khoản? Đăng nhập
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={isForgetPassOpen} onOpenChange={setIsForgetPassOpen}>
            <DialogContent className="bg-gradient-dark border border-white/10">
              <DialogHeader>
                <DialogTitle className="text-blue-400 text-center">
                  QUÊN MẬT KHẨU
                </DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleForgetPassSubmit}>
                <div>
                  <label className="text-sm text-gray-300 mb-1 block">
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="you@gmail.com"
                    value={forgetPassEmail}
                    onChange={(e) => setForgetPassEmail(e.target.value)}
                    maxLength={50}
                    title="Vui lòng nhập email của bạn để thay đổi mật khẩu!"
                    disabled={isForgetLoading}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isForgetLoading}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                >
                  {isForgetLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang gửi...
                    </span>
                  ) : (
                    "Xác Nhận"
                  )}
                </Button>
                <div className="flex justify-center">
                  <Button
                    variant="link"
                    className="text-sm text-blue-400 hover:text-blue-300"
                    type="button"
                    onClick={() => {
                      setIsForgetPassOpen(false);
                      setIsLoginOpen(true);
                    }}
                  >
                    Quay lại đăng nhập!
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Button
            onClick={onBookClick}
            className="bg-gradient-to-r text-sm md:text-base from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold px-3 py-2 md:px-6 md:py-2 rounded-lg shadow-lg transition-all duration-300 hover:scale-105"
          >
            <Ticket className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">ĐẶT VÉ NGAY</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
