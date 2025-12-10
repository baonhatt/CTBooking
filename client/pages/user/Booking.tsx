import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { getAllActiveMoviesToday, getActiveTickets, createBookingApi, createMomoPaymentApi, createVnpayPaymentApi, API_BASE_URL, validateBookingApi } from "@/lib/api";
import UserLayout from "@/user/layouts/UserLayout";

export default function BookingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<0 | 1>(0);
  const [movie, setMovie] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState<number | null>(null);
  const [selectedShowtimeLabel, setSelectedShowtimeLabel] = useState<string>("");
  const [ticketCount, setTicketCount] = useState<number>(1);
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"momo" | "vnpay">("momo");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const [countdown, setCountdown] = useState(600);

  const { data: activeData, refetch: refetchActive, isLoading: isLoadingActive } = useQuery({
    queryKey: ["activeMovies", "today"],
    queryFn: () => getAllActiveMoviesToday(),
    staleTime: 60000,
  });
  const { data: ticketsData, isLoading: isLoadingTickets } = useQuery({
    queryKey: ["activeTickets"],
    queryFn: ({ signal }) => getActiveTickets({ signal }),
  });
  const isLoadingPage = isLoadingActive || isLoadingTickets;

  const movies = (activeData?.activeMovies || []).map((m: any) => ({ id: m.title, title: m.title }));
  const activeMoviesFull = activeData?.activeMovies || [];
  const selectedMovie = activeMoviesFull.find((x: any) => x.title === movie);
  const ticketPackages = (ticketsData?.items || []).map((t: any) => ({ id: t.id, name: t.name, price: Number(t.price || 0), type: t.type || "", display_order: t.display_order || 0 }));
  const defaultTicket = ticketPackages.sort((a, b) => a.display_order - b.display_order)[0];
  const unitPrice = Number((selectedPackage?.price ?? defaultTicket?.price) || 0);
  const totalPrice = unitPrice * ticketCount;

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("selectedTicketPackage");
      if (raw) {
        const pkg = JSON.parse(raw);
        setSelectedPackage(pkg);
      }
    } catch { }
  }, []);

  // Nếu cần chặn rời trang khi đang xử lý thanh toán, bật lại hook này.
  // Hiện tại tắt để tránh popup confirm rời trang làm gián đoạn UX.
  // useEffect(() => {
  //   const handler = (e: BeforeUnloadEvent) => {
  //     e.preventDefault();
  //     e.returnValue = "";
  //   };
  //   if (isProcessing) {
  //     window.addEventListener("beforeunload", handler);
  //   }
  //   return () => {
  //     window.removeEventListener("beforeunload", handler);
  //   };
  // }, [isProcessing]);

  useEffect(() => {
    try {
      const profRaw = localStorage.getItem("userProfile");
      if (profRaw) {
        const p = JSON.parse(profRaw);
        if (!email && p?.email) setEmail(p.email);
        if (!name && p?.name) setName(p.name);
        if (!phone && p?.phone) setPhone(p.phone);
        return;
      }
    } catch { }
    try {
      const raw = localStorage.getItem("authUser");
      if (raw) {
        const parsed = JSON.parse(raw);
        const authEmail = parsed?.user?.email || parsed?.email || "";
        const authName = parsed?.user?.username || parsed?.username || (authEmail ? authEmail.split("@")[0] : "");
        const authPhone = parsed?.user?.phone || parsed?.phone || "";
        if (!email && authEmail) setEmail(authEmail);
        if (!name && authName) setName(authName);
        if (!phone && authPhone) setPhone(authPhone);
      }
    } catch { }
  }, [email, name, phone]);

  const availableDates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const list = (selectedMovie?.showtimes || [])
      .map((st: any) => {
        const d = new Date(st.start_time);
        d.setHours(0, 0, 0, 0);
        return d;
      })
      .filter((d: Date) => d.getTime() >= today.getTime())
      .sort((a: Date, b: Date) => a.getTime() - b.getTime());
    const uniq: Date[] = [];
    for (const d of list) {
      if (!uniq.find((x) => x.getTime() === d.getTime())) uniq.push(d);
    }
    return uniq;
  }, [selectedMovie]);

  const resolveImageUrl = (u: string | undefined | null) => {
    if (!u) return "";
    if (u.startsWith("http")) return u;
    const path = u.startsWith("/") ? u : `/${u}`;
    return `${API_BASE_URL}${path}`;
  };
  const formatDateShort = (date: Date) => date.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
  const formatDateLong = (date: Date) => date.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" });

  const handleCreateAndPay = async () => {
    if (!selectedShowtimeId || !selectedDate || isProcessing) return;
    const authRaw = localStorage.getItem("authUser");
    if (!authRaw) {
      toast({ title: "Vui lòng đăng nhập", description: "Bạn cần đăng nhập trước khi thanh toán" });
      window.dispatchEvent(new Event("open-login"));
      return;
    }
    try {
      setIsProcessing(true);
      const parsed = JSON.parse(authRaw);
      const authEmail = parsed?.user?.email || parsed?.email || "";
      const orderId = `ORDER_${Date.now()}`;
      const movieDetail = selectedMovie;
      const ticketPackageId = selectedPackage?.id || defaultTicket?.id;
      // Validate booking data on server to prevent tampering
      const validation = await validateBookingApi({
        email: authEmail,
        emailBook: email,
        phone,
        name,
        showtimeId: selectedShowtimeId,
        ticketCount,
        ticketPackageId,
      });

      if (!validation?.ok) {
        throw new Error(validation?.message || "Không thể xác thực thông tin đặt vé");
      }

      const canonicalTotal = Number(validation.totalPrice ?? totalPrice);

      const summary = {
        orderId,
        movie: selectedMovie?.title,
        dateDisplay: selectedDate ? selectedDate.toLocaleDateString("vi-VN") : "",
        showtime: selectedShowtimeLabel,
        showtimeId: selectedShowtimeId,
        name,
        phone,
        email: authEmail,
        emailBook: email,
        quantity: ticketCount,
        amount: canonicalTotal,
        method: paymentMethod,
        poster: movieDetail?.cover_image || "",
        duration: movieDetail?.duration_min ? `${movieDetail.duration_min}` : "",
        genres: movieDetail?.genres || "",
        ticketPackageId,
      };

      countdownRef.current = setInterval(() => setCountdown((c) => c - 1), 1000);

      const { booking } = await createBookingApi({
        email: authEmail,
        emailBook: email,
        phone,
        name,
        showtimeId: selectedShowtimeId,
        ticketCount,
        paymentMethod,
        totalPrice: canonicalTotal,
        ticketPackageId,
      });
      localStorage.setItem("pendingOrder", JSON.stringify({ ...summary, booking_id: booking?.id, user_id: booking?.user_id }));
      let orderInfoText = `${selectedMovie?.title || "Movie"} | ${ticketCount} vé | ${selectedShowtimeLabel || "--:--"}`;
      if (paymentMethod === "momo") {
        const extraDataEncoded = btoa(unescape(encodeURIComponent(JSON.stringify({ ...summary, booking_id: booking?.id, user_id: booking?.user_id }))));
        const partnerCode = (import.meta as any).env?.VITE_MOMO_PARTNER_CODE || "";
        const partnerName = (import.meta as any).env?.VITE_MOMO_PARTNER_NAME || "CineSphere";
        const storeId = (import.meta as any).env?.VITE_MOMO_STORE_ID || "devstore";
        const redirectUrl = (import.meta as any).env?.VITE_MOMO_REDIRECT_URL || window.location.origin + "/checkout";
        const ipnUrl = (import.meta as any).env?.VITE_MOMO_IPN_URL || (API_BASE_URL ? API_BASE_URL + "/api/momo/ipn" : window.location.origin + "/api/momo/ipn");
        const accessKey = (import.meta as any).env?.VITE_MOMO_ACCESS_KEY || "";
        const secretKey = (import.meta as any).env?.VITE_MOMO_SECRET_KEY || "";
        const requestId = Date.now().toString();
        const payload: any = { partnerCode, partnerName, storeId, requestId, amount: canonicalTotal, orderId, orderInfo: orderInfoText, redirectUrl, ipnUrl, lang: "vi", extraData: extraDataEncoded, requestType: "captureWallet", signature: "", accessKey, secretKey };
        const res = await createMomoPaymentApi(payload);
        if (res?.payUrl) { window.location.href = res.payUrl; return; }
        throw new Error("Không nhận được liên kết thanh toán MoMo");
      } else {
        orderInfoText = booking?.id;
        const returnUrl = (import.meta as any).env?.VITE_VNPAY_RETURN_URL || window.location.origin + "/checkout";
        const locale = "vn";
        const res = await createVnpayPaymentApi({ amount: canonicalTotal, orderId, orderInfo: orderInfoText, locale, returnUrl });
        if (res?.payUrl) { window.location.href = res.payUrl; return; }
        throw new Error("Không nhận được liên kết thanh toán VNPay");
      }
    } catch (err: any) {
      setIsProcessing(false);
      toast({ title: "Không thể tạo đặt vé", description: err?.message || "Vui lòng thử lại" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <UserLayout
      className="bg-gradient-dark"
      headerProps={{ onBookClick: () => { }, disableNav: true }}
      hideFooter
      contentClassName="text-white"
    >
      <div className="max-w-5xl mx-auto p-4 pt-28">
        <div className="mb-4 text-sm py-3">
          <button className="text-blue-300 hover:text-blue-400 underline" onClick={() => navigate("/")}>Home</button>
          <span className="mx-2 text-white/60">&gt;</span>
          <span className="text-white">Đặt vé</span>
        </div>
        {isLoadingPage && (
          <Card className="bg-black/40 border border-white/10 text-white">
            <CardHeader>
              <CardTitle>Đang tải dữ liệu đặt vé</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3 text-sm text-cyan-200">
              <div className="w-5 h-5 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin" />
              Vui lòng chờ trong giây lát...
            </CardContent>
          </Card>
        )}

        {!isLoadingPage && step === 0 && (
          <Card className="bg-black/40 border border-white/10 text-white">
            <CardHeader>
              <CardTitle>Đặt vé</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="text-sm text-cyan-200">Chọn phim</div>
                <Select value={movie} onValueChange={(v) => { setMovie(v); setSelectedDate(null); setSelectedShowtimeId(null); setSelectedShowtimeLabel(""); try { refetchActive(); } catch { } }}>
                  <SelectTrigger className="w-full bg-black/40 text-white border-white/10">
                    <span className="truncate">{selectedMovie?.title || "Chọn phim"}</span>
                  </SelectTrigger>
                  <SelectContent className="bg-black/90 text-white border border-white/10">
                    {(activeMoviesFull || []).map((m: any) => (
                      <SelectItem className="text-white py-2" key={m.id ?? m.title} value={m.title}>
                        <div className="flex items-center gap-3">
                          <img src={resolveImageUrl(m.cover_image)} alt={m.title} className="w-10 h-14 object-cover rounded border border-white/10" />
                          <div className="flex flex-col">
                            <span className="font-medium">{m.title}</span>
                            <span className="text-xs text-cyan-200">{m.duration_min ? `${m.duration_min} phút` : "--"}</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedMovie && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
                    <img src={resolveImageUrl(selectedMovie.cover_image)} alt={selectedMovie.title} className="w-full h-40 object-cover" />
                    <div className="px-3 py-2 text-sm text-cyan-200">Thời lượng: {selectedMovie.duration_min ? `${selectedMovie.duration_min} phút` : "--"}</div>
                  </div>
                )}
              </div>

              {selectedMovie && (
                <div>
                  <div className="text-sm text-cyan-200 mb-2">Chọn lịch chiếu</div>
                  <div className="flex gap-2 bg-black/40 text-white rounded px-3 py-2 mb-4 border border-white/20">
                    {availableDates.length === 0 ? (
                      <span className="text-cyan-200">Hiện chưa có lịch chiếu</span>
                    ) : (
                      availableDates.map((d, idx) => {
                        const active = selectedDate && d.toDateString() === selectedDate.toDateString();
                        return (
                          <Button
                            key={idx}
                            variant={active ? "default" : "ghost"}
                            className={
                              active
                                ? "bg-blue-600 text-white border border-white/30"
                                : "bg-transparent text-white hover:bg-white/10 border border-white/20"
                            }
                            onClick={() => setSelectedDate(new Date(d))}
                          >
                            {formatDateShort(d)}
                          </Button>
                        );
                      })
                    )}
                  </div>
                  {selectedDate && (
                    <div className="space-y-3">
                      <div className="text-sm text-cyan-200">Giờ chiếu</div>
                      <div className="flex flex-wrap gap-2 border border-white/20 rounded px-2 py-2">
                        {(selectedMovie.showtimes || [])
                          .filter((st: any) => new Date(st.start_time).toDateString() === selectedDate.toDateString())
                          .map((st: any) => {
                            const t = new Date(st.start_time);
                            const label = `${t.getHours().toString().padStart(2, "0")}:${t.getMinutes().toString().padStart(2, "0")}`;
                            const active = selectedShowtimeId === st.id;
                            return (
                              <Button
                                key={st.id}
                                variant={active ? "default" : "outline"}
                                className={
                                  active
                                    ? "bg-blue-600 text-white border border-white/30"
                                    : "bg-transparent border-white/30 text-white hover:bg-white/10"
                                }
                                onClick={() => { setSelectedShowtimeId(st.id); setSelectedShowtimeLabel(label); }}
                              >
                                {label}
                              </Button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="text-sm text-cyan-200 mb-2">Thông tin khách hàng</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-white">Họ và Tên</Label>
                    <Input className="bg-black/40 text-white border-white/10 focus-visible:ring-cyan-400" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập họ và tên" minLength={2} />
                  </div>
                  <div>
                    <Label className="text-white">Số điện thoại</Label>
                    <Input className="bg-black/40 text-white border-white/10 focus-visible:ring-cyan-400" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="numeric" pattern="^[0-9]{9,11}$" title="Số điện thoại 9-11 chữ số" placeholder="VD: 0912345678" />
                  </div>
                  <div>
                    <Label className="text-white">Email nhận vé</Label>
                    <Input className="bg-black/40 text-white border-white/10 focus-visible:ring-cyan-400" value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@email.com" />
                  </div>
                  <div>
                    <Label className="text-white">Số lượng vé</Label>
                    <Input className="bg-black/40 text-white border-white/10 focus-visible:ring-cyan-400" type="number" min={1} max={10} value={ticketCount} onChange={(e) => setTicketCount(Number(e.target.value))} />
                  </div>
                </div>
              </div>

              {(selectedPackage || defaultTicket) && (
                <div className="bg-black/40 rounded-lg p-3 border border-white/10">
                  <div className="text-sm text-cyan-200">Loại vé đã chọn</div>
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">{selectedPackage?.name || defaultTicket?.name || "Vé tiêu chuẩn"}</span>
                    <span className="text-white">{unitPrice.toLocaleString("vi-VN")}₫</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" className="bg-transparent border-white/30 text-white hover:bg-white/10" onClick={() => navigate("/")} disabled={isProcessing}>Hủy</Button>
                <Button className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold shadow-lg" onClick={() => setStep(1)} disabled={!movie || !selectedDate || !selectedShowtimeId || !name || !phone || !email || isProcessing}>Tiếp tục</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <>
            <Card className="bg-black/40 border border-white/10 text-white">
              <CardHeader>
                <CardTitle>Thông tin đặt vé</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-cyan-200">Phim</span><span className="font-medium text-white">{selectedMovie?.title}</span>
                    <span className="text-cyan-200">Ngày</span><span className="font-medium text-white">{selectedDate ? formatDateLong(selectedDate) : ""}</span>
                    <span className="text-cyan-200">Giờ</span><span className="font-medium text-white">{selectedShowtimeLabel}</span>
                    <span className="text-cyan-200">Thời lượng</span><span className="font-medium text-white">{selectedMovie?.duration_min ? `${selectedMovie.duration_min} phút` : "--"}</span>
                    <span className="text-cyan-200">Họ tên</span><span className="font-medium text-white">{name}</span>
                    <span className="text-cyan-200">Email</span><span className="font-medium text-white">{email}</span>
                    <span className="text-cyan-200">Số lượng</span><span className="font-medium text-white">{ticketCount}</span>
                  </div>
                  <div className="text-xs sm:text-sm text-yellow-300 mt-1">Vui lòng kiểm tra kỹ email, mã đặt vé sẽ gửi tới email này.</div>
                  {selectedMovie?.cover_image && (
                    <div className="mt-2 overflow-hidden rounded-lg border border-white/10">
                      <img src={resolveImageUrl(selectedMovie.cover_image)} alt={selectedMovie.title} className="w-full h-40 object-cover" />
                    </div>
                  )}
                  <label className="flex items-center gap-2 mt-2 text-white">
                    <input type="checkbox" checked={isConfirmed} onChange={(e) => setIsConfirmed(e.target.checked)} />
                    <span>Tôi xác nhận thanh toán</span>
                  </label>
                </div>
                <div className="space-y-3">
                  <div className="text-sm text-cyan-200">Phương thức thanh toán</div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`cursor-pointer rounded-lg border ${paymentMethod === 'momo' ? 'border-pink-500 bg-pink-600/20' : 'border-white/10 bg-black/20'} p-3 flex items-center gap-3`}>
                      <input type="checkbox" checked={paymentMethod === "momo"} onChange={() => setPaymentMethod("momo")} />
                      <span className="inline-flex items-center gap-2 text-white">
                        <span className="w-6 h-6 rounded bg-pink-600 text-white grid place-items-center text-xs font-bold">M</span> MoMo
                      </span>
                    </label>
                    <label className={`cursor-pointer rounded-lg border ${paymentMethod === 'vnpay' ? 'border-blue-500 bg-blue-600/20' : 'border-white/10 bg-black/20'} p-3 flex items-center gap-3`}>
                      <input type="checkbox" checked={paymentMethod === "vnpay"} onChange={() => setPaymentMethod("vnpay")} />
                      <span className="inline-flex items-center gap-2 text-white">
                        <span className="w-6 h-6 rounded bg-blue-600 text-white grid place-items-center text-xs font-bold">V</span> VNPay
                      </span>
                    </label>
                  </div>
                  <div className="bg-black/40 rounded-lg p-4 border border-white/10">
                    <div className="text-white font-semibold mb-2">Booking Summary</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-cyan-200">Loại vé</span><span className="text-white font-medium">{selectedPackage?.name || defaultTicket?.name || 'Vé tiêu chuẩn'}</span></div>
                      <div className="flex justify-between"><span className="text-cyan-200">Đơn giá</span><span className="text-white">{unitPrice.toLocaleString('vi-VN')}₫</span></div>
                      <div className="flex justify-between"><span className="text-cyan-200">Số lượng</span><span className="text-white">{ticketCount}</span></div>
                      <div className="flex justify-between border-t border-white/10 pt-2"><span className="text-white">Tổng Tiền</span><span className="text-blue-400 font-bold">{totalPrice.toLocaleString('vi-VN')}₫</span></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-between">
              <Button variant="outline" className="bg-transparent border-white/30 text-white hover:bg-white/10" onClick={() => setStep(0)} disabled={isProcessing}>Quay lại</Button>
              <Button className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold shadow-lg disabled:opacity-50" disabled={!isConfirmed || isProcessing} onClick={handleCreateAndPay}>
                {isProcessing ? "Đang xử lý..." : "Thanh toán"}
              </Button>
            </div>
          </>
        )}
      </div>
      {isProcessing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
          <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4" />
          <div className="text-lg font-semibold">Đang xử lý thanh toán...</div>
          <div className="text-sm text-white/70 mt-1">Vui lòng không đóng hoặc rời khỏi trang cho đến khi chuyển sang cổng thanh toán.</div>
        </div>
      )}
    </UserLayout>
  );
}
