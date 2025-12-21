import { toast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";

export function useAuthHandlers(setUserName: (name: string | null) => void) {
    const navigator = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem("authUser");
    localStorage.removeItem("userProfile");
    setUserName(null);
    window.dispatchEvent(new Event("user-auth-changed"));
    navigator('/');
    toast({ title: "Đã đăng xuất" });
  };

  return { handleLogout };
}