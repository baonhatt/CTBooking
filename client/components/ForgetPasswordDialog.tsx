import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import icon from "@/assets/images/icon.svg";
import { toast } from "sonner";

interface ForgetPasswordDialogProps {
        isOpen: boolean;
        onOpenChange: (open: boolean) => void;
        onBackToLogin: () => void;
        auth: any;
}

export function ForgetPasswordDialog({
        isOpen,
        onOpenChange,
        onBackToLogin,
        auth,
}: ForgetPasswordDialogProps) {
        const [isLoading, setIsLoading] = useState(false);
        const [email, setEmail] = useState("");
        const [emailError, setEmailError] = useState("");
        const [submitError, setSubmitError] = useState("");

        const handleSubmit = async (e: React.FormEvent) => {
                e.preventDefault();
                setEmailError("");
                setSubmitError("");

                // Validate email
                const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                if (!emailOk) {
                        setEmailError("Vui lòng nhập email hợp lệ");
                        return;
                }

                try {
                        setIsLoading(true);
                        const data = await auth.forgetPass(email);

                        if (data?.status === "success") {
                                onOpenChange(false);
                                setEmail("");
                                toast.success("Đổi mật khẩu thành công!", { description: data.message });
                        }
                } catch (err: any) {
                        setSubmitError(String(err?.message || "Yêu cầu thất bại"));
                } finally {
                        setIsLoading(false);
                }
        };

        return (
                <Dialog open={isOpen} onOpenChange={onOpenChange}>
                        <DialogContent className="bg-gradient-to-br from-[#0b1226] via-[#0e1b3d] to-[#050915] border border-cyan-500/30 text-white shadow-[0_0_50px_rgba(59,130,246,0.3)]">
                                <DialogHeader>
                                        <div className="flex justify-center mb-4">
                                                <img src={icon} alt="CINESPHERE" className="h-20 w-20" />
                                        </div>
                                        <DialogTitle className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 text-center">
                                                QUÊN MẬT KHẨU
                                        </DialogTitle>
                                </DialogHeader>

                                <form className="space-y-4" onSubmit={handleSubmit}>
                                        {/* Email Input */}
                                        <div>
                                                <label className="text-sm text-gray-300 mb-1 block">Email</label>
                                                <Input
                                                        type="email"
                                                        className={cn(
                                                                "bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 rounded-lg",
                                                                emailError && "border-yellow-500 focus-visible:ring-yellow-500",
                                                        )}
                                                        placeholder="you@gmail.com"
                                                        value={email}
                                                        onChange={(e) => {
                                                                const val = e.target.value;
                                                                setEmail(val);
                                                                const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
                                                                if (ok) setEmailError("");
                                                                else if (val.length > 0)
                                                                        setEmailError("Vui lòng nhập email hợp lệ");
                                                                if (submitError) setSubmitError("");
                                                        }}
                                                        maxLength={50}
                                                        title="Vui lòng nhập email của bạn để thay đổi mật khẩu!"
                                                        disabled={isLoading}
                                                        required
                                                />
                                                {emailError && (
                                                        <div className="mt-1 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
                                                                {emailError}
                                                        </div>
                                                )}
                                        </div>

                                        {/* Submit Error */}
                                        {submitError && (
                                                <div className="rounded-md border border-yellow-500/70 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-300">
                                                        {submitError}
                                                </div>
                                        )}

                                        {/* Submit Button */}
                                        <Button
                                                type="submit"
                                                disabled={isLoading}
                                                className="w-full bg-gradient-to-r from-cyan-400 via-blue-600 to-fuchsia-500 hover:from-fuchsia-500 hover:via-cyan-400 hover:to-blue-600 text-white font-semibold shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_40px_rgba(236,72,153,0.6)]"
                                        >
                                                {isLoading ? (
                                                        <span className="flex items-center justify-center gap-2">
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                Đang gửi...
                                                        </span>
                                                ) : (
                                                        "Xác Nhận"
                                                )}
                                        </Button>

                                        {/* Back to Login Link */}
                                        <div className="flex justify-center">
                                                <Button
                                                        variant="link"
                                                        className="text-sm text-cyan-300 hover:text-cyan-200"
                                                        type="button"
                                                        onClick={onBackToLogin}
                                                >
                                                        Quay lại đăng nhập!
                                                </Button>
                                        </div>
                                </form>
                        </DialogContent>
                </Dialog>
        );
}
