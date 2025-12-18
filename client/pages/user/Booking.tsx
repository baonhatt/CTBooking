import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { getAllActiveMoviesToday, getActiveTickets, createBookingApi, createMomoPaymentApi, createVnpayPaymentApi, API_BASE_URL, validateBookingApi } from "@/lib/api";
import UserLayout from "@/user/layouts/UserLayout";

export default function BookingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<0 | 1>(0);
  const [movie, setMovie] = useState<string>("");
  const [ticketCount, setTicketCount] = useState<number>(1);
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [phoneError, setPhoneError] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [emailError, setEmailError] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"momo" | "vnpay">("momo");
  const [isProcessing, setIsProcessing] = useState(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const [countdown, setCountdown] = useState(600);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const backdropConfig = {
    base: Number((import.meta as any).env?.VITE_BACKDROP_DARK_BASE ?? 0.5),
    min: Number((import.meta as any).env?.VITE_BACKDROP_DARK_MIN ?? 0.4),
    max: Number((import.meta as any).env?.VITE_BACKDROP_DARK_MAX ?? 0.7),
    brightness: Number((import.meta as any).env?.VITE_BACKDROP_BRIGHTNESS ?? 0.85),
    blurPx: Number((import.meta as any).env?.VITE_BACKDROP_BLUR ?? 2),
  };
  const [overlayDark, setOverlayDark] = useState(backdropConfig.base);

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

  const activeMoviesFull = activeData?.activeMovies || [];
  const movies = (activeMoviesFull || []).map((m: any) => ({ id: m.title, title: m.title }));
  const selectedMovie = activeMoviesFull.find((x: any) => x.title === movie);
  const ticketPackages = (ticketsData?.items || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    description: t.description || "",
    price: Number(t.price || 0),
    features: Array.isArray(t.features) ? t.features : [],
    type: t.type || "",
    display_order: t.display_order || 0,
  }));
  const defaultTicket = ticketPackages.sort((a, b) => a.display_order - b.display_order)[0];
  const unitPrice = Number(selectedPackage?.price || 0);
  const totalPrice = unitPrice * ticketCount;
  const MIN_TICKETS = 1;
  const MAX_TICKETS = 10;



  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  useEffect(() => {
    if (selectedPackage && Array.isArray(ticketPackages) && ticketPackages.length > 0) {
      const canonical = ticketPackages.find((p: any) => Number(p.id) === Number(selectedPackage.id));
      if (canonical) {
        const hasFull =
          Array.isArray(selectedPackage.features) &&
          typeof selectedPackage.description === "string";
        if (!hasFull || JSON.stringify(selectedPackage) !== JSON.stringify(canonical)) {
          setSelectedPackage(canonical);
        }
      }
    }
  }, [ticketPackages, selectedPackage]);
  useEffect(() => {
    try {
      const rawSel = localStorage.getItem("selectedFilm");
      if (rawSel && Array.isArray(activeMoviesFull) && activeMoviesFull.length > 0) {
        const sel = JSON.parse(rawSel);
        const found = activeMoviesFull.find((m: any) => m?.id === sel?.id || m?.title === sel?.title);
        if (found?.title) {
          setMovie(found.title);
        }
        localStorage.removeItem("selectedFilm");
      }
    } catch { }
  }, [activeMoviesFull]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("selectedTicketPackage");
      if (raw) {
        const pkg = JSON.parse(raw);
        setSelectedPackage(pkg);
        localStorage.removeItem("selectedTicketPackage");
      }
    } catch { }
  }, []);

  useEffect(() => {
    const url = selectedMovie?.cover_image;
    if (!url) return;
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = resolveImageUrl(url);
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const w = 32, h = 32;
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h).data;
          let sum = 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            sum += lum;
          }
          const avg = sum / (data.length / 4);
          // Map brightness to overlay opacity with clamps
          let dark =
            avg >= 180 ? backdropConfig.base + 0.18
              : avg >= 150 ? backdropConfig.base + 0.12
                : avg >= 120 ? backdropConfig.base + 0.06
                  : backdropConfig.base - 0.06;
          dark = Math.max(backdropConfig.min, Math.min(backdropConfig.max, dark));
          setOverlayDark(dark);
        } catch {
          setOverlayDark(backdropConfig.base);
        }
      };
    } catch {
      setOverlayDark(backdropConfig.base);
    }
  }, [selectedMovie?.cover_image]);

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

  const resolveImageUrl = (u: string | undefined | null) => {
    if (!u) return "";
    if (u.startsWith("http")) return u;
    const path = u.startsWith("/") ? u : `/${u}`;
    return `${API_BASE_URL}${path}`;
  };

  const handleCreateAndPay = async () => {
    if (isProcessing) return;
    if (!confirmChecked) {
      toast({ title: "Vui lòng xác nhận thông tin", description: "Hãy tick vào ô xác nhận trước khi thanh toán" });
      return;
    }
    if (!selectedMovie) {
      toast({ title: "Chưa chọn phim", description: "Vui lòng chọn một bộ phim" });
      return;
    }
    if (!selectedPackage?.id) {
      toast({ title: "Chưa chọn loại vé", description: "Vui lòng chọn một loại vé trong danh sách" });
      return;
    }
    if (!name || !phone || !email) {
      toast({ title: "Thiếu thông tin", description: "Vui lòng nhập họ tên, số điện thoại và email" });
      return;
    }
    const confirmed = window.confirm("Xác nhận đặt vé và chuyển sang thanh toán?");
    if (!confirmed) return;
    try {
      setIsProcessing(true);
      const orderId = `ORDER_${Date.now()}`;
      const movieDetail = selectedMovie;
      const ticketPackageId = selectedPackage?.id || defaultTicket?.id;
      // Validate booking data on server to prevent tampering
      const validation = await validateBookingApi({
        email,
        emailBook: email,
        phone,
        name,
        movieId: selectedMovie?.id,
        ticketCount,
        ticketPackageId: selectedPackage?.id,
      });

      if (!validation?.ok) {
        throw new Error(validation?.message || "Không thể xác thực thông tin đặt vé");
      }

      const canonicalTotal = Number(validation.totalPrice ?? totalPrice);

      const summary = {
        orderId,
        movie: selectedMovie?.title,
        name,
        phone,
        email,
        emailBook: email,
        quantity: ticketCount,
        amount: canonicalTotal,
        method: paymentMethod,
        poster: movieDetail?.cover_image || "",
        duration: movieDetail?.duration_min ? `${movieDetail.duration_min}` : "",
        genres: movieDetail?.genres || "",
        ticketPackageId: selectedPackage?.id,
      };

      countdownRef.current = setInterval(() => setCountdown((c) => c - 1), 1000);

      const { booking } = await createBookingApi({
        email,
        emailBook: email,
        phone,
        name,
        movieId: selectedMovie?.id,
        ticketCount,
        paymentMethod,
        totalPrice: canonicalTotal,
        ticketPackageId: selectedPackage?.id,
      });
      localStorage.setItem("pendingOrder", JSON.stringify({ ...summary, booking_id: booking?.id, user_id: booking?.user_id }));
      let orderInfoText = `${selectedMovie?.title || "Movie"} | ${ticketCount} vé`;
      if (paymentMethod === "momo") {
        const extraDataEncoded = btoa(unescape(encodeURIComponent(JSON.stringify({ ...summary, booking_id: booking?.id, user_id: booking?.user_id }))));
        const partnerCode = (import.meta as any).env?.VITE_MOMO_PARTNER_CODE || "";
        const partnerName = (import.meta as any).env?.VITE_MOMO_PARTNER_NAME || "CineSphere";
        const storeId = (import.meta as any).env?.VITE_MOMO_STORE_ID || "devstore";
        const clientBase = (import.meta as any).env?.VITE_CLIENT_BASE_URL || window.location.origin;
        const serverBase = (import.meta as any).env?.VITE_SERVER_BASE_URL || clientBase;
        const redirectPath = (import.meta as any).env?.VITE_MOMO_REDIRECT_URL || "/checkout";
        const ipnPath = (import.meta as any).env?.VITE_MOMO_IPN_URL || "/api/momo/ipn";
        const redirectUrl = `${clientBase}${redirectPath}`;
        const ipnUrl = `${serverBase}${ipnPath}`;
        const accessKey = (import.meta as any).env?.VITE_MOMO_ACCESS_KEY || "";
        const secretKey = (import.meta as any).env?.VITE_MOMO_SECRET_KEY || "";
        const requestId = Date.now().toString();
        const payload: any = { partnerCode, partnerName, storeId, requestId, amount: canonicalTotal, orderId, orderInfo: orderInfoText, redirectUrl, ipnUrl, lang: "vi", extraData: extraDataEncoded, requestType: "captureWallet", signature: "", accessKey, secretKey };
        const res = await createMomoPaymentApi(payload);
        if (res?.payUrl) { window.location.href = res.payUrl; return; }
        throw new Error("Không nhận được liên kết thanh toán MoMo");
      } else if (paymentMethod === "vnpay") {
        orderInfoText = booking?.id;
        // returnUrl phải là URL của frontend (Pages / site hiện tại), không phải URL backend
        const clientBaseForVnp =
          (import.meta as any).env?.VITE_CLIENT_BASE_URL || window.location.origin;
        const returnPathForVnp =
          (import.meta as any).env?.VITE_VNPAY_RETURN_URL || "/checkout";
        const returnUrl = `${clientBaseForVnp}${returnPathForVnp}`;
        const locale = "vn";
        const res = await createVnpayPaymentApi({ amount: canonicalTotal, orderId, orderInfo: orderInfoText, locale, returnUrl });
        if (res?.payUrl) { window.location.href = res.payUrl; return; }
        throw new Error("Không nhận được liên kết thanh toán VNPay");
      }
    } catch (err: any) {
      setIsProcessing(false);
      toast({ title: "Không thể tạo đặt vé", description: "Đã xảy ra lỗi, vui lòng thử lại sau" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <UserLayout
      className="bg-gradient-to-br from-[#050915] via-[#0b1226] to-[#0e1b3d]"
      headerProps={{ onBookClick: () => { }, disableNav: true }}
      hideFooter
      contentClassName="text-white"
    >
      <div className="relative min-h-screen">
        {/* Gradient overlays similar to home page */}
        <div className="absolute inset-0 pointer-events-none z-0">
          {selectedMovie?.cover_image && (
            <img
              src={resolveImageUrl(selectedMovie.cover_image)}
              alt="Backdrop"
              className="w-full h-full object-cover opacity-40"
              style={{ filter: `brightness(${backdropConfig.brightness}) blur(${backdropConfig.blurPx}px)` }}
            />
          )}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.35),transparent_30%),radial-gradient(circle_at_80%_30%,rgba(236,72,153,0.25),transparent_35%),radial-gradient(circle_at_50%_70%,rgba(34,211,238,0.3),transparent_30%)]" />
          <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${overlayDark})` }} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/25 to-transparent" />
          <div className="absolute inset-0 neon-noise opacity-25" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto p-4 pt-28">
          <div className="text-sm py-9">
            <button className="text-blue-300 hover:text-blue-400 underline" onClick={() => navigate("/")}>Home</button>
            <span className="mx-2 text-white/60">&gt;</span>
            <span className="text-white">Đặt vé</span>
          </div>
          {isLoadingPage && (
            <Card className="bg-white/5 backdrop-blur-md border border-white/15 text-white shadow-xl">
              <CardHeader>
                <CardTitle>Đang tải dữ liệu đặt vé</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3 text-sm text-orange-400">
                <div className="w-5 h-5 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin" />
                Vui lòng chờ trong giây lát...
              </CardContent>
            </Card>
          )}

          {!isLoadingPage && step === 0 && (
            <Card className="bg-white/5 backdrop-blur-md border border-white/15 text-white shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-2xl font-bold text-white">Đặt Vé</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="text-sm font-medium text-gray-400">Chọn Phim</div>
                  <Select value={movie} onValueChange={(v) => { setMovie(v); try { refetchActive(); } catch { } }}>
                    <SelectTrigger className="w-full bg-white/10 backdrop-blur-sm text-white border-white/20 hover:bg-white/15 h-11">
                      <span className="truncate">{selectedMovie?.title || "Chọn phim"}</span>
                    </SelectTrigger>
                    <SelectContent className="bg-[#0b1226]/95 backdrop-blur-md text-white border border-white/20">
                      {(activeMoviesFull || []).map((m: any) => (
                        <SelectItem className="text-white py-2" key={m.id ?? m.title} value={m.title}>
                          <div className="flex items-center gap-3">
                            <img src={resolveImageUrl(m.cover_image)} alt={m.title} className="w-10 h-14 object-cover rounded border border-white/10" />
                            <div className="flex flex-col">
                              <span className="font-medium">{m.title}</span>
                              <span className="text-xs text-gray-400">{m.duration_min ? `${m.duration_min} phút` : "--"}</span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedMovie && (
                    <div className="mt-3 flex items-center gap-4 p-3 rounded-lg border border-white/15 bg-white/5 backdrop-blur-sm">
                      <img src={resolveImageUrl(selectedMovie.cover_image)} alt={selectedMovie.title} className="w-20 h-28 object-cover rounded" />
                      <div className="flex-1">
                        <div className="text-white font-semibold mb-1">{selectedMovie.title}</div>
                        <div className="text-sm text-gray-400">Thời lượng: {selectedMovie.duration_min ? `${selectedMovie.duration_min} phút` : "--"}</div>
                        {selectedMovie.genres && (
                          <div className="text-xs text-gray-500 mt-1">{Array.isArray(selectedMovie.genres) ? selectedMovie.genres.join(" / ") : selectedMovie.genres}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium text-gray-400">Thông Tin Khách Hàng</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-normal text-gray-300">Họ Và Tên</Label>
                      <Input className="bg-white/10 backdrop-blur-sm text-white border-white/20 focus-visible:ring-blue-400 hover:bg-white/15 h-11 placeholder:text-gray-500" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập họ và tên" minLength={2} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-normal text-gray-300">Số Điện Thoại</Label>
                      <Input
                        className="bg-white/10 backdrop-blur-sm text-white border-white/20 focus-visible:ring-blue-400 hover:bg-white/15 h-11 placeholder:text-gray-500"
                        value={phone}
                        inputMode="numeric"
                        placeholder="VD: 0912345678"
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D+/g, "");
                          setPhone(digits);
                          if (digits !== e.target.value) {
                            setPhoneError("Chỉ cho phép nhập số 0-9");
                          } else if (digits && !digits.startsWith("0")) {
                            setPhoneError("Số điện thoại phải bắt đầu bằng số 0");
                          } else if (digits && digits.length !== 10) {
                            setPhoneError("Số điện thoại phải có đúng 10 chữ số");
                          } else {
                            setPhoneError("");
                          }
                        }}
                        onKeyDown={(e) => {
                          const allow = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
                          if (allow.includes(e.key)) return;
                          if (!/^[0-9]$/.test(e.key)) {
                            e.preventDefault();
                            setPhoneError("Chỉ cho phép nhập số 0-9");
                          } else {
                            setPhoneError("");
                          }
                        }}
                      />
                      {phoneError && <div className="text-orange-400 text-xs mt-1">{phoneError}</div>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-normal text-gray-300">Email Nhận Vé</Label>
                      <Input
                        className="bg-white/10 backdrop-blur-sm text-white border-white/20 focus-visible:ring-blue-400 hover:bg-white/15 h-11 placeholder:text-gray-500"
                        value={email}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEmail(val);
                          if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                            setEmailError("Email không hợp lệ");
                          } else {
                            setEmailError("");
                          }
                        }}
                        type="email"
                        placeholder="you@email.com"
                      />
                      {emailError && <div className="text-orange-400 text-xs mt-1">{emailError}</div>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-normal text-gray-300">Số Lượng Vé</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-11 w-11"
                          onClick={() => setTicketCount((c) => Math.max(MIN_TICKETS, c - 1))}
                        >
                          -
                        </Button>
                        <div className="min-w-[3rem] text-center py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded text-white h-11 flex items-center justify-center">
                          {ticketCount}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-11 w-11"
                          onClick={() => setTicketCount((c) => Math.min(MAX_TICKETS, c + 1))}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium text-gray-400">Chọn Loại Vé</div>
                  <Select
                    value={selectedPackage?.id ? String(selectedPackage.id) : ""}
                    onValueChange={(v) => {
                      const pkg = ticketPackages.find((p: any) => String(p.id) === String(v));
                      setSelectedPackage(pkg || null);
                    }}
                  >
                    <SelectTrigger className="w-full bg-white/10 backdrop-blur-sm text-white border-white/20 hover:bg-white/15 h-11">
                      <span className="truncate">{selectedPackage?.name || "Chọn loại vé"}</span>
                    </SelectTrigger>
                    <SelectContent className="bg-[#0b1226]/95 backdrop-blur-md text-white border border-white/20">
                      {ticketPackages.map((t: any) => (
                        <SelectItem key={t.id} value={String(t.id)} className="text-white py-2">
                          <div className="flex items-center justify-between gap-3 w-full">
                            <span className="font-medium">{t.name}</span>
                            <span className="text-sm text-blue-300">{Number(t.price || 0).toLocaleString("vi-VN")}₫</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPackage && (
                    <div className="rounded-lg p-4 border border-white/15 bg-white/5 backdrop-blur-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-semibold">{selectedPackage.name}</span>
                        <div className="text-right text-md font-bold text-white">
                          {unitPrice.toLocaleString("vi-VN")}₫
                          <span className="text-xs font-normal text-gray-400"> / vé</span>
                        </div>
                      </div>
                      {(selectedPackage.description || selectedPackage.type) && (
                        <p className="text-sm text-gray-400">
                          {selectedPackage.description || `Gói vé ${selectedPackage.type}`}
                        </p>
                      )}
                      {Array.isArray(selectedPackage.features) && selectedPackage.features.length > 0 && (
                        <ul className="space-y-1">
                          {selectedPackage.features.map((f: string, idx: number) => (
                            <li key={idx} className="text-sm text-gray-300">• {f}</li>
                          ))}
                        </ul>
                      )}
                      <div className="pt-3 mt-2 border-t border-white/10 text-right">
                        <span className="text-lg font-bold text-white">
                          Tạm tính: {totalPrice.toLocaleString("vi-VN")}₫
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" className="bg-transparent border-white/30 text-white hover:bg-white/10 h-11 px-6" onClick={() => navigate("/")} disabled={isProcessing}>Hủy</Button>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg disabled:opacity-50 h-11 px-6"
                    onClick={() => {
                      const ok = window.confirm("Lưu ý thông tin vé của bạn sẽ được gửi đến email này");
                      if (ok) setStep(1);
                    }}
                    disabled={!movie || !selectedPackage || !name || !phone || !email || isProcessing || !!phoneError || !!emailError || phone.length !== 10}
                  >
                    Tiếp tục
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <>
              <Card className="bg-white/5 backdrop-blur-md border border-white/15 text-white shadow-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-2xl font-bold text-white">Thông tin đặt vé</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="rounded-lg p-4 border border-white/15 bg-white/5 backdrop-blur-sm">
                      <div className="text-sm font-medium text-gray-400 mb-3">Thông tin người đặt</div>
                      <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-2 text-sm">
                        <span className="text-gray-400">Họ tên</span><span className="font-medium text-white">{name}</span>
                        <span className="text-gray-400">Email</span><span className="font-medium text-white">{email}</span>
                        <span className="text-gray-400">Số lượng</span><span className="font-medium text-white">{ticketCount}</span>
                      </div>
                    </div>
                    {selectedMovie?.cover_image && (
                      <div className="p-3 rounded-lg border border-white/15 bg-white/5 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                          <img src={resolveImageUrl(selectedMovie.cover_image)} alt={selectedMovie.title} className="w-16 h-24 object-cover rounded" />
                          <div className="flex-1 grid grid-cols-[100px_1fr] gap-x-4 gap-y-1 text-sm">
                            <span className="text-gray-400">Phim</span>
                            <span className="font-medium text-white">{selectedMovie.title}</span>
                            <span className="text-gray-400">Thời lượng</span>
                            <span className="font-medium text-white">{selectedMovie.duration_min ? `${selectedMovie.duration_min} phút` : "--"}</span>
                            <span className="text-gray-400">Thể loại</span>
                            <span className="font-medium text-white">{selectedMovie.genres ? (Array.isArray(selectedMovie.genres) ? selectedMovie.genres.join(" / ") : selectedMovie.genres) : "--"}</span>
                            <span className="text-gray-400">Khởi chiếu</span>
                            <span className="font-medium text-white">{selectedMovie.release_date ? new Date(selectedMovie.release_date).toLocaleDateString("vi-VN") : "--"}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-gray-400">Phương thức thanh toán</div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("momo")}
                        className={`${paymentMethod === 'momo' ? 'border-pink-500 bg-pink-600/20' : 'border-white/20 bg-white/10 backdrop-blur-sm'} cursor-pointer rounded-lg border p-3 flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-pink-500 hover:bg-white/15 h-11`}
                        aria-pressed={paymentMethod === 'momo'}
                      >
                        <span className="inline-flex items-center gap-2 text-white">
                          <span className="w-7 h-7 rounded bg-pink-600 text-white grid place-items-center text-xs font-extrabold">Mo</span>
                          <span>MoMo</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("vnpay")}
                        className={`${paymentMethod === 'vnpay' ? 'border-blue-500 bg-blue-600/20' : 'border-white/20 bg-white/10 backdrop-blur-sm'} cursor-pointer rounded-lg border p-3 flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-white/15 h-11`}
                        aria-pressed={paymentMethod === 'vnpay'}
                      >
                        <span className="inline-flex items-center gap-2 text-white">
                          <span className="w-7 h-7 rounded bg-blue-600 text-white grid place-items-center text-[10px] font-extrabold">VN</span>
                          <span>VNPay</span>
                        </span>
                      </button>
                    </div>
                    <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/15">
                      <div className="text-sm font-medium text-gray-400 mb-3">Booking Summary</div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-400">Loại vé</span><span className="text-white font-medium">{selectedPackage?.name || defaultTicket?.name || 'Vé tiêu chuẩn'}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Đơn giá</span><span className="text-white">{unitPrice.toLocaleString('vi-VN')}₫</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Số lượng</span><span className="text-white">{ticketCount}</span></div>
                        <div className="flex justify-between border-t border-white/10 pt-2 mt-2"><span className="text-white font-semibold">Tổng Tiền</span><span className="text-white font-bold">{totalPrice.toLocaleString('vi-VN')}₫</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="md:col-span-2 pt-3 mt-1 border-t border-white/10 flex items-center gap-3">
                    <Checkbox
                      checked={confirmChecked}
                      onCheckedChange={(v) => setConfirmChecked(Boolean(v))}
                      className="border-white/40 data-[state=checked]:bg-blue-500"
                      aria-label="Xác nhận thông tin đặt vé"
                      id="confirm-checkbox"
                    />
                    <label htmlFor="confirm-checkbox" className="text-xs sm:text-sm text-gray-300">
                      Vui lòng xác nhận lại thông tin, bao gồm: loại vé, số lượng vé và email. Mã đặt vé sẽ gửi tới email này nếu thanh toán thành công.
                    </label>
                  </div>
                </CardContent>
              </Card>
              <div className="flex justify-between pt-4">
                <Button variant="outline" className="bg-transparent border-white/30 text-white hover:bg-white/10 h-11 px-6" onClick={() => setStep(0)} disabled={isProcessing}>Quay lại</Button>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg disabled:opacity-50 h-11 px-6" disabled={!confirmChecked || isProcessing} onClick={handleCreateAndPay}>
                  {isProcessing ? "Đang xử lý..." : "Thanh toán"}
                </Button>
              </div>
            </>
          )}
        </div>
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
