import { useEffect, useMemo, useState } from "react";
import UserLayout from "@/user/layouts/UserLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
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
        setTransactions(items || []);
      } catch (e: any) {
        console.error(e);
      }
    })();
  }, [profile.email]);

  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    transactions?.forEach((t) => {
      const key = t?.dateDisplay || "";
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    const arr = Array.from(map.entries()).map(([date, items]) => ({ date, items }));
    return arr.sort((a, b) => {
      try {
        const da = a.date.split("/").reverse().join("-");
        const db = b.date.split("/").reverse().join("-");
        return db.localeCompare(da);
      } catch { return 0; }
    });
  }, [transactions]);

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
      <div className="max-w-4xl mx-auto p-4 ">
        <Card className="w-full bg-black/40 border border-white/10 text-white mt-[20rem]">
          <CardHeader>
            <CardTitle className="text-blue-400">Tài Khoản</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="bg-white/5 border border-white/10">
                <TabsTrigger value="info">Thông Tin Cá Nhân</TabsTrigger>
                <TabsTrigger value="history">Lịch Sử Giao Dịch</TabsTrigger>
              </TabsList>
              <TabsContent value="info" className="mt-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-white">Tên</Label>
                      <Input
                        className="bg-white/10 border-white/20 text-white"
                        value={profile.name}
                        onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Nhập tên"
                      />
                    </div>
                    <div>
                      <Label className="text-white">Số Điện Thoại</Label>
                      <Input
                        className="bg-white/10 border-white/20 text-white"
                        value={profile.phone}
                        onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="Nhập số điện thoại"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-white">Email</Label>
                      <Input className="bg-white/10 border-white/20 text-white opacity-60" value={profile.email} readOnly />
                    </div>
                    <div className="flex flex-col">
                      <Label className="text-white">Mật khẩu</Label>
                      <div className="flex items-center justify-between">
                        <Input className="bg-white/10 border-white/20 text-white" value={"********"} readOnly />
                        <button className="ml-3 text-blue-300 underline" onClick={() => setIsPwdOpen(true)}>Thay đổi</button>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleSaveProfile} className="bg-blue-600 hover:bg-blue-700">Cập nhật</Button>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="history" className="mt-4">
                {groups.length === 0 ? (
                  <div className="text-sm text-gray-300">Chưa có giao dịch</div>
                ) : (
                  <div className="space-y-6">
                    {groups.map((g, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="text-white font-semibold">{g.date}</div>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                          {g.items.map((t: any, i: number) => (
                            <div key={i} className="min-w-[280px] bg-white/5 border border-white/10 rounded-lg p-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="font-medium text-white">{t.movie || "Phim"}</div>
                                  <div className="text-xs text-gray-300">{t.showtime || "--:--"}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-blue-400 font-semibold">{Number(t.amount || 0).toLocaleString("vi-VN")}₫</div>
                                  <div className="text-xs text-green-300">{t.payment_status === "paid" ? "Đã thanh toán" : "Chưa thanh toán"}</div>
                                </div>
                              </div>
                              <div className="mt-2 text-sm text-gray-200">Số vé: {t.quantity}</div>
                              <div className="mt-3 flex justify-end">
                                <Button size="sm" variant="outline" className="border-white/20 text-black hover:bg-white/10"
                                  onClick={() => { setSelectedTx(t); setIsDetailOpen(true); }}>
                                  Chi tiết
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isPwdOpen} onOpenChange={setIsPwdOpen}>
        <DialogContent className="bg-black/90 border border-white/20 text-white">
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
        <DialogContent className="bg-black/90 border border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Chi tiết vé</DialogTitle>
          </DialogHeader>
          {selectedTx ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-300">Phim</span>
              <span className="font-medium text-white">{selectedTx.movie}</span>
              <span className="text-gray-300">Ngày</span>
              <span className="font-medium text-white">{selectedTx.dateDisplay}</span>
              <span className="text-gray-300">Giờ chiếu</span>
              <span className="font-medium text-white">{selectedTx.showtime}</span>
              <span className="text-gray-300">Họ tên</span>
              <span className="font-medium text-white">{selectedTx.name}</span>
              <span className="text-gray-300">Email</span>
              <span className="font-medium text-white">{selectedTx.email}</span>
              <span className="text-gray-300">Số lượng</span>
              <span className="font-medium text-white">{selectedTx.quantity}</span>
              <span className="text-gray-300">Thanh toán</span>
              <span className="font-medium text-white">{selectedTx.method === "momo" ? "MoMo" : "VNPay"}</span>
              <span className="text-gray-300">Tổng tiền</span>
              <span className="font-semibold text-blue-400">{Number(selectedTx.amount || 0).toLocaleString("vi-VN")}₫</span>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </UserLayout>
  );
}
