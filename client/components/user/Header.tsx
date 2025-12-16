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
import { Ticket, Loader2, Menu, User, Eye, EyeOff, X } from "lucide-react";
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
  SheetClose,
} from "@/components/ui/sheet";

export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-\=\[\]{};':"\\|,.<>\/?]{6,}$/;

interface HeaderProps {
  onBookClick?: () => void;
  disableNav?: boolean;
  tooltipPrefix?: string;
  extraMenuOptions?: Array<{ label: string; action: () => void }>;
  forceDark?: boolean;
}

export default function Header({ onBookClick = () => { }, disableNav = false, tooltipPrefix, extraMenuOptions = [], forceDark = false }: HeaderProps) {
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
  const [loginEmailError, setLoginEmailError] = useState<string>("");
  const [loginPasswordError, setLoginPasswordError] = useState<string>("");
  const [loginSubmitError, setLoginSubmitError] = useState<string>("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerTerms, setRegisterTerms] = useState(false);
  const [registerEmailError, setRegisterEmailError] = useState<string>("");
  const [registerNameError, setRegisterNameError] = useState<string>("");
  const [registerPasswordError, setRegisterPasswordError] = useState<string>("");
  const [registerConfirmError, setRegisterConfirmError] = useState<string>("");
  const [registerTermsError, setRegisterTermsError] = useState<string>("");
  const [registerSubmitError, setRegisterSubmitError] = useState<string>("");
  const [forgetPassEmail, setForgetPassEmail] = useState("");
  const [forgetPassEmailError, setForgetPassEmailError] = useState<string>("");
  const [forgetSubmitError, setForgetSubmitError] = useState<string>("");
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
    { label: "Giá vé", target: "promotions" },
    { label: "Công nghệ", target: "technology" },
    { label: "Cửa hàng", target: "store" },
  ];

  useEffect(() => {
    if (effectiveDisable) return;
    const ids = ["hero", "films", "pricing", "technology", "promotions", "store"];
    const updateActive = () => {
      const headerEl = document.querySelector("header") as HTMLElement | null;
      const headerOffset = headerEl?.offsetHeight || 72;
      const sections = ids
        .map((id) => {
          const el = document.getElementById(id);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return { id, top: rect.top };
        })
        .filter(Boolean) as Array<{ id: string; top: number }>;
      if (!sections.length) return;
      const above = sections.filter((s) => s.top <= headerOffset + 10);
      const activeId = above.length
        ? above.sort((a, b) => b.top - a.top)[0].id
        : sections.sort((a, b) => a.top - b.top)[0].id;
      setActiveSection(activeId);
    };
    updateActive();
    window.addEventListener("scroll", updateActive);
    window.addEventListener("resize", updateActive);
    return () => {
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
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
    setLoginEmailError("");
    setLoginPasswordError("");
    setLoginSubmitError("");
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail);
    if (!emailOk) {
      setLoginEmailError("Vui lòng nhập email hợp lệ");
      return;
    }
    const passOk = PASSWORD_PATTERN.test(loginPassword);
    if (!passOk) {
      setLoginPasswordError("Mật khẩu ít nhất 6 ký tự gồm chữ và số");
      return;
    }
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
      const msg = String(err?.message || "");
      if (msg.toLowerCase().includes("email")) {
        setLoginEmailError(msg);
      } else if (msg.toLowerCase().includes("mật khẩu") || msg.toLowerCase().includes("password")) {
        setLoginPasswordError(msg);
      } else {
        setLoginSubmitError(msg || "Đăng nhập thất bại");
      }
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
    setRegisterEmailError("");
    setRegisterNameError("");
    setRegisterPasswordError("");
    setRegisterConfirmError("");
    setRegisterTermsError("");
    setRegisterSubmitError("");
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerEmail);
    if (!emailOk) {
      setRegisterEmailError("Vui lòng nhập email hợp lệ");
      return;
    }
    const nameOk = !!registerName.trim();
    if (!nameOk) {
      setRegisterNameError("Vui lòng nhập họ và tên");
      return;
    }
    const passOk = PASSWORD_PATTERN.test(registerPassword);
    if (!passOk) {
      setRegisterPasswordError("Mật khẩu ít nhất 6 ký tự, gồm chữ và số");
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      setRegisterConfirmError("Mật khẩu nhập lại không khớp");
      return;
    }
    if (!registerTerms) {
      setRegisterTermsError("Vui lòng đồng ý điều khoản để tiếp tục");
      return;
    }
    try {
      setIsRegisterLoading(true);
      const data = await auth.register(
        registerEmail,
        registerPassword,
        registerName
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
        setRegisterTerms(false);
        setIsLoginOpen(true);
      }
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.toLowerCase().includes("email")) {
        setRegisterEmailError(msg);
      } else {
        setRegisterSubmitError(msg || "Đăng ký thất bại");
      }
    } finally {
      setIsRegisterLoading(false);
    }
  };
  const handleForgetPassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgetPassEmailError("");
    setForgetSubmitError("");
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgetPassEmail);
    if (!emailOk) {
      setForgetPassEmailError("Vui lòng nhập email hợp lệ");
      return;
    }
    try {
      setIsForgetLoading(true);
      const data = await auth.forgetPass(forgetPassEmail);
      if (data?.status === "success") {
        setIsForgetPassOpen(false);
        setForgetPassEmail("");
      }
    } catch (err: any) {
      setForgetSubmitError(String(err?.message || "Yêu cầu thất bại"));
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
    if (!element) return;
    const headerEl = document.querySelector("header") as HTMLElement | null;
    const headerOffset = headerEl?.offsetHeight || 72;
    const rect = element.getBoundingClientRect();
    const absoluteTop = window.scrollY + rect.top;
    window.scrollTo({ top: Math.max(0, absoluteTop - headerOffset), behavior: "smooth" });
  };

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        forceDark
          ? "bg-black/95 backdrop-blur-lg border-b border-white/10 shadow-[0_10px_40px_rgba(67,97,238,0.15)]"
          : isScrolled
            ? "bg-black/80 backdrop-blur-lg border-b border-white/10 shadow-[0_10px_40px_rgba(67,97,238,0.15)]"
            : "bg-gradient-to-b from-black/80 via-black/60 to-transparent border-b border-white/10",
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

              <SheetContent side="top" className="w-full h-[100dvh] bg-[#050915] border-none text-white p-0 [&>button]:hidden z-[60]">
                <div className="flex flex-col h-full p-6 sm:p-8">
                  {/* Header panel */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3" onClick={() => navigator("/")}>
                      <img
                        src={icon}
                        alt="CINESPHERE"
                        className="h-16 w-16 cursor-pointer drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                      />
                    </div>
                    
                    <SheetClose className="rounded-full p-2 border border-white/20 hover:bg-white/10 hover:border-white transition-all duration-300">
                      <X className="h-8 w-8 text-white" />
                      <span className="sr-only">Close</span>
                    </SheetClose>
                  </div>

                  {/* Danh mục */}
                  <nav className="flex flex-col gap-2 flex-1 overflow-y-auto">
                    {navItems.map((item) => (
                      <SheetClose key={item.target} asChild>
                        <button
                          className={cn(
                            "text-left font-medium text-lg tracking-wide transition-colors duration-300 py-3 border-b border-white/5",
                            effectiveDisable 
                              ? "opacity-50 cursor-not-allowed text-gray-400" 
                              : "text-white hover:text-cyan-300"
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
                      </SheetClose>
                    ))}
                    
                    {userName && (
                        <SheetClose asChild>
                          <button
                              className="text-left font-medium text-lg tracking-wide transition-colors duration-300 py-3 border-b border-white/5 text-white hover:text-cyan-300"
                              onClick={() => navigator("/account")}
                          >
                              Tài khoản ({userName})
                          </button>
                        </SheetClose>
                    )}
                  </nav>

                  {/* Khối account bên dưới */}
                  <div className="mt-auto pt-8">
                    {userName ? (
                      <SheetClose asChild>
                        <Button
                          className="w-full h-12 text-base font-semibold rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg"
                          onClick={handleLogout}
                        >
                          Đăng xuất
                        </Button>
                      </SheetClose>
                    ) : (
                      <div className="grid gap-3">
                         <SheetClose asChild>
                            <Button
                              className="w-full h-12 text-base font-semibold rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                              onClick={() => setIsLoginOpen(true)}
                            >
                              Đăng nhập
                            </Button>
                         </SheetClose>
                         <SheetClose asChild>
                            <Button
                              variant="outline"
                              className="w-full h-12 text-base font-semibold rounded-full bg-white border-white text-black hover:bg-gray-100 hover:text-black"
                              onClick={() => setIsRegisterOpen(true)}
                            >
                              Đăng ký
                            </Button>
                         </SheetClose>
                      </div>
                    )}
                  </div>
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
              <DialogContent className="bg-gradient-to-br from-[#0b1226] via-[#0e1b3d] to-[#050915] border border-cyan-500/30 text-white shadow-[0_0_50px_rgba(59,130,246,0.3)]">
                <DialogHeader>
                  <div className="flex justify-center mb-4">
                    <img
                      src={icon}
                      alt="CINESPHERE"
                      className="h-20 w-20"
                    />
                  </div>
                  <DialogTitle className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 text-center">Đăng Nhập Tài Khoản</DialogTitle>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleLoginSubmit}>
                  {loginSubmitError && (
                    <div className="rounded-md border border-yellow-500/70 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-300">
                      {loginSubmitError}
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-gray-300 mb-1 block">
                      Email
                    </label>
                    <Input
                      type="email"
                      className={cn(
                        "bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 rounded-lg",
                        loginEmailError && "border-yellow-500 focus-visible:ring-yellow-500"
                      )}
                      value={loginEmail}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLoginEmail(val);
                        const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
                        if (ok) setLoginEmailError("");
                        else if (val.length > 0) setLoginEmailError("Vui lòng nhập email hợp lệ");
                        if (loginSubmitError) setLoginSubmitError("");
                      }}
                      onInput={(e) => setLoginEmail((e.target as HTMLInputElement).value)}
                      maxLength={50}
                      autoComplete="email"
                      name="email"
                      disabled={isLoginLoading}
                      required
                    />
                    {loginEmailError && (
                      <div className="mt-1 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
                        {loginEmailError}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-gray-300 mb-1 block">
                      Mật khẩu
                    </label>
                    <div className="relative">
                    <Input
                      type={showLoginPass ? "text" : "password"}
                      className={cn(
                        "bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 rounded-lg pr-10",
                        loginPasswordError && "border-yellow-500 focus-visible:ring-yellow-500"
                      )}
                      value={loginPassword}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLoginPassword(val);
                        const ok = PASSWORD_PATTERN.test(val);
                        if (ok) setLoginPasswordError("");
                        else if (val.length > 0) setLoginPasswordError("Mật khẩu ít nhất 6 ký tự gồm chữ và số");
                        if (loginSubmitError) setLoginSubmitError("");
                      }}
                      onInput={(e) => setLoginPassword((e.target as HTMLInputElement).value)}
                      required
                      maxLength={50}
                      autoComplete="current-password"
                      name="password"
                      disabled={isLoginLoading}
                    />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
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
                    {loginPasswordError && (
                      <div className="mt-1 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
                        {loginPasswordError}
                      </div>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoginLoading}
                    className="w-full bg-gradient-to-r from-cyan-400 via-blue-600 to-fuchsia-500 hover:from-fuchsia-500 hover:via-cyan-400 hover:to-blue-600 text-white font-semibold shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_40px_rgba(236,72,153,0.6)]"
                  >
                    {isLoginLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Đang đăng nhập...
                      </span>
                    ) : (
                      "ĐĂNG NHẬP"
                    )}
                  </Button>
                  <div className="flex justify-between items-center">
                    <div></div>
                    <Button
                      variant="link"
                      className="text-sm text-cyan-300 hover:text-cyan-200"
                      type="button"
                      onClick={() => {
                        openForgetPass();
                      }}
                    >
                      Quên mật khẩu?
                    </Button>
                  </div>
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="link"
                      className="text-sm text-cyan-300 hover:text-cyan-200 pt-6"
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
            <DialogContent className="bg-gradient-to-br from-[#0b1226] via-[#0e1b3d] to-[#050915] border border-cyan-500/30 text-white shadow-[0_0_50px_rgba(59,130,246,0.3)]">
              <DialogHeader>
                <div className="flex justify-center mb-4">
                  <img
                    src={icon}
                    alt="CINESPHERE"
                    className="h-20 w-20"
                  />
                </div>
                <DialogTitle className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 text-center">
                  Đăng Ký Tài Khoản
                </DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleRegisterSubmit}>
                {registerSubmitError && (
                  <div className="rounded-md border border-yellow-500/70 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-300">
                    {registerSubmitError}
                  </div>
                )}
                <div>
                  <label className="text-sm text-gray-300 mb-1 block">
                    Email
                  </label>
                  <Input
                    type="email"
                    className={cn(
                      "bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 rounded-lg",
                      registerEmailError && "border-yellow-500 focus-visible:ring-yellow-500"
                    )}
                    placeholder="you@email.com"
                    value={registerEmail}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRegisterEmail(val);
                      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
                      if (ok) setRegisterEmailError("");
                      else if (val.length > 0) setRegisterEmailError("Vui lòng nhập email hợp lệ");
                      if (registerSubmitError) setRegisterSubmitError("");
                    }}
                    maxLength={50}
                    disabled={isRegisterLoading}
                    required
                  />
                  {registerEmailError && (
                    <div className="mt-1 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
                      {registerEmailError}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-1 block">
                    Tên
                  </label>
                  <Input
                    type="text"
                    className={cn(
                      "bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 rounded-lg",
                      registerNameError && "border-yellow-500 focus-visible:ring-yellow-500"
                    )}
                    placeholder="Họ và tên"
                    value={registerName}
                    maxLength={50}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRegisterName(val);
                      if (val.trim()) setRegisterNameError("");
                      else setRegisterNameError("Vui lòng nhập họ và tên");
                      if (registerSubmitError) setRegisterSubmitError("");
                    }}
                    disabled={isRegisterLoading}
                    required
                  />
                  {registerNameError && (
                    <div className="mt-1 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
                      {registerNameError}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-1 block">
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <Input
                      type={showRegisterPass ? "text" : "password"}
                      className={cn(
                        "bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 rounded-lg pr-10",
                        registerPasswordError && "border-yellow-500 focus-visible:ring-yellow-500"
                      )}
                      value={registerPassword}
                      maxLength={50}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRegisterPassword(val);
                      const ok = PASSWORD_PATTERN.test(val);
                      if (ok) setRegisterPasswordError("");
                      else if (val.length > 0) setRegisterPasswordError("Mật khẩu ít nhất 6 ký tự, gồm chữ và số");
                      if (registerSubmitError) setRegisterSubmitError("");
                      if (registerConfirmPassword && val === registerConfirmPassword) setRegisterConfirmError("");
                    }}
                      required
                      onInput={(e) => setRegisterPassword((e.target as HTMLInputElement).value)}
                      autoComplete="new-password"
                      name="new-password"
                      disabled={isRegisterLoading}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      tabIndex={-1}
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
                  {registerPasswordError && (
                    <div className="mt-1 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
                      {registerPasswordError}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-1 block">
                    Nhập Lại Mật khẩu
                  </label>
                  <div className="relative">
                    <Input
                      type={showRegisterConfirmPass ? "text" : "password"}
                      className={cn(
                        "bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 rounded-lg pr-10",
                        registerConfirmError && "border-yellow-500 focus-visible:ring-yellow-500"
                      )}
                      value={registerConfirmPassword}
                      maxLength={50}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRegisterConfirmPassword(val);
                      if (registerPassword && registerPassword === val) setRegisterConfirmError("");
                      else if (val.length > 0) setRegisterConfirmError("Mật khẩu nhập lại không khớp");
                    }}
                      required
                      onInput={(e) => setRegisterConfirmPassword((e.target as HTMLInputElement).value)}
                      autoComplete="new-password"
                      name="confirm-password"
                      disabled={isRegisterLoading}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      tabIndex={-1}
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
                  {registerConfirmError && (
                    <div className="mt-1 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
                      {registerConfirmError}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={registerTerms}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setRegisterTerms(checked);
                      if (checked) setRegisterTermsError("");
                    }}
                    disabled={isRegisterLoading}
                    required
                    className="h-4 w-4"
                  />
                  <span className="text-xs text-gray-300 leading-5">
                    Bằng việc đăng ký tài khoản, tôi đồng ý với Điều khoản dịch vụ và Chính sách bảo vệ của CTBooking.
                  </span>
                </div>
                {registerTermsError && (
                  <div className="mt-1 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
                    {registerTermsError}
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={
                    isRegisterLoading ||
                    !(
                      registerEmail &&
                      registerName &&
                      registerPassword &&
                      registerConfirmPassword &&
                      registerPassword === registerConfirmPassword &&
                      registerTerms
                    )
                  }
                  className="w-full bg-gradient-to-r from-cyan-400 via-blue-600 to-fuchsia-500 hover:from-fuchsia-500 hover:via-cyan-400 hover:to-blue-600 text-white font-semibold shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_40px_rgba(236,72,153,0.6)]"
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
                    className="text-sm text-cyan-300 hover:text-cyan-200"
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
            <DialogContent className="bg-gradient-to-br from-[#0b1226] via-[#0e1b3d] to-[#050915] border border-cyan-500/30 text-white shadow-[0_0_50px_rgba(59,130,246,0.3)]">
              <DialogHeader>
                <DialogTitle className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 text-center">
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
                    className={cn(
                      "bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 rounded-lg",
                      forgetPassEmailError && "border-yellow-500 focus-visible:ring-yellow-500"
                    )}
                    placeholder="you@gmail.com"
                    value={forgetPassEmail}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForgetPassEmail(val);
                      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
                      if (ok) setForgetPassEmailError("");
                      else if (val.length > 0) setForgetPassEmailError("Vui lòng nhập email hợp lệ");
                      if (forgetSubmitError) setForgetSubmitError("");
                    }}
                    maxLength={50}
                    title="Vui lòng nhập email của bạn để thay đổi mật khẩu!"
                    disabled={isForgetLoading}
                    required
                  />
                  {!!forgetPassEmailError && (
                    <div className="mt-1 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
                      {forgetPassEmailError}
                    </div>
                  )}
                </div>
                {!!forgetSubmitError && (
                  <div className="rounded-md border border-yellow-500/70 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-300">
                    {forgetSubmitError}
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={isForgetLoading}
                  className="w-full bg-gradient-to-r from-cyan-400 via-blue-600 to-fuchsia-500 hover:from-fuchsia-500 hover:via-cyan-400 hover:to-blue-600 text-white font-semibold shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_40px_rgba(236,72,153,0.6)]"
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
                    className="text-sm text-cyan-300 hover:text-cyan-200"
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
          
        </div>
      </div>
    </header>
  );
}
