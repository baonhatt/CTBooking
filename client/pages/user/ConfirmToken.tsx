import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { resetPasswordApi } from "@/lib/api/auth";

export default function ConfirmToken() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  const validatePassword = (password: string) => {
    const regex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
    return regex.test(password);
  };

  const handleResetPassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePassword(newPassword)) {
      toast.error("Mật khẩu không hợp lệ", {
        description: "Mật khẩu phải có ít nhất 6 ký tự, bao gồm cả chữ cái và số",
      });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu không khớp", {
        description: "Vui lòng kiểm tra lại.",
      });
      return;
    }
    
    try {
      const response = await resetPasswordApi({ token, newPassword });
      if (response.status === "success") {
        toast.success("Thông báo hệ thống!", { description: response.message });
        navigate("/");
      }
    } catch (err: any) {
      toast.error("Lỗi đặt lại mật khẩu", { 
        description: err.message || "Đã xảy ra lỗi, vui lòng thử lại.",
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-dark">
      <form
        className="bg-black/80 p-6 rounded-lg shadow-md space-y-4 w-full max-w-md"
        onSubmit={handleResetPassSubmit}
      >
        <h1 className="text-xl text-blue-400 font-bold text-center">
          Đặt lại mật khẩu
        </h1>
        <div>
          <label className="text-sm text-gray-300 mb-1 block">
            Mật khẩu mới
          </label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm text-gray-300 mb-1 block">
            Xác nhận mật khẩu mới
          </label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <Button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
        >
          Xác nhận
        </Button>
      </form>
    </div>
  );
}