import { useEffect, useMemo, useState } from "react";
import UserLayout from "@/user/layouts/UserLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import {
  updateUserProfileApi,
  changePasswordApi,
  getUserTransactionsApi,
  getUserProfileByEmailApi,
} from "@/lib/api";
import heroImage1 from "@/assets/images/1.PNG";
import { DatePicker } from "antd";
import dayjs from "dayjs";

export default function Account() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{
    name: string;
    phone: string;
    email: string;
    gender?: string;
    dob?: string;
  }>({ name: "", phone: "", email: "", gender: "", dob: "" });
  const [isPwdOpen, setIsPwdOpen] = useState(false);
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [tab, setTab] = useState<"history" | "info">("history");
  const pageSize = 5;
  const [detailCountdown, setDetailCountdown] = useState<string | null>(null);
  const PAYMENT_METHODS_DISPLAY: Record<string, string> = {
    momo: "Ví MoMo",
    vnpay: "VNPay",
    vietqr: "Chuyển khoản VietQR",
    card: "Thẻ ngân hàng",
  };

  const getMovieCountFromCombo = (comboStr: string) => {
    try {
      if (!comboStr) return 0;
      const comboArray = JSON.parse(comboStr);
      return Array.isArray(comboArray) ? comboArray.length : 0;
    } catch (error) {
      console.error("Lỗi parse combo:", error);
      return 0;
    }
  };
  const handleCopy = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      // Bạn có thể thay bằng toast.success nếu có thư viện toast
      alert("Đã sao chép nội dung: " + text);
    } catch (err) {
      console.error("Lỗi copy:", err);
    }
  };

  const parseData = (data: any) => {
    try {
      return typeof data === "string" ? JSON.parse(data) : data;
    } catch {
      return [];
    }
  };

  const formatDateTime = (dateStr: any) => {
    if (!dateStr) return "--";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);

      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      const hour = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");

      return `${day}/${month}/${year} ${hour}:${min}`;
    } catch {
      return String(dateStr);
    }
  };

  useEffect(() => {
    const authRaw = localStorage.getItem("authUser");
    if (!authRaw) {
      toast({ title: "Vui lòng đăng nhập trước!" });
      window.dispatchEvent(new Event("open-login"));
      navigate("/", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("userProfile");
      const authRaw = localStorage.getItem("authUser");
      let email = "";
      let name = "";
      let phone = "";
      let gender = "";
      let dob = "";
      if (authRaw) {
        try {
          const parsed = JSON.parse(authRaw);
          email = parsed?.user?.email || parsed?.email || email;
          name = parsed?.user?.username || parsed?.username || name;
          phone = (parsed?.user as any)?.phone || phone;
        } catch {}
      }
      if (raw) {
        try {
          const p = JSON.parse(raw);
          email = p?.email || email;
          name = p?.name || name;
          phone = p?.phone || phone;
          gender = p?.gender || gender;
          dob = p?.dob || dob;
        } catch {}
      }
      setProfile({
        name: name || "",
        phone: phone || "",
        email: email || "",
        gender: gender || "",
        dob: dob || "",
      });
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const email = profile.email;
        if (!email) return;
        const data = await getUserProfileByEmailApi(email);
        const dobStr = (() => {
          try {
            if (!data?.dob) return "";
            const d = new Date(data.dob as any);
            if (isNaN(d.getTime())) return String(data.dob);
            return d.toISOString().slice(0, 10);
          } catch {
            return "";
          }
        })();
        setProfile((p) => ({
          ...p,
          name: data?.fullname || p.name || "",
          phone: data?.phone || p.phone || "",
          email: data?.email || p.email || "",
          gender: (data?.gender as any) || p.gender || "",
          dob: dobStr || p.dob || "",
        }));
      } catch (e: any) {
        // silent
      }
    })();
  }, [profile.email]);

  useEffect(() => {
    (async () => {
      try {
        setIsLoadingTx(true);
        const email = profile.email;
        if (!email) return;
        const { items } = await getUserTransactionsApi({
          email,
          status: "paid",
        });
        console.log(items);
        const mapped =
          (items || []).map((t: any) => ({
            ...t,
            poster:
              t?.poster || t?.cover_image || t?.coverImage || t?.poster_url,
            date: (() => {
              try {
                const src = t?.paid_at || t?.created_at;
                return src ? new Date(src) : null;
              } catch {
                return null;
              }
            })(),
            dateDisplay: (() => {
              try {
                const dsrc = t?.paid_at || t?.created_at;
                if (!dsrc) return "";
                const d = new Date(dsrc);
                const dd = String(d.getDate()).padStart(2, "0");
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                const yyyy = d.getFullYear();
                const hh = String(d.getHours()).padStart(2, "0");
                const min = String(d.getMinutes()).padStart(2, "0");
                return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
              } catch {
                return "";
              }
            })(),
          })) || [];
        setTransactions(mapped);
      } catch (e: any) {
        console.error(e);
      } finally {
        setIsLoadingTx(false);
      }
    })();
  }, [profile.email]);

  useEffect(() => {
    setCurrentPage(1);
  }, [transactions]);

  useEffect(() => {
    const readHash = () => {
      const hash = (window.location.hash || "").replace("#", "").toLowerCase();
      if (hash === "profile" || hash === "info") setTab("info");
      else if (hash === "transaction" || hash === "history") setTab("history");
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  useEffect(() => {
    if (!isDetailOpen) {
      setDetailCountdown(null);
      return;
    }
    const expirySrc = selectedTx?.expiry_date;
    const expired = Boolean(selectedTx?.expired);
    const isUsed = Boolean(selectedTx?.is_used);
    if (!expirySrc || expired || isUsed) {
      setDetailCountdown(null);
      return;
    }
    let expiry = 0;
    try {
      expiry = new Date(expirySrc as any).getTime();
    } catch {
      expiry = 0;
    }
    if (!expiry) {
      setDetailCountdown(null);
      return;
    }
    const update = () => {
      const now = Date.now();
      const diff = Math.max(0, expiry - now);
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setDetailCountdown(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [
    isDetailOpen,
    selectedTx?.expiry_date,
    selectedTx?.expired,
    selectedTx?.is_used,
  ]);

  const handleTabChange = (val: string) => {
    const value = val === "info" ? "info" : "history";
    setTab(value);
    const targetHash = value === "info" ? "#profile" : "#transaction";
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, "", targetHash);
    }
  };

  const limitedTransactions = useMemo(() => {
    return (transactions || []).slice(0, 20);
  }, [transactions]);

  const pagedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return limitedTransactions.slice(start, start + pageSize);
  }, [limitedTransactions, currentPage]);

  const totalPages = useMemo(() => {
    const total = Math.ceil(limitedTransactions.length / pageSize);
    return total || 1;
  }, [limitedTransactions]);

  const groups = useMemo(() => {
    const toMonthKey = (t: any) => {
      try {
        const src = t?.paid_at || t?.created_at;
        if (!src) return "Khác";
        const d = new Date(src);
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `Tháng ${mm}/${yyyy}`;
      } catch {
        return "Khác";
      }
    };
    const map = new Map<string, any[]>();
    pagedTransactions?.forEach((t) => {
      const key = toMonthKey(t);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    const arr = Array.from(map.entries()).map(([month, items]) => ({
      month,
      items,
    }));
    return arr.sort((a, b) => b.month.localeCompare(a.month));
  }, [pagedTransactions]);

  const getBookingCode = (tx: any | null) =>
    tx?.booking_code ||
    tx?.bookingCode ||
    tx?.code ||
    tx?.bookingCodeEmail ||
    "--";

  const formatMoney = (value: number | string | undefined) => {
    const num = Number(value || 0);
    return num.toLocaleString("vi-VN");
  };

  const getPoster = (tx: any | null) =>
    tx?.cover_image ||
    tx?.coverImage ||
    tx?.poster ||
    tx?.poster_url ||
    tx?.thumbnail ||
    tx?.image ||
    "";

  const handleSaveProfile = async () => {
    try {
      await updateUserProfileApi({
        email: profile.email,
        name: profile.name,
        phone: profile.phone,
        gender: profile.gender,
        dob: profile.dob,
      });
      const p = {
        email: profile.email,
        name: profile.name,
        phone: profile.phone,
        gender: profile.gender,
        dob: profile.dob,
      };
      localStorage.setItem("userProfile", JSON.stringify(p));
      const authRaw = localStorage.getItem("authUser");
      if (authRaw) {
        try {
          const parsed = JSON.parse(authRaw);
          if (parsed?.user) {
            parsed.user.username = profile.name || parsed.user.username;
            (parsed.user as any).phone =
              profile.phone || (parsed.user as any).phone;
          }
          localStorage.setItem("authUser", JSON.stringify(parsed));
        } catch {}
      }
      window.dispatchEvent(new Event("user-auth-changed"));
      toast({ title: "Cập nhật thành công" });
    } catch (e: any) {
      toast({ title: "Cập nhật thất bại", description: e?.message || "" });
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPwd || newPwd !== confirmPwd) {
      toast({ title: "Mật khẩu mới không khớp" });
      return;
    }
    try {
      await changePasswordApi({
        email: profile.email,
        oldPassword: oldPwd,
        newPassword: newPwd,
      });
      toast({ title: "Đã cập nhật mật khẩu" });
      setIsPwdOpen(false);
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (e: any) {
      toast({ title: "Đổi mật khẩu thất bại", description: e?.message || "" });
    }
  };

  return (
    <UserLayout
      className="bg-gradient-to-br from-[#050915] via-[#0b1226] to-[#0e1b3d]"
      headerProps={{ onBookClick: () => {} }}
      hideFooter
    >
      <div className="relative min-h-screen">
        <div className="absolute inset-0 pointer-events-none z-0">
          <img
            src={heroImage1}
            alt=""
            className="w-full h-full object-cover opacity-40"
            style={{
              filter: `brightness(${Number((import.meta as any).env?.VITE_BACKDROP_BRIGHTNESS ?? 0.85)}) blur(${Number((import.meta as any).env?.VITE_BACKDROP_BLUR ?? 2)}px)`,
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.35),transparent_30%),radial-gradient(circle_at_80%_30%,rgba(236,72,153,0.25),transparent_35%),radial-gradient(circle_at_50%_70%,rgba(34,211,238,0.3),transparent_30%)]" />
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: `rgba(0,0,0,${Number((import.meta as any).env?.VITE_BACKDROP_DARK_BASE ?? 0.5)})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/25 to-transparent" />
          <div className="absolute inset-0 neon-noise opacity-25" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-4 pb-16 pt-32">
          <div className="flex items-center my-5 gap-2 text-sm text-gray-300 mb-4">
            <Link to="/" className="text-blue-300 hover:text-blue-200">
              Home
            </Link>
            <span className="text-gray-400">›</span>
            <span className="text-white font-medium">Tài Khoản</span>
          </div>
          <Card className="w-full bg-[rgba(11,29,58,0.85)] border border-white/10 text-white shadow-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl text-blue-400">
                Tài Khoản
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs
                value={tab}
                onValueChange={handleTabChange}
                className="w-full"
              >
                <TabsList className="bg-white/5 border border-white/10 rounded-full px-1">
                  <TabsTrigger
                    className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-white rounded-full"
                    value="history"
                  >
                    Lịch Sử Giao Dịch
                  </TabsTrigger>
                  <TabsTrigger
                    className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-white rounded-full"
                    value="info"
                  >
                    Thông Tin Cá Nhân
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="mt-6">
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-gray-200">Họ và tên</Label>
                        <Input
                          className="bg-white/10 border-white/10 text-white placeholder:text-gray-400"
                          value={profile.name}
                          onChange={(e) =>
                            setProfile((p) => ({ ...p, name: e.target.value }))
                          }
                          placeholder="Nhập họ và tên"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-200">Email</Label>
                        <Input
                          className="bg-white/5 border-white/10 text-gray-200"
                          value={profile.email}
                          readOnly
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-200">Số điện thoại</Label>
                        <Input
                          className="bg-white/10 border-white/10 text-white placeholder:text-gray-400"
                          value={profile.phone}
                          onChange={(e) =>
                            setProfile((p) => ({ ...p, phone: e.target.value }))
                          }
                          placeholder="Nhập số điện thoại"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-200">Ngày sinh</Label>
                        <DatePicker
                          value={profile.dob ? dayjs(profile.dob) : null}
                          onChange={(date) =>
                            setProfile((p) => ({
                              ...p,
                              dob: date ? date.format("YYYY-MM-DD") : "",
                            }))
                          }
                          format="DD/MM/YYYY"
                          placeholder="Chọn ngày sinh"
                          className="w-full h-10 bg-white/10 border-white/10 hover:bg-white/10 hover:border-white/10 [&_.ant-picker-input>input]:!text-white [&_.ant-picker-input>input::placeholder]:!text-gray-400 [&_.ant-picker-suffix]:!text-gray-400"
                          style={{
                            backgroundColor: "rgba(255, 255, 255, 0.1)",
                            borderColor: "rgba(255, 255, 255, 0.1)",
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-200">Giới tính</Label>
                        <div className="flex items-center gap-6 h-10">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="gender"
                              value="male"
                              checked={(profile.gender || "") === "male"}
                              onChange={(e) =>
                                setProfile((p) => ({
                                  ...p,
                                  gender: e.target.value,
                                }))
                              }
                              className="accent-blue-500"
                            />
                            <span>Nam</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="gender"
                              value="female"
                              checked={(profile.gender || "") === "female"}
                              onChange={(e) =>
                                setProfile((p) => ({
                                  ...p,
                                  gender: e.target.value,
                                }))
                              }
                              className="accent-blue-500"
                            />
                            <span>Nữ</span>
                          </label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-200">Mật khẩu</Label>
                        <div className="relative">
                          <Input
                            className="bg-white/5 border-white/10 text-gray-200 pr-20"
                            value="••••••••"
                            readOnly
                          />
                          <button
                            className="absolute inset-y-0 right-3 my-auto text-sm text-orange-300 hover:text-orange-200"
                            onClick={() => setIsPwdOpen(true)}
                          >
                            Thay đổi
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        onClick={handleSaveProfile}
                        className="bg-blue-600 hover:bg-blue-700 px-8"
                      >
                        Cập nhật
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                  {isLoadingTx ? (
                    <div className="flex items-center gap-3 text-sm text-gray-200 bg-white/5 border border-white/10 rounded-lg px-4 py-3">
                      <div className="w-5 h-5 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                      Đang tải lịch sử giao dịch...
                    </div>
                  ) : groups.length === 0 ? (
                    <div className="text-sm text-gray-300">
                      Chưa có giao dịch
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="text-xs text-gray-300">
                        Lưu ý: chỉ hiển thị 20 giao dịch gần nhất
                      </div>
                      {groups.map((g, idx) => (
                        <div key={idx} className="space-y-3">
                          <div className="text-center text-sm text-gray-300 font-semibold">
                            {g.month}
                          </div>
                          <div className="space-y-4">
                            {g.items.map((t: any, i: number) => {
                              const movieCount = getMovieCountFromCombo(
                                t.combo,
                              );
                              const isVietQR =
                                t.method?.toLowerCase() === "vietqr";
                              const isPaid = t.payment_status === "paid";

                              return (
                                <div
                                  key={i}
                                  className="group relative w-full rounded-2xl bg-[#1a1f2e]/50 border border-white/5 p-5 hover:bg-[#1a1f2e]/80 transition-all duration-300 overflow-hidden"
                                >
                                  {/* Hiệu ứng ánh sáng nhẹ ở góc cho giao dịch chưa thanh toán */}
                                  {!isPaid && (
                                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50" />
                                  )}

                                  <div className="flex flex-col md:flex-row justify-between gap-6">
                                    {/* CỘT TRÁI: THÔNG TIN VÉ */}
                                    <div className="flex-1 space-y-4">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <h3 className="text-lg font-bold text-white tracking-tight">
                                            {t.ticket_package || "Vé đơn"}
                                          </h3>
                                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-gray-400 border border-white/5 uppercase">
                                            {t.method}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                          <span>
                                            {formatDateTime(t.created_at)}
                                          </span>
                                          <span>•</span>
                                          <span className="text-gray-300 font-medium">
                                            {movieCount} phim trong gói
                                          </span>
                                        </div>
                                      </div>

                                      <div className="space-y-2">
                                        {/* Trạng thái chính */}
                                        <div className="flex items-center gap-2 text-sm">
                                          {t.is_used ? (
                                            /* Trường hợp 1: Vé đã sử dụng */
                                            <span className="text-gray-400 font-medium flex items-center gap-1.5">
                                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                              Đã sử dụng
                                            </span>
                                          ) : isPaid ? (
                                            /* Trường hợp 2: Đã thanh toán và chưa sử dụng */
                                            <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                              Đang hoạt động{" "}
                                              {t.days_left &&
                                                `(còn ${t.days_left} ngày)`}
                                            </span>
                                          ) : (
                                            /* Trường hợp 3: Chưa thanh toán */
                                            <span
                                              className={`${isVietQR ? "text-blue-400 animate-pulse" : "text-amber-500"} font-medium flex items-center gap-1.5`}
                                            >
                                              <span
                                                className={`w-1.5 h-1.5 rounded-full ${isVietQR ? "bg-blue-400" : "bg-amber-500"}`}
                                              />
                                              {isVietQR
                                                ? "Đang chờ xác nhận..."
                                                : "Chờ thanh toán"}
                                            </span>
                                          )}
                                        </div>

                                        {/* Khối Copy Nội dung (Chỉ hiện khi chưa thanh toán VietQR) */}
                                        {isVietQR &&
                                          !isPaid &&
                                          t.pay_txt_code && (
                                            <div
                                              onClick={() =>
                                                handleCopy(t.pay_txt_code)
                                              }
                                              className="flex items-center justify-between max-w-[280px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 cursor-pointer hover:bg-white/10 transition-colors group/copy"
                                            >
                                              <div className="flex flex-col">
                                                <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">
                                                  Nội dung chuyển khoản
                                                </span>
                                                <span className="text-xs font-mono font-bold text-blue-300 uppercase tracking-widest">
                                                  {t.pay_txt_code}
                                                </span>
                                              </div>
                                              <Copy
                                                size={14}
                                                className="text-gray-500 group-hover/copy:text-blue-300 transition-colors"
                                              />
                                            </div>
                                          )}
                                      </div>
                                    </div>

                                    {/* CỘT PHẢI: GIÁ & ACTION */}
                                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-4 md:min-w-[140px]">
                                      <div className="text-right">
                                        <div className="text-2xl font-black text-white leading-none">
                                          {formatMoney(t.amount)}
                                          <span className="text-sm ml-0.5">
                                            ₫
                                          </span>
                                        </div>
                                        <div className="text-[11px] text-gray-500 font-medium mt-1">
                                          {t.quantity} Vé ×{" "}
                                          {formatMoney(t.ticket_unit_price)}₫
                                        </div>
                                      </div>

                                      <Button
                                        size="sm"
                                        className="w-full md:w-auto bg-white/5 hover:bg-white/10 text-white border-white/10 h-10 px-6 rounded-xl font-semibold transition-all active:scale-95"
                                        onClick={() => {
                                          setSelectedTx(t);
                                          setIsDetailOpen(true);
                                        }}
                                      >
                                        Chi tiết
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-white/20 bg-white/10 text-white hover:bg-white/20 disabled:opacity-60 disabled:bg-white/10 disabled:text-white"
                            disabled={currentPage === 1}
                            onClick={() =>
                              setCurrentPage((p) => Math.max(1, p - 1))
                            }
                          >
                            Trước
                          </Button>
                          <div className="flex items-center gap-1 text-sm text-gray-200">
                            <span>Trang</span>
                            <span className="font-semibold text-white">
                              {currentPage}
                            </span>
                            <span>/</span>
                            <span>{totalPages}</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-white/20 bg-white/10 text-white hover:bg-white/20 disabled:opacity-60 disabled:bg-white/10 disabled:text-white"
                            disabled={currentPage === totalPages}
                            onClick={() =>
                              setCurrentPage((p) => Math.min(totalPages, p + 1))
                            }
                          >
                            Sau
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isPwdOpen} onOpenChange={setIsPwdOpen}>
        <DialogContent className="bg-[rgba(11,29,58,0.92)] border border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Thay đổi mật khẩu</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-white">Mật khẩu hiện tại</Label>
              <Input
                className="bg-white/10 border-white/20 text-white"
                type="password"
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-white">Mật khẩu mới</Label>
              <Input
                className="bg-white/10 border-white/20 text-white"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-white">Xác nhận mật khẩu mới</Label>
              <Input
                className="bg-white/10 border-white/20 text-white"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleUpdatePassword}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Cập nhật
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-[#0b1d3a] border border-white/10 text-white max-w-md rounded-2xl p-0 overflow-hidden shadow-2xl">
          {selectedTx ? (
            <>
              {/* Header - Chỉ giữ Tiêu đề cho thoáng */}
              <div className="p-6 pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    CHI TIẾT VÉ
                  </h2>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* KHỐI 1: THÔNG TIN GÓI - Làm mờ nhẹ nếu đã dùng */}
                <div
                  className={`bg-white/5 rounded-xl p-5 border border-white/5 space-y-4 transition-opacity ${selectedTx.is_used ? "opacity-60" : ""}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] text-blue-400 uppercase font-bold tracking-widest mb-1">
                        Loại gói
                      </p>
                      <p className="text-lg font-bold text-white leading-none">
                        {selectedTx.ticket_package || "Vé đơn"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">
                        Số lượng
                      </p>
                      <p className="text-lg font-bold text-white leading-none">
                        {selectedTx.quantity} vé
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-3 tracking-wider">
                      Phim có trong gói:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {parseData(selectedTx.movie).map(
                        (m: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-200 font-medium"
                          >
                            {m}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                </div>

                {/* KHỐI 2: CHI TIẾT GIAO DỊCH - Bỏ dòng trạng thái dư thừa */}
                <div className="space-y-3.5 px-1 text-sm">
                  <div className="flex justify-between items-center border-b border-white/[0.03] pb-3">
                    <span className="text-gray-400">Mã đơn hàng</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-blue-300 font-bold tracking-tight">
                        {selectedTx.pay_txt_code}
                      </span>
                      <button
                        onClick={() => handleCopy(selectedTx.pay_txt_code)}
                        className="p-1.5 hover:bg-white/10 rounded-md text-gray-500 hover:text-white transition-colors"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between border-b border-white/[0.03] pb-3">
                    <span className="text-gray-400">Phương thức</span>
                    <span className="font-bold text-white uppercase">
                      {selectedTx.method}
                    </span>
                  </div>

                  {selectedTx.payment_status === "paid" ? (
                    <>
                      <div className="flex justify-between border-b border-white/[0.03] pb-3">
                        <span className="text-gray-400">Ngày thanh toán</span>
                        <span className="text-white font-medium">
                          {formatDateTime(selectedTx.paid_at)}
                        </span>
                      </div>
                      {selectedTx.expiry_date && (
                        <div className="flex justify-between border-b border-white/[0.03] pb-3">
                          <span className="text-gray-400 font-medium">
                            Ngày hết hạn
                          </span>
                          <span
                            className={`${selectedTx.is_used ? "text-gray-500" : "text-red-400"} font-bold`}
                          >
                            {formatDateTime(selectedTx.expiry_date)}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex justify-between border-b border-white/[0.03] pb-3">
                      <span className="text-gray-400">Ngày đặt vé</span>
                      <span className="text-white font-medium">
                        {formatDateTime(selectedTx.created_at)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-gray-400 font-bold">
                      Tổng thanh toán
                    </span>
                    <span className="text-2xl font-black text-blue-400 tracking-tighter">
                      {formatMoney(selectedTx.amount)}₫
                    </span>
                  </div>
                </div>

                {/* KHỐI 3: BOOKING CODE - Nơi tập trung hiển thị trạng thái đã dùng */}
                <div
                  className={`border rounded-2xl p-6 text-center relative group transition-all ${selectedTx.is_used ? "bg-gray-500/5 border-white/5" : "bg-gradient-to-b from-white/[0.05] to-transparent border-white/10"}`}
                >
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-4 tracking-[0.2em]">
                    Mã vé (Booking Code)
                  </p>

                  <div className="flex items-center justify-center gap-3">
                    <div
                      className={`text-3xl font-mono font-black tracking-[0.4em] uppercase min-h-[40px] flex items-center justify-center ${selectedTx.is_used ? "text-gray-600/50 line-through" : "text-white"} ${selectedTx.payment_status === "paid" && !selectedTx.is_used ? "ml-7" : ""}`}
                    >
                      {selectedTx.payment_status === "paid"
                        ? getBookingCode(selectedTx)
                        : "-- -- --"}
                    </div>

                    {selectedTx.payment_status === "paid" &&
                      !selectedTx.is_used && (
                        <button
                          onClick={() => handleCopy(getBookingCode(selectedTx))}
                          className="p-2 bg-blue-500/20 hover:bg-blue-500/40 rounded-lg text-blue-400 transition-all active:scale-90"
                        >
                          <Copy size={18} />
                        </button>
                      )}
                  </div>

                  <div className="mt-6 pt-5 border-t border-white/5 flex flex-col items-center gap-2">
                    {selectedTx.is_used ? (
                      /* Chỉ giữ một thông báo quan trọng nhất ở đây */
                      <div className="py-1.5 px-4 rounded-full bg-red-500/10 border border-red-500/20">
                        <p className="text-[11px] text-red-400 font-bold uppercase tracking-tight">
                          Vé này đã được quét vào cổng
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400 leading-relaxed max-w-[260px]">
                        {selectedTx.payment_status === "paid"
                          ? "Vui lòng xuất trình mã này tại rạp để nhận vé."
                          : "Mã vé sẽ hiển thị sau khi thanh toán thành công."}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-20 text-center text-gray-500 animate-pulse font-medium">
              Đang tải dữ liệu...
            </div>
          )}
        </DialogContent>
      </Dialog>
    </UserLayout>
  );
}
