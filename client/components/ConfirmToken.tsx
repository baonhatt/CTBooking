import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { resetPasswordApi } from "@/lib/api";

export default function ConfirmToken() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { token } = useParams();
  const navigate = useNavigate();

  const handleResetPassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        title: "Mật khẩu không khớp",
        description: "Vui lòng kiểm tra lại.",
      });
      return;
    }
    try {
      const response = await resetPasswordApi({ token, newPassword });
      if (response.status === "success") {
        toast({ title: "Thông báo hệ thống!", description: response.message });
        navigate("/");
      }
    } catch (err: any) {
      toast({ title: "Thông báo hệ thống!", description: err.message });
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
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            pattern="^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$"
            title="Mật khẩu phải có ít nhất 6 ký tự, bao gồm cả chữ cái và số"
          />
        </div>
        <div>
          <label className="text-sm text-gray-300 mb-1 block">
            Xác nhận mật khẩu mới
          </label>
          <Input
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            pattern="^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$"
            title="Mật khẩu phải có ít nhất 6 ký tự, bao gồm cả chữ cái và số"
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
