import { useEffect, useMemo, useState } from "react";
import UserLayout from "@/user/layouts/UserLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { updateUserProfileApi, changePasswordApi, getUserTransactionsApi } from "@/lib/api";

export default function Account() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ name: string; phone: string; email: string }>({ name: "", phone: "", email: "" });
  const [isPwdOpen, setIsPwdOpen] = useState(false);
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  const [transactions, setTransactions] = useState<any[]>([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [tab, setTab] = useState<"history" | "info">("history");
  const pageSize = 5;

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
      if (authRaw) {
        try {
          const parsed = JSON.parse(authRaw);
          email = parsed?.user?.email || parsed?.email || email;
          name = parsed?.user?.username || parsed?.username || name;
          phone = (parsed?.user as any)?.phone || phone;
        } catch { }
      }
      if (raw) {
        try {
          const p = JSON.parse(raw);
          email = p?.email || email;
          name = p?.name || name;
          phone = p?.phone || phone;
        } catch { }
      }
      setProfile({ name: name || "", phone: phone || "", email: email || "" });
    } catch { }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const email = profile.email;
        if (!email) return;
        const { items } = await getUserTransactionsApi({ email, status: "paid" });
        const mapped =
          (items || []).map((t: any) => ({
            ...t,
            poster: t?.poster || t?.cover_image || t?.coverImage || t?.poster_url,
          })) || [];
        setTransactions(mapped);
      } catch (e: any) {
        console.error(e);
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
    const monthLabel = (dateStr: string | undefined) => {
      if (!dateStr) return "Khác";
      try {
        const [day, month, year] = dateStr.split("/");
        if (month && year) return `Tháng ${month}/${year}`;
      } catch { }
      return "Khác";
    };

    const map = new Map<string, any[]>();
    pagedTransactions?.forEach((t) => {
      const key = monthLabel(t?.dateDisplay);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });

    const arr = Array.from(map.entries()).map(([month, items]) => ({ month, items }));
    return arr.sort((a, b) => b.month.localeCompare(a.month));
  }, [pagedTransactions]);

  const getBookingCode = (tx: any | null) =>
    tx?.booking_code || tx?.bookingCode || tx?.code || tx?.bookingCodeEmail || "--";

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
      await updateUserProfileApi({ email: profile.email, name: profile.name, phone: profile.phone });
      const p = { email: profile.email, name: profile.name, phone: profile.phone };
      localStorage.setItem("userProfile", JSON.stringify(p));
      const authRaw = localStorage.getItem("authUser");
      if (authRaw) {
        try {
          const parsed = JSON.parse(authRaw);
          if (parsed?.user) {
            parsed.user.username = profile.name || parsed.user.username;
            (parsed.user as any).phone = profile.phone || (parsed.user as any).phone;
          }
          localStorage.setItem("authUser", JSON.stringify(parsed));
        } catch { }
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
      await changePasswordApi({ email: profile.email, oldPassword: oldPwd, newPassword: newPwd });
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
      className="bg-gradient-dark"
      headerProps={{ onBookClick: () => { } }}
      hideFooter
    >
      <div className="max-w-5xl mx-auto px-4 pb-16 pt-32">
        <div className="flex items-center gap-2 text-sm text-gray-300 mb-4">
          <Link to="/" className="text-blue-300 hover:text-blue-200">Home</Link>
          <span className="text-gray-400">›</span>
          <span className="text-white font-medium">Tài Khoản</span>
        </div>
        <Card className="w-full bg-[rgba(11,29,58,0.85)] border border-white/10 text-white shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl text-blue-400">Tài Khoản</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="bg-white/5 border border-white/10 rounded-full px-1">
                <TabsTrigger className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-white rounded-full" value="history">
                  Lịch Sử Giao Dịch
                </TabsTrigger>
                <TabsTrigger className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-white rounded-full" value="info">
                  Thông Tin Cá Nhân
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-6">
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label className="text-gray-200">Họ và tên</Label>
                      <Input
                        className="bg-white/10 border-white/10 text-white placeholder:text-gray-400"
                        value={profile.name}
                        onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Nhập họ và tên"
                      />
                    </div>
                    {/* <div className="space-y-2">
                      <Label className="text-gray-200">Ngày sinh</Label>
                      <Input
                        className="bg-white/5 border-white/10 text-gray-300"
                        value="--/--/----"
                        readOnly
                      />
                    </div> */}
                    <div className="space-y-2">
                      <Label className="text-gray-200">Email</Label>
                      <div className="relative">
                        <Input
                          className="bg-white/5 border-white/10 text-gray-200 pr-24"
                          value={profile.email}
                          readOnly
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label className="text-gray-200">Số điện thoại</Label>
                      <Input
                        className="bg-white/10 border-white/10 text-white placeholder:text-gray-400"
                        value={profile.phone}
                        onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="Nhập số điện thoại"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-200">Mật khẩu</Label>
                      <div className="relative">
                        <Input
                          className="bg-white/5 border-white/10 text-gray-200 pr-24"
                          value="••••••••••"
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-end">
                    <div className="space-y-2"></div>
                    <div className="flex justify-end">
                      <Button onClick={handleSaveProfile} className="bg-blue-600 hover:bg-blue-700 px-8">
                        Cập nhật
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-6">
                {groups.length === 0 ? (
                  <div className="text-sm text-gray-300">Chưa có giao dịch</div>
                ) : (
                  <div className="space-y-6">
                    <div className="text-xs text-gray-300">Lưu ý: chỉ hiển thị 20 giao dịch gần nhất</div>
                    {groups.map((g, idx) => (
                      <div key={idx} className="space-y-3">
                        <div className="text-center text-sm text-gray-300 font-semibold">{g.month}</div>
                        <div className="space-y-4">
                          {g.items.map((t: any, i: number) => {
                            const bookingCode = getBookingCode(t);
                            return (
                              <div
                                key={i}
                                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 shadow-sm"
                              >
                                <div className="grid grid-cols-[80px,1fr,auto] gap-4 items-center">
                                  <div className="w-20 h-24 rounded-lg overflow-hidden bg-white/10">
                                    {getPoster(t) ? (
                                      <img src={getPoster(t)} alt={t.movie || "poster"} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-sm text-gray-300">Poster</div>
                                    )}
                                  </div>

                                  <div className="space-y-1">
                                    <div className="text-lg font-semibold text-white leading-tight line-clamp-2">{t.movie || "Phim"}</div>
                                    {/* <div className="text-sm text-gray-300">
                                      {t.format || t.language || "2D"} • {t.rating || "T"}{t.ageLabel || ""}
                                    </div> */}
                                    <div className="text-sm text-gray-200">
                                      {t.showtime || "--:--"} - <span className="font-medium">{t.dateDisplay || ""}</span>
                                    </div>
                                    <div className="text-sm text-gray-300">
                                      Số vé: <span className="text-white font-medium">{t.quantity}</span> •
                                      <span className="ml-2 text-blue-300 font-semibold">{formatMoney(t.amount)}₫</span>
                                    </div>
                                    <div className="text-xs text-green-300">{t.payment_status === "paid" ? "Đã thanh toán" : "Chưa thanh toán"}</div>
                                  </div>

                                  <div className="flex flex-col items-end gap-2">
                                    {/* <div className="text-xs text-gray-300">Mã vé</div> */}
                                    {/* <div className="text-base font-semibold text-white">{bookingCode}</div> */}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-white/20 text-black hover:bg-white/10"
                                      onClick={() => { setSelectedTx(t); setIsDetailOpen(true); }}
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
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        >
                          Trước
                        </Button>
                        <div className="flex items-center gap-1 text-sm text-gray-200">
                          <span>Trang</span>
                          <span className="font-semibold text-white">{currentPage}</span>
                          <span>/</span>
                          <span>{totalPages}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-white/20 bg-white/10 text-white hover:bg-white/20 disabled:opacity-60 disabled:bg-white/10 disabled:text-white"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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

      <Dialog open={isPwdOpen} onOpenChange={setIsPwdOpen}>
        <DialogContent className="bg-[rgba(11,29,58,0.92)] border border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Thay đổi mật khẩu</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-white">Mật khẩu hiện tại</Label>
              <Input className="bg-white/10 border-white/20 text-white" type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
            </div>
            <div>
              <Label className="text-white">Mật khẩu mới</Label>
              <Input className="bg-white/10 border-white/20 text-white" type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            </div>
            <div>
              <Label className="text-white">Xác nhận mật khẩu mới</Label>
              <Input className="bg-white/10 border-white/20 text-white" type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleUpdatePassword} className="bg-blue-600 hover:bg-blue-700">Cập nhật</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-[rgba(11,29,58,0.92)] border border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-blue-200">Chi tiết vé</DialogTitle>
          </DialogHeader>
          {selectedTx ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-20 h-24 rounded-lg overflow-hidden bg-white/10">
                  {getPoster(selectedTx) ? (
                    <img src={getPoster(selectedTx)} alt={selectedTx.movie || "poster"} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">Poster</div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-base font-semibold text-white">{selectedTx.movie}</div>
                  {/* <div className="text-sm text-gray-300">{selectedTx.format || selectedTx.language || "2D Phụ Đề"}</div> */}
                  <div className="text-sm text-gray-300">{selectedTx.showtime} - {selectedTx.dateDisplay}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-400">Họ tên</span>
                <span className="font-medium text-white">{selectedTx.name}</span>
                <span className="text-gray-400">Email</span>
                <span className="font-medium break-all text-white">{selectedTx.email}</span>
                <span className="text-gray-400">Số lượng</span>
                <span className="font-medium text-white">{selectedTx.quantity}</span>
                <span className="text-gray-400">Thanh toán</span>
                <span className="font-medium text-white">{selectedTx.method === "momo" ? "MoMo" : "VNPay"}</span>
                <span className="text-gray-400">Tổng tiền</span>
                <span className="font-semibold text-blue-300">{formatMoney(selectedTx.amount)}₫</span>
              </div>

              <div className="rounded-xl border border-dashed border-white/30 p-4 text-center bg-white/5">
                <div className="text-sm text-gray-300">Mã vé (booking code)</div>
                <div className="mt-1 text-2xl font-bold tracking-wide text-white">
                  {getBookingCode(selectedTx)}
                </div>
              </div>
              <div className="text-xs text-gray-400 text-center">
                Mã vé được gửi trong email xác nhận. Vui lòng xuất trình mã này tại rạp.
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </UserLayout>
  );
}
