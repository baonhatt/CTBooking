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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import iconCine from "@/assets/images/iconCine.svg";
import icon from "@/assets/images/icon.svg";
import brand from "@/assets/images/brand.svg";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

interface HeaderProps {
  onBookClick?: () => void;
  disableNav?: boolean;
  tooltipPrefix?: string;
  extraMenuOptions?: Array<{ label: string; action: () => void }>;
}

export default function Header({ onBookClick = () => { }, disableNav = false, tooltipPrefix, extraMenuOptions = [] }: HeaderProps) {
  const auth = useAuth();
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
  const navigator = useNavigate();
  const location = useLocation();
  const effectiveDisable = disableNav || location.pathname !== "/";
  const [activeSection, setActiveSection] = useState<string>("hero");
  const navItems = [
    { label: "Phim", target: "films" },
    { label: "Công nghệ", target: "technology" },
    { label: "Cửa hàng", target: "store" },
  ];

  useEffect(() => {
    if (effectiveDisable) return;
    const ids = ["hero", "films", "technology", "promotions", "store"];
    const observers: IntersectionObserver[] = [];
    const visibleSections = new Set<string>();
    
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.1) {
              visibleSections.add(id);
            } else {
              visibleSections.delete(id);
            }
            
            // Tìm section đầu tiên trong danh sách ids mà đang visible
            // (ưu tiên section ở trên)
            let activeId = "hero";
            for (const sectionId of ids) {
              if (visibleSections.has(sectionId)) {
                activeId = sectionId;
                break; // Lấy section đầu tiên (ở trên cùng)
              }
            }
            
            setActiveSection(activeId);
          });
        },
        { 
          threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
          rootMargin: "-15% 0px -60% 0px" // Trigger khi section vào viewport từ trên
        }
      );
      
      observer.observe(el);
      observers.push(observer);
    });
    
    return () => observers.forEach((ob) => ob.disconnect());
  }, [effectiveDisable]);
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
    localStorage.removeItem("userProfile");
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
        try {
          const derivedName = data.user.username || (data.user.email || "").split("@")[0];
          const profile = { email: data.user.email, name: derivedName, phone: (data.user as any)?.phone || "" };
          localStorage.setItem("userProfile", JSON.stringify(profile));
        } catch { }
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
        try {
          const derivedName = data.user.username || (data.user.email || "").split("@")[0];
          const profile = { email: data.user.email, name: derivedName, phone: (data.user as any)?.phone || "" };
          localStorage.setItem("userProfile", JSON.stringify(profile));
        } catch { }
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

  // Nav "Đặt vé ngay" chỉ để cuộn xuống section đặt vé, không cần check đăng nhập
  const handleBookNow = () => {
    onBookClick();
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
          ? "bg-black/50 backdrop-blur-lg border-b border-white/10 shadow-[0_10px_40px_rgba(67,97,238,0.15)]"
          : "bg-gradient-to-b from-black/50 via-black/30 to-transparent border-b border-white/10",
      )}
    >
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-3 md:py-4 flex items-center gap-4 md:gap-8">
        {/* Logo Section */}
        <div className="flex items-center gap-3 md:gap-4 animate-fade-in">
          <img
            onClick={() => navigator('/')}
            src={icon}
            className="cursor-pointer h-16 w-16 md:h-20 md:w-20 lg:h-24 lg:w-24 drop-shadow-[0_0_30px_rgba(59,130,246,0.6)] transition-transform duration-300 hover:scale-110"
            alt="CINESPHERE logo"
          />
          <div 
            onClick={() => navigator('/')}
            className="cursor-pointer hidden sm:block"
          >
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8 xl:gap-10 animate-fade-in delay-200 ml-auto">
          {navItems.map((item) => (
            <button
              key={item.target}
              onClick={effectiveDisable ? undefined : () => scrollToSection(item.target)}
              className={cn(
                "relative group inline-flex h-10 items-center text-white font-medium uppercase text-sm lg:text-[15px] whitespace-nowrap tracking-[0.08em] transition-all duration-300",
                effectiveDisable
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:text-cyan-300 hover:scale-[1.02]"
              )}
            >
              <span
                className={cn(
                  "pb-0.5 inline-block leading-tight font-medium transition-colors duration-300",
                  activeSection === item.target 
                    ? "text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 font-semibold" 
                    : "text-white/90"
                )}
              >
                {item.label}
              </span>
              <span
                className={cn(
                  "absolute left-0 right-0 -bottom-0.5 h-[2px] bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 origin-left transition-transform duration-300 rounded-full",
                  activeSection === item.target ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                )}
              />
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4 animate-fade-in delay-250 ml-auto md:ml-0">
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="default" className="bg-opacity-20 border-white/20 text-white w-10 h-10">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>

              <SheetContent side="right" className="bg-gradient-dark border border-white/10 text-white">
                {/* Header panel */}
                <div className="flex items-center justify-between mb-8">
                  <img
                    src={icon}
                    alt="CINESPHERE"
                    className="h-12 w-12 cursor-pointer drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                    onClick={() => navigator("/")}
                  />
                </div>

                {/* Danh mục */}
                <nav className="flex flex-col gap-5">
                  {navItems.map((item) => (
                    <button
                      key={item.target}
                      className={cn(
                        "text-left font-medium text-base tracking-[0.08em] uppercase transition-colors duration-300 whitespace-nowrap py-2",
                        effectiveDisable 
                          ? "opacity-50 cursor-not-allowed text-gray-400" 
                          : "text-white/90 hover:text-cyan-300"
                      )}
                      disabled={effectiveDisable}
                      onClick={() => {
                        if (!effectiveDisable) {
                          scrollToSection(item.target);
                        }
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>

                {/* Khối account bên dưới */}
                <div className="mt-10 border-t border-white/10 pt-4 space-y-2 text-sm">
                  {userName ? (
                    <>
                      <button
                        className="block w-full text-left"
                        onClick={() => navigator("/account")}
                      >
                        Tài khoản ({userName})
                      </button>
                      <button
                        className="block w-full text-left"
                        onClick={handleLogout}
                      >
                        Đăng xuất
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="block w-full text-left"
                        onClick={() => setIsLoginOpen(true)}
                      >
                        Đăng nhập
                      </button>
                      <button
                        className="block w-full text-left"
                        onClick={() => setIsRegisterOpen(true)}
                      >
                        Đăng ký
                      </button>
                      <button
                        className="block w-full text-left"
                        onClick={() => setIsForgetPassOpen(true)}
                      >
                        Quên mật khẩu
                      </button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {userName ? (
            <div className="hidden md:flex items-center">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-2.5 text-white font-medium hover:text-cyan-300 transition-colors duration-300">
                        <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:border-cyan-400 hover:bg-cyan-500/20 transition-all duration-300 shadow-lg">
                          <User className="h-5 w-5" />
                        </div>
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="center" className="bg-black/90 border border-white/20 text-white">
                    {(tooltipPrefix || "Chào") + ", " + (userName || "bạn")}
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent side="bottom" align="end" className="bg-black/90 border border-white/20 text-white">
                  <DropdownMenuItem onClick={() => navigator("/account")}>
                    Tài khoản
                  </DropdownMenuItem>
                  {extraMenuOptions.map((opt, idx) => (
                    <DropdownMenuItem key={`extra-${idx}`} onClick={opt.action}>
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
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
                  className="hidden md:inline-flex h-10 items-center text-white/90 hover:text-white transition-colors duration-300 font-medium text-[15px] px-5 rounded-lg hover:bg-white/10 backdrop-blur-sm whitespace-nowrap border border-white/10 hover:border-white/20"
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
          {!effectiveDisable && (
            <Button
              onClick={handleBookNow}
              className="hidden md:inline-flex bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-600 text-white font-normal text-sm md:text-base px-5 md:px-6 py-2.5 md:py-3 rounded-xl shadow-lg shadow-purple-500/30 transition-all duration-300 hover:scale-105 hover:shadow-purple-500/50 uppercase tracking-wider"
            >
              <Ticket className="h-5 w-5 mr-2" />
              <span>ĐẶT VÉ NGAY</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
