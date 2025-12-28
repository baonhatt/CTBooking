import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import icon from "@/assets/images/icon.svg";
import { PASSWORD_PATTERN } from "./constants";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";


interface RegisterDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLogin: () => void;
  auth: any;
  setUserName: (name: string) => void;
  setErrorModal: (modal: { open: boolean; title: string; message: string }) => void;
}

export function RegisterDialog({
  isOpen,
  onOpenChange,
  onLogin,
  auth,
  setUserName,
  setErrorModal,
}: RegisterDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [nameError, setNameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [termsError, setTermsError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigator = useNavigate();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset errors
    setEmailError("");
    setNameError("");
    setPasswordError("");
    setConfirmError("");
    setTermsError("");
    setSubmitError("");

    // Validate email
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      setEmailError("Vui lòng nhập email hợp lệ");
      return;
    }

    // Validate name
    if (!name.trim()) {
      setNameError("Vui lòng nhập họ và tên");
      return;
    }

    // Validate password
    const passOk = PASSWORD_PATTERN.test(password);
    if (!passOk) {
      setPasswordError("Mật khẩu ít nhất 6 ký tự, gồm chữ và số");
      return;
    }

    // Validate confirm password
    if (password !== confirmPassword) {
      setConfirmError("Mật khẩu nhập lại không khớp");
      return;
    }

    // Validate terms
    if (!termsAccepted) {
      setTermsError("Vui lòng đồng ý điều khoản để tiếp tục");
      return;
    }

    try {
      setIsLoading(true);
      const data = await auth.register(email, password, name);

      if (data?.status === "success") {
        localStorage.setItem("authUser", JSON.stringify({ user: data.user }));

        try {
          const derivedName = data.user.username || (data.user.email || "").split("@")[0];
          const profile = {
            email: data.user.email,
            name: derivedName,
            phone: (data.user as any)?.phone || ""
          };
          localStorage.setItem("userProfile", JSON.stringify(profile));
        } catch { }

        setUserName(data.user.username);
        window.dispatchEvent(new Event("user-auth-changed"));
        toast.success("Đăng ký thành công", { description: data.user.email });

        // Reset form
        onOpenChange(false);
        setEmail("");
        setName("");
        setPassword("");
        setConfirmPassword("");
        setTermsAccepted(false);

        // Open login dialog
        onLogin();
      }
    } catch (err: any) {
      const msg = String(err?.message || "Đăng ký thất bại");
      if (msg.toLowerCase().includes("email")) {
        setEmailError(msg);
      } else {
        setSubmitError(msg);
      }
      setErrorModal({ open: true, title: "Đăng ký thất bại", message: msg });
    } finally {
      setIsLoading(false);
      navigator('/');
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset all states when closing
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setEmailError("");
      setPasswordError("");
      setConfirmError("")
      setSubmitError("");
      setShowPassword(false);
      setTermsAccepted(false)
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-gradient-to-br z-[9999] from-[#0b1226] via-[#0e1b3d] to-[#050915] border border-cyan-500/30 text-white shadow-[0_0_50px_rgba(59,130,246,0.3)]">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <img src={icon} alt="CINESPHERE" className="h-20 w-20" />
          </div>
          <DialogTitle className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 text-center">
            Đăng Ký Tài Khoản
          </DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {submitError && (
            <div className="rounded-md border border-yellow-500/70 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-300">
              {submitError}
            </div>
          )}

          {/* Email Input */}
          <div>
            <label className="text-sm text-gray-300 mb-1 block">Email</label>
            <Input
              type="email"
              className={cn(
                "bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 rounded-lg",
                emailError && "border-yellow-500 focus-visible:ring-yellow-500"
              )}
              placeholder="you@email.com"
              value={email}
              onChange={(e) => {
                const val = e.target.value;
                setEmail(val);
                const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
                if (ok) setEmailError("");
                else if (val.length > 0) setEmailError("Vui lòng nhập email hợp lệ");
                if (submitError) setSubmitError("");
              }}
              maxLength={50}
              disabled={isLoading}
              required
            />
            {emailError && (
              <div className="mt-1 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
                {emailError}
              </div>
            )}
          </div>

          {/* Name Input */}
          <div>
            <label className="text-sm text-gray-300 mb-1 block">Tên</label>
            <Input
              type="text"
              className={cn(
                "bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 rounded-lg",
                nameError && "border-yellow-500 focus-visible:ring-yellow-500"
              )}
              placeholder="Họ và tên"
              value={name}
              maxLength={50}
              onChange={(e) => {
                const val = e.target.value;
                setName(val);
                if (val.trim()) setNameError("");
                else setNameError("Vui lòng nhập họ và tên");
                if (submitError) setSubmitError("");
              }}
              disabled={isLoading}
              required
            />
            {nameError && (
              <div className="mt-1 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
                {nameError}
              </div>
            )}
          </div>

          {/* Password Input */}
          <div>
            <label className="text-sm text-gray-300 mb-1 block">Mật khẩu</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                className={cn(
                  "bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 rounded-lg pr-10",
                  passwordError && "border-yellow-500 focus-visible:ring-yellow-500"
                )}
                value={password}
                maxLength={50}
                onChange={(e) => {
                  const val = e.target.value;
                  setPassword(val);
                  const ok = PASSWORD_PATTERN.test(val);
                  if (ok) setPasswordError("");
                  else if (val.length > 0) setPasswordError("Mật khẩu ít nhất 6 ký tự, gồm chữ và số");
                  if (submitError) setSubmitError("");
                  if (confirmPassword && val === confirmPassword) setConfirmError("");
                }}
                autoComplete="new-password"
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordError && (
              <div className="mt-1 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
                {passwordError}
              </div>
            )}
          </div>

          {/* Confirm Password Input */}
          <div>
            <label className="text-sm text-gray-300 mb-1 block">Nhập Lại Mật khẩu</label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                className={cn(
                  "bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 rounded-lg pr-10",
                  confirmError && "border-yellow-500 focus-visible:ring-yellow-500"
                )}
                value={confirmPassword}
                maxLength={50}
                onChange={(e) => {
                  const val = e.target.value;
                  setConfirmPassword(val);
                  if (password && password === val) setConfirmError("");
                  else if (val.length > 0) setConfirmError("Mật khẩu nhập lại không khớp");
                }}
                autoComplete="new-password"
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                tabIndex={-1}
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmError && (
              <div className="mt-1 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
                {confirmError}
              </div>
            )}
          </div>

          {/* Terms Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={termsAccepted}
              onCheckedChange={(e) => {
                setTermsAccepted(e === true);
                if (e) setTermsError("");
              }}
              disabled={isLoading}
              required
              className="mt-0.5 sm:mt-1 border-white/40 data-[state=checked]:bg-blue-500 w-4 h-4 sm:w-5 sm:h-5"
            />
            <span className="text-[13px] leading-relaxed text-gray-400 group-hover:text-gray-200 transition-colors cursor-pointer select-none">
              Bằng việc đăng ký tài khoản, tôi đồng ý với Điều khoản dịch vụ và Chính sách bảo vệ của CTBooking.
            </span>
          </label>

          {termsError && (
            <div className="mt-1 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
              {termsError}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={
              isLoading ||
              !(email && name && password && confirmPassword && password === confirmPassword && termsAccepted)
            }
            className="w-full bg-gradient-to-r from-cyan-400 via-blue-600 to-fuchsia-500 hover:from-fuchsia-500 hover:via-cyan-400 hover:to-blue-600 text-white font-semibold shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_40px_rgba(236,72,153,0.6)]"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang đăng ký...
              </span>
            ) : (
              "Đăng ký"
            )}
          </Button>

          {/* Login Link */}
          <div className="flex justify-center">
            <Button
              variant="link"
              className="text-sm text-cyan-300 hover:text-cyan-200"
              type="button"
              onClick={onLogin}
            >
              Đã có tài khoản? Đăng nhập
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}