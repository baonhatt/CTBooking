import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function SuccessPayment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Lấy tất cả query params từ URL và redirect về /checkout với các params đó
    const params = new URLSearchParams();
    
    // Copy tất cả params từ URL hiện tại
    searchParams.forEach((value, key) => {
      params.set(key, value);
    });

    // Redirect về /checkout với tất cả query params
    const queryString = params.toString();
    navigate(`/checkout${queryString ? `?${queryString}` : ""}`, { replace: true });
  }, [navigate, searchParams]);

  // Hiển thị loading trong khi redirect
  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white text-lg">Đang xử lý thanh toán...</p>
      </div>
    </div>
  );
}

