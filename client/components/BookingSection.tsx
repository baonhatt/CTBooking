import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Ticket,
  Users,
  UserCheck,
  CreditCard,
  Clock,
  Check,
  Loader2,
} from "lucide-react";
import { Radio, Space, Steps } from "antd";
import { motion } from "framer-motion";
import type { RadioChangeEvent } from "antd";
import { useQuery } from "@tanstack/react-query";
import { getAllActiveMoviesToday, getActiveTickets } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import {
  createMomoPaymentApi,
  createVnpayPaymentApi,
  API_BASE_URL,
  createBookingApi,
  getBookingByIdApi,
} from "@/lib/api";

interface BookingSectionProps {
  onBookClick: () => void;
}

export default function BookingSection({ onBookClick }: BookingSectionProps) {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("momo");
  interface BookingFormData {
    name: string;
    phone: string;
    email: string;
    ticketType: string;
    quantity: number;
    movie: string;
    date: Date;
    showtime: string;
  }

  const [formData, setFormData] = useState<BookingFormData>({
    name: "",
    phone: "",
    email: "",
    ticketType: "standard",
    quantity: 1,
    movie: "",
    date: new Date(),
    showtime: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [countdown, setCountdown] = useState(600); // 10 minutes in seconds
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const { data: activeData } = useQuery({
    queryKey: ["activeMovies", "today"],
    queryFn: () => getAllActiveMoviesToday(),
  });
  const { data: ticketsData } = useQuery({
    queryKey: ["activeTickets"],
    queryFn: ({ signal }) => getActiveTickets({ signal }),
  });
  const movies = (activeData?.activeMovies || []).map((m: any) => ({
    id: m.title,
    title: m.title,
  }));
  const activeMoviesFull = activeData?.activeMovies || [];
  const [selectedShowtimeId, setSelectedShowtimeId] = useState<number | null>(
    null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState<number>(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearTimeout(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resultCode = params.get("resultCode");
    const orderId = params.get("orderId");
    const amountParam = params.get("amount");
    const extraDataParam = params.get("extraData");
    if (resultCode && orderId) {
      try {
        let pending: any = {};
        if (extraDataParam) {
          try {
            pending = JSON.parse(
              decodeURIComponent(escape(atob(extraDataParam))),
            );
          } catch { }
        }
        if (!pending || Object.keys(pending).length === 0) {
          const pendingStr = localStorage.getItem("pendingOrder");
          pending = pendingStr ? JSON.parse(pendingStr) : {};
        }
        const status = resultCode === "0" ? "success" : "failed";
        const summary = {
          ...pending,
          amount: amountParam ? Number(amountParam) : pending?.amount,
          method: "momo",
          status,
        };
        setOrderInfo(summary);
        setIsResultOpen(true);
        setIsModalOpen(false);
        setIsProcessing(false);
        localStorage.removeItem("pendingOrder");

        // Fetch booking code nếu thanh toán thành công
        if (status === "success" && pending.booking_id) {
          (async () => {
            try {
              const bookingData = await getBookingByIdApi(pending.booking_id);
              if (bookingData.booking_code) {
                setOrderInfo((prev: any) => ({
                  ...prev,
                  bookingCode: bookingData.booking_code,
                }));
              }
            } catch (err) {
              console.error("Lỗi fetch booking code:", err);
            }
          })();
        }

        // Show notification based on payment status
        if (status === "success") {
          toast({
            title: "✅ Thanh toán thành công",
            description: "Vui lòng kiểm tra email để nhận mã đặt vé",
            variant: "default",
          });
        } else {
          toast({
            title: "❌ Thanh toán không thành công",
            description: "Vui lòng thử lại",
            variant: "destructive",
          });
        }
      } catch { }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleOpenModal = () => {
    const raw = localStorage.getItem("authUser");
    if (!raw) {
      toast({
        title: "Vui lòng đăng nhập",
        description: "Bạn cần đăng nhập trước khi đặt vé",
        variant: "default",
      });
      window.dispatchEvent(new Event("open-login"));
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const emailFromAuth = parsed?.user?.email || parsed?.email || "";
      if (emailFromAuth) {
        setFormData((prev) => ({ ...prev, email: emailFromAuth }));
      }
    } catch { }
    setIsModalOpen(true);
    onBookClick();
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({
      name: "",
      phone: "",
      email: "",
      ticketType: "standard",
      quantity: 1,
      movie: "",
      date: new Date(),
      showtime: "",
    });
    setPaymentMethod("momo");
    setErrors({});
    setIsConfirmOpen(false);
  };

  const isFormDirty = () => {
    const defaults = {
      name: "",
      phone: "",
      email: "",
      ticketType: "standard",
      quantity: 1,
      movie: "",
    };
    const changed = Object.keys(defaults).some(
      (k) => (formData as any)[k] !== (defaults as any)[k],
    );
    return changed || Object.keys(errors).length > 0 || isProcessing;
  };

  const attemptClose = () => {
    if (isFormDirty()) {
      setIsConfirmOpen(true);
      return;
    }
    handleCloseModal();
  };

  const disableOutOfRangeDate = (current: any) => {
    if (!current) return false;
    const d: Date = current.toDate();
    const movieDetail = activeMoviesFull.find(
      (x: any) => x.title === formData.movie,
    );
    const sts = movieDetail?.showtimes || [];
    const set = new Set(
      sts.map((s: any) => new Date(s.start_time).toDateString()),
    );
    return !set.has(d.toDateString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (currentStep === 0) {
      if (!formData.movie) nextErrors.movie = "Vui lòng chọn phim";
      if (!formData.name || formData.name.trim().length < 2)
        nextErrors.name = "Họ tên chưa hợp lệ";
      if (!/^[0-9]{9,11}$/.test(formData.phone))
        nextErrors.phone = "Số điện thoại 9-11 chữ số";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
        nextErrors.email = "Email chưa hợp lệ";
      if (formData.quantity < 1 || formData.quantity > 10)
        nextErrors.quantity = "Số lượng từ 1 đến 10";
      if (!formData.date) nextErrors.date = "Vui lòng chọn ngày";
      if (!formData.showtime || !selectedShowtimeId)
        nextErrors.showtime = "Vui lòng chọn giờ";
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        toast({
          title: "Thông tin chưa hợp lệ",
          description: "Vui lòng kiểm tra lại các trường",
          variant: "destructive",
        });
        return;
      }
      setErrors({});
      setCurrentStep(1);
      return;
    }
    if (currentStep === 1) {
      if (!paymentMethod) {
        toast({
          title: "Chọn phương thức",
          description: "Vui lòng chọn phương thức thanh toán",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep(2);
      return;
    }
    if (currentStep === 2) {
      const orderId = `ORDER_${Date.now()}`;
      const movieDetail = activeMoviesFull.find(
        (x: any) => x.title === formData.movie,
      );
      const authRaw = localStorage.getItem("authUser");
      if (!authRaw) {
        toast({
          title: "Vui lòng đăng nhập",
          description: "Bạn cần đăng nhập trước khi thanh toán",
          variant: "destructive",
        });
        window.dispatchEvent(new Event("open-login"));
        return;
      }
      let emailBook = formData.email;
      let authName = formData.name;
      let authEmail = "";
      try {
        const parsed = JSON.parse(authRaw);
        authEmail = parsed?.user?.email || parsed?.email || authEmail;
        authName = parsed?.user?.username || parsed?.username || authName;
      } catch { }
      const summary = {
        orderId,
        movie: selectedMovie?.title,
        dateDisplay: formData.date
          ? formData.date.toLocaleDateString("vi-VN")
          : "",
        showtime: formData.showtime,
        showtimeId: selectedShowtimeId,
        name: formData.name,
        phone: formData.phone,
        email: authEmail,
        emailBook: emailBook,
        quantity: formData.quantity,
        amount: totalPrice,
        method: paymentMethod,
        poster: movieDetail?.cover_image || "",
        duration: movieDetail?.duration_min
          ? `${movieDetail.duration_min}`
          : "",
        genres: movieDetail?.genres || "",
      };
      try {
        const showtimeId = selectedShowtimeId as number;
        const { booking } = await createBookingApi({
          email: authEmail,
          emailBook: emailBook,
          phone: formData.phone,
          name: formData.name,
          showtimeId,
          ticketCount: formData.quantity,
          paymentMethod: paymentMethod as any,
          totalPrice,
        });

        localStorage.setItem(
          "pendingOrder",
          JSON.stringify({
            ...summary,
            booking_id: booking?.id,
            user_id: booking?.user_id,
          }),
        );
        let orderInfoText = `${selectedMovie?.title || "Movie"} | ${formData.quantity} vé | ${formData.showtime || "--:--"}`;
        
        if (paymentMethod === "momo") {
          const extraDataEncoded = btoa(
            unescape(
              encodeURIComponent(
                JSON.stringify({
                  ...summary,
                  booking_id: booking?.id,
                  user_id: booking?.user_id,
                }),
              ),
            ),
          );
          const partnerCode =
            (import.meta as any).env?.VITE_MOMO_PARTNER_CODE || "";
          const partnerName =
            (import.meta as any).env?.VITE_MOMO_PARTNER_NAME || "CineSphere";
          const storeId =
            (import.meta as any).env?.VITE_MOMO_STORE_ID || "devstore";
          const redirectUrl =
            (import.meta as any).env?.VITE_MOMO_REDIRECT_URL ||
            window.location.origin + "/checkout";
          const ipnUrl =
            (import.meta as any).env?.VITE_MOMO_IPN_URL ||
            (API_BASE_URL
              ? API_BASE_URL + "/api/momo/ipn"
              : window.location.origin + "/api/momo/ipn");
          const accessKey =
            (import.meta as any).env?.VITE_MOMO_ACCESS_KEY || "";
          const secretKey =
            (import.meta as any).env?.VITE_MOMO_SECRET_KEY || "";
          const requestId = Date.now().toString();
          const payload = {
            partnerCode,
            partnerName,
            storeId,
            requestId,
            amount: totalPrice,
            orderId,
            orderInfo: orderInfoText,
            redirectUrl,
            ipnUrl,
            lang: "vi",
            extraData: extraDataEncoded,
            requestType: "captureWallet",
            signature: "",
            accessKey,
            secretKey,
          } as any;
          const res = await createMomoPaymentApi(payload);
          if (res?.payUrl) {
            setIsModalOpen(false);
            window.location.href = res.payUrl;
            return;
          }
          throw new Error("Không nhận được liên kết thanh toán MoMo");
        } else if (paymentMethod === "vnpay") {
          orderInfoText = booking?.id;
          const returnUrl =
            (import.meta as any).env?.VITE_VNPAY_RETURN_URL ||
            window.location.origin + "/checkout";
          const locale = "vn";
          const res = await createVnpayPaymentApi({
            amount: totalPrice,
            orderId,
            orderInfo: orderInfoText,
            locale,
            returnUrl,
          });
          if (res?.payUrl) {
            setIsModalOpen(false);
            window.location.href = res.payUrl;
            return;
          }
          throw new Error("Không nhận được liên kết thanh toán VNPay");
        } else {
          throw new Error("Phương thức thanh toán không hợp lệ");
        }
      } catch (err: any) {
        toast({
          title: "Không thể tạo đặt vé",
          description: err?.message || "Vui lòng thử lại",
          variant: "destructive",
        });
        return;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  const ticketPackages = (ticketsData?.items || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    price: Number(t.price || 0),
    features: Array.isArray(t.features) ? t.features : [],
    type: t.type || "",
    display_order: t.display_order || 0,

  }));
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const ticketPrice = selectedPackage
    ? Number(selectedPackage.price || 0)
    : 250000;
  const totalPrice = ticketPrice * formData.quantity;
  const selectedMovie = movies.find((m) => m.id === formData.movie);

  return (
    <>
      <section className="py-20 bg-gradient-section relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-8">
              {ticketPackages.map((pkg, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
                  className="
                    rounded-2xl p-6 border border-white/10 bg-black/30 backdrop-blur-sm
                    hover:bg-gradient-to-br hover:from-cyan-900/40 hover:via-cyan-700/20 hover:to-fuchsia-800/40
                    hover:shadow-[0_0_35px_rgba(99,102,241,0.25)]
                    transition-all duration-300
                    h-full flex flex-col
                  "
                >
                  <div className="text-xl font-semibold text-white mb-1">
                    {pkg.name}
                  </div>

                  <div className="h-20 text-4xl md:text-4xl font-extrabold text-cyan-400 mb-1">
                    {Number(pkg.price || 0).toLocaleString("vi-VN")}₫
                  </div>

                  <ul className="space-y-2 mb-6 flex-grow">
                    {(pkg.features?.length
                      ? pkg.features
                      : [
                        "Ghế chuyển động 6D",
                        "Mắt kính 3D active",
                        "Hiệu ứng môi trường",
                      ]
                    ).map((f, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 text-gray-100"
                      >
                        <Check className="h-4 w-4 text-emerald-400" /> {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => {
                      setSelectedPackage(pkg);
                      handleOpenModal();
                    }}
                    className="bg-white text-black hover:bg-white/90 font-semibold mt-auto"
                  >
                    Đặt Ngay
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            attemptClose();
          } else {
            setIsModalOpen(true);
          }
        }}
        modal={true}
      >
        <DialogContent
          onInteractOutside={(e) => {
            e.preventDefault();
          }}
          className="bg-gradient-dark border-cyan-400/30 shadow-[0_0_40px_rgba(34,211,238,0.25)] w-full h-[100vh] max-h-[100vh] rounded-none sm:rounded-xl sm:w-auto sm:max-w-md md:max-w-lg sm:h-auto sm:max-h-[90vh] p-4 sm:p-6 overflow-y-auto scrollbar-neon"
        >
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-bold text-cyan-300">
              Đặt Vé CINESPHERE
            </DialogTitle>
            <DialogDescription className="text-gray-300 text-sm sm:text-base">
              Vui lòng điền thông tin để hoàn tất đặt vé
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div
              className="steps-white-text align-center [&_.ant-steps-item-title]:text-xs sm:[&_.ant-steps-item-title]:text-sm md:[&_.ant-steps-item-title]:text-base
                          [&_.ant-steps-item-description]:text-xs sm:[&_.ant-steps-item-description]:text-sm md:[&_.ant-steps-item-description]:text-base
                          "
            >
              <Steps
                current={currentStep}
                size="small"
                onChange={(c) => {
                  const isStep0Valid =
                    !!formData.movie &&
                    !!formData.name &&
                    formData.name.trim().length >= 2 &&
                    /^[0-9]{9,11}$/.test(formData.phone) &&
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
                    formData.quantity >= 1 &&
                    formData.quantity <= 10 &&
                    !!formData.date &&
                    !!formData.showtime &&
                    !!selectedShowtimeId;
                  if (c <= currentStep) {
                    setCurrentStep(c);
                    return;
                  }
                  if (currentStep === 0 && isStep0Valid) {
                    setCurrentStep(1);
                    return;
                  }
                  if (currentStep === 1 && !!paymentMethod) {
                    setCurrentStep(2);
                    return;
                  }
                }}
                className="[&_.ant-steps-item-title]:text-white [&_.ant-steps-item-description]:text-white/70"
                items={[
                  { title: <span className="text-white">Thông tin</span> },
                  { title: <span className="text-white">Thanh toán</span> },
                  { title: <span className="text-white">Xác nhận</span> },
                ]}
              />
            </div>
            {currentStep === 0 && (
              <div className="space-y-2">
                <Label
                  htmlFor="movie"
                  className="text-white text-sm sm:text-base"
                >
                  Chọn Phim *
                </Label>
                <motion.div
                  animate={errors.movie ? { x: [0, -6, 6, -6, 6, 0] } : {}}
                  transition={{ duration: 0.35 }}
                >
                  <Select
                    value={formData.movie}
                    onValueChange={(value) => {
                      setFormData({
                        ...formData,
                        movie: value,
                        date: new Date(),
                        showtime: "",
                      });
                      setSelectedShowtimeId(null);
                    }}
                  >
                    <SelectTrigger
                      disabled={isProcessing}
                      className={`bg-black/40 text-white h-10 sm:h-11 ${errors.movie ? "border-yellow-400" : "border-cyan-400/40"} ${errors.movie ? "focus:ring-yellow-400" : "focus:ring-cyan-400"}`}
                    >
                      <SelectValue placeholder="Chọn phim" />
                    </SelectTrigger>
                    <SelectContent>
                      {movies.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
                {selectedMovie && (
                  <div className="flex items-center gap-3 mt-2 p-2 rounded-lg bg-black/30 border border-white/10">
                    <img
                      src={
                        activeMoviesFull.find(
                          (x: any) => x.title === selectedMovie.title,
                        )?.cover_image || ""
                      }
                      alt={selectedMovie.title}
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded object-cover"
                    />
                    <div className="text-sm text-gray-300">
                      <div className="font-semibold text-white">
                        {selectedMovie.title}
                      </div>
                      <div className="text-cyan-300">
                        {activeMoviesFull.find(
                          (x: any) => x.title === selectedMovie.title,
                        )?.duration_min
                          ? `${activeMoviesFull.find((x: any) => x.title === selectedMovie.title)?.duration_min}`
                          : ""}
                      </div>
                      <div className="text-fuchsia-400">
                        {activeMoviesFull.find(
                          (x: any) => x.title === selectedMovie.title,
                        )?.genres || ""}
                      </div>
                    </div>
                  </div>
                )}
                {errors.movie && (
                  <div className="text-red-400 text-xs mt-1">
                    {errors.movie}
                  </div>
                )}
                {selectedMovie && (
                  <div className="mt-4 grid gap-3">
                    <Label className=" text-white text-sm sm:text-base">
                      Chọn ngày
                    </Label>
                    <motion.div
                      className={`flex flex-wrap gap-2 ${errors.date ? "ring-2 ring-yellow-400 rounded p-2" : ""}`}
                      animate={errors.date ? { x: [0, -6, 6, -6, 6, 0] } : {}}
                      transition={{ duration: 0.35 }}
                    >
                      {Array.from(
                        new Set(
                          (
                            activeMoviesFull.find(
                              (x: any) => x.title === formData.movie,
                            )?.showtimes || []
                          ).map((s: any) =>
                            new Date(s.start_time).toDateString(),
                          ),
                        ),
                      ).map((dateStr: string) => {
                        const d = new Date(dateStr);
                        const isActive =
                          !!formData.date &&
                          formData.date.toDateString() === dateStr;
                        return (
                          <Button
                            key={dateStr}
                            type="button"
                            variant={isActive ? "default" : "outline"}
                            className={
                              isActive
                                ? "bg-blue-600 text-white"
                                : "border-gray-300 text-gray-900"
                            }
                            disabled={isProcessing}
                            onClick={() => {
                              setFormData({
                                ...formData,
                                date: d,
                                showtime: "",
                              });
                              setSelectedShowtimeId(null);
                            }}
                          >
                            {d.toLocaleDateString("vi-VN")}
                          </Button>
                        );
                      })}
                    </motion.div>
                    {errors.date && (
                      <div className="text-red-500 text-xs">{errors.date}</div>
                    )}
                    {formData.date && (
                      <div className="mt-2">
                        <Label className="text-white text-sm sm:text-base">
                          Giờ chiếu
                        </Label>
                        <motion.div
                          className={`flex flex-wrap gap-2 mt-2 ${errors.showtime ? "ring-2 ring-yellow-400 rounded p-2" : ""}`}
                          animate={
                            errors.showtime ? { x: [0, -6, 6, -6, 6, 0] } : {}
                          }
                          transition={{ duration: 0.35 }}
                        >
                          {(
                            activeMoviesFull.find(
                              (x: any) => x.title === formData.movie,
                            )?.showtimes || []
                          )
                            .filter(
                              (st: any) =>
                                new Date(st.start_time).toDateString() ===
                                (formData.date
                                  ? formData.date.toDateString()
                                  : ""),
                            )
                            .map((st: any) => {
                              const t = new Date(st.start_time);
                              const label = `${t.getHours().toString().padStart(2, "0")}:${t.getMinutes().toString().padStart(2, "0")}`;
                              const isActive = formData.showtime === label;
                              return (
                                <Button
                                  key={st.id}
                                  type="button"
                                  variant={isActive ? "default" : "outline"}
                                  className={
                                    isActive
                                      ? "bg-blue-600 text-white"
                                      : "border-gray-300 text-gray-900"
                                  }
                                  disabled={isProcessing}
                                  onClick={() => {
                                    setFormData({
                                      ...formData,
                                      showtime: label,
                                    });
                                    setSelectedShowtimeId(st.id);
                                  }}
                                >
                                  {label}
                                </Button>
                              );
                            })}
                        </motion.div>
                        {errors.showtime && (
                          <div className="text-red-500 text-xs mt-1">
                            {errors.showtime}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {currentStep === 0 && (
              <div className="space-y-2">
                <Label
                  htmlFor="name"
                  className="text-white text-sm sm:text-base"
                >
                  Họ và Tên *
                </Label>
                <motion.div
                  animate={errors.name ? { x: [0, -6, 6, -6, 6, 0] } : {}}
                  transition={{ duration: 0.35 }}
                >
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    disabled={isProcessing}
                    className={`bg-black/40 text-white h-10 sm:h-11 ${errors.name ? "border-yellow-400 ring-1 ring-yellow-300" : "border-cyan-400/40"} ${errors.name ? "focus-visible:ring-yellow-400" : "focus-visible:ring-cyan-400"}`}
                    placeholder="Nhập họ và tên"
                  />
                </motion.div>
                {errors.name && (
                  <div className="text-red-400 text-xs mt-1">{errors.name}</div>
                )}
              </div>
            )}
            {currentStep === 0 && (
              <div className="space-y-2">
                <Label
                  htmlFor="phone"
                  className="text-white text-sm sm:text-base"
                >
                  Số Điện Thoại *
                </Label>
                <motion.div
                  animate={errors.phone ? { x: [0, -6, 6, -6, 6, 0] } : {}}
                  transition={{ duration: 0.35 }}
                >
                  <Input
                    id="phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    disabled={isProcessing}
                    className={`bg-black/40 text-white h-10 sm:h-11 ${errors.phone ? "border-yellow-400 ring-1 ring-yellow-300" : "border-cyan-400/40"} ${errors.phone ? "focus-visible:ring-yellow-400" : "focus-visible:ring-cyan-400"}`}
                    placeholder="Nhập số điện thoại"
                  />
                </motion.div>
                {errors.phone && (
                  <div className="text-red-400 text-xs mt-1">
                    {errors.phone}
                  </div>
                )}
              </div>
            )}
            {currentStep === 0 && (
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-white text-sm sm:text-base"
                >
                  Email *
                </Label>
                <motion.div
                  animate={errors.email ? { x: [0, -6, 6, -6, 6, 0] } : {}}
                  transition={{ duration: 0.35 }}
                >
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    disabled={isProcessing}
                    className={`bg-black/40 text-white h-10 sm:h-11 ${errors.email ? "border-yellow-400 ring-1 ring-yellow-300" : "border-cyan-400/40"} ${errors.email ? "focus-visible:ring-yellow-400" : "focus-visible:ring-cyan-400"}`}
                    placeholder="Nhập email"
                  />
                </motion.div>
                {errors.email && (
                  <div className="text-red-400 text-xs mt-1">
                    {errors.email}
                  </div>
                )}
              </div>
            )}
            {currentStep === 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label
                    htmlFor="quantity"
                    className="text-white text-sm sm:text-base"
                  >
                    Số Lượng Vé *
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={isProcessing}
                      type="button"
                      variant="outline"
                      className="h-10 w-10 border-cyan-400/40 hover:bg-cyan-500/10"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          quantity: Math.max(1, formData.quantity - 1),
                        })
                      }
                    >
                      -
                    </Button>
                    <motion.div
                      animate={
                        errors.quantity ? { x: [0, -6, 6, -6, 6, 0] } : {}
                      }
                      transition={{ duration: 0.35 }}
                    >
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        max="10"
                        required
                        value={formData.quantity}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            quantity: Math.min(
                              10,
                              Math.max(1, parseInt(e.target.value) || 1),
                            ),
                          })
                        }
                        disabled={isProcessing}
                        className={`w-20 sm:w-24 bg-black/40 text-white text-center h-10 sm:h-11 ${errors.quantity ? "border-yellow-400 ring-1 ring-yellow-300" : "border-cyan-400/40"} ${errors.quantity ? "focus-visible:ring-yellow-400" : "focus-visible:ring-cyan-400"}`}
                      />
                    </motion.div>
                    <Button
                      disabled={isProcessing}
                      type="button"
                      variant="outline"
                      className="h-10 w-10 border-cyan-400/40 hover:bg-cyan-500/10"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          quantity: Math.min(10, formData.quantity + 1),
                        })
                      }
                    >
                      +
                    </Button>
                  </div>
                </div>
                {errors.quantity && (
                  <div className="text-red-400 text-xs mt-1">
                    {errors.quantity}
                  </div>
                )}
              </div>
            )}
            {currentStep === 1 && (
              <div className="space-y-4">
                <Label className="text-white">Phương Thức Thanh Toán *</Label>
                <Radio.Group
                  value={paymentMethod}
                  onChange={(e: RadioChangeEvent) =>
                    setPaymentMethod(e.target.value)
                  }
                  className="w-full"
                >
                  <Space direction="vertical" className="w-full">
                    <Radio
                      value="momo"
                      disabled={isProcessing}
                      className="text-white [&>span]:text-white"
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-pink-400" />
                        <span>MoMo</span>
                      </div>
                    </Radio>
                    <Radio
                      value="vnpay"
                      disabled={isProcessing}
                      className="text-white [&>span]:text-white"
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-blue-400" />
                        <span>VNPay</span>
                      </div>
                    </Radio>
                  </Space>
                </Radio.Group>
              </div>
            )}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-cyan-200">Phim</span>
                  <span className="font-medium text-white">
                    {selectedMovie?.title}
                  </span>
                  <span className="text-cyan-200">Ngày</span>
                  <span className="font-medium text-white">
                    {formData.date
                      ? formData.date.toLocaleDateString("vi-VN")
                      : ""}
                  </span>
                  <span className="text-cyan-200">Giờ</span>
                  <span className="font-medium text-white">
                    {formData.showtime}
                  </span>
                  <span className="text-cyan-200">Họ tên</span>
                  <span className="font-medium text-white">
                    {formData.name}
                  </span>
                  <span className="text-cyan-200">Số lượng</span>
                  <span className="font-medium text-white">
                    {formData.quantity}
                  </span>
                  <span className="text-cyan-200">Thanh toán</span>
                  <span className="font-medium text-white">
                    {paymentMethod === "momo" ? "MoMo" : "VNPay"}
                  </span>
                </div>
              </div>
            )}
            <div className="bg-black/40 rounded-lg p-3 sm:p-4 border border-white/10">
              <div className="flex justify-between items-center mb-2">
                <span className="text-white text-sm sm:text-base">
                  Tổng Tiền:
                </span>
                <span className="text-xl sm:text-2xl font-bold text-blue-400">
                  {totalPrice.toLocaleString("vi-VN")}₫
                </span>
              </div>
              {selectedMovie && (
                <div className="text-xs sm:text-sm text-cyan-200">
                  {selectedMovie.title} •{" "}
                  {activeMoviesFull.find(
                    (x: any) => x.title === selectedMovie.title,
                  )?.duration_min
                    ? `${activeMoviesFull.find((x: any) => x.title === selectedMovie.title)?.duration_min}`
                    : ""}
                </div>
              )}
            </div>

            {isProcessing && (
              <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-yellow-400 mb-2">
                  <Clock className="h-5 w-5" />
                  <span className="font-semibold">
                    Đang xử lý thanh toán...
                  </span>
                </div>
                <div className="text-yellow-300">
                  Thời gian còn lại:{" "}
                  <span className="font-bold">{formatTime(countdown)}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 sm:gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (currentStep > 0) setCurrentStep(currentStep - 1);
                  else attemptClose();
                }}
                className="flex-1 border-white/20 text-black-400 hover:bg-gray-300 h-10 sm:h-11"
              >
                {currentStep > 0 ? "Quay lại" : "Hủy"}
              </Button>
              <Button
                type="submit"
                disabled={(() => {
                  const isStep0Valid =
                    !!formData.movie &&
                    !!formData.name &&
                    formData.name.trim().length >= 2 &&
                    /^[0-9]{9,11}$/.test(formData.phone) &&
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
                    formData.quantity >= 1 &&
                    formData.quantity <= 10 &&
                    !!formData.date &&
                    !!formData.showtime &&
                    !!selectedShowtimeId;
                  const canProceed =
                    currentStep === 0
                      ? isStep0Valid
                      : currentStep === 1
                        ? !!paymentMethod
                        : true;
                  return isProcessing || !canProceed;
                })()}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white h-10 sm:h-11"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang xử lý...
                  </span>
                ) : currentStep < 2 ? (
                  "Tiếp tục"
                ) : (
                  "Xác nhận"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-sm bg-black/80 border border-white/20">
          <DialogHeader>
            <DialogTitle className="text-white">Xác nhận đóng</DialogTitle>
            <DialogDescription className="text-gray-300">
              Bạn có chắc muốn đóng form? Dữ liệu đang nhập sẽ bị mất.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setIsConfirmOpen(false)}
            >
              Tiếp tục chỉnh sửa
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={handleCloseModal}
            >
              Tiếp tục đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
        <DialogContent className="max-w-md bg-white text-black border border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              ✅ Đặt vé thành công
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              {orderInfo?.status === "success"
                ? "Vui lòng kiểm tra email để nhận mã đặt vé"
                : "Thanh toán không thành công"}
            </DialogDescription>
          </DialogHeader>
          {orderInfo && (
            <div className="space-y-4">
              {orderInfo?.status === "success" && (
                <>
                  <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                    <p className="text-sm text-green-700">
                      <strong>📧 Mã đặt vé đã được gửi đến:</strong><br />
                      {orderInfo.emailBook || orderInfo.email}
                    </p>
                    <p className="text-xs text-green-600 mt-2">
                      Vui lòng kiểm tra email (cả thư mục spam) để lấy mã vé của bạn
                    </p>
                  </div>
                  {orderInfo.bookingCode && (
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                      <p className="text-xs text-blue-600 font-semibold mb-2">MÃ ĐẶT VÉ</p>
                      <p className="text-2xl font-bold text-blue-700 font-mono tracking-wider">
                        {orderInfo.bookingCode}
                      </p>
                      <p className="text-xs text-blue-600 mt-2">
                        Lưu lại mã này để check-in tại rạp
                      </p>
                    </div>
                  )}
                </>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-600">Phim</span>
                <span className="font-medium">{orderInfo.movie}</span>
                <span className="text-gray-600">Ngày</span>
                <span className="font-medium">{orderInfo.dateDisplay}</span>
                <span className="text-gray-600">Giờ</span>
                <span className="font-medium">{orderInfo.showtime}</span>
                <span className="text-gray-600">Họ tên</span>
                <span className="font-medium">{orderInfo.name}</span>
                <span className="text-gray-600">Số lượng</span>
                <span className="font-medium">{orderInfo.quantity}</span>
                <span className="text-gray-600">Thanh toán</span>
                <span className="font-medium">
                  {orderInfo.method === "momo" ? "MoMo" : "VNPay"}
                </span>
                <span className="text-gray-600">Tổng tiền</span>
                <span className="font-semibold text-blue-600">
                  {orderInfo.amount.toLocaleString("vi-VN")}₫
                </span>
              </div>
              <div className="flex items-center justify-center py-4">
                {qrUrl && (
                  <img
                    src={qrUrl}
                    alt="QR thanh toán"
                    className="rounded-md border"
                  />
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsResultOpen(false)}
                >
                  Đóng
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    setIsResultOpen(false);
                    handleCloseModal();
                  }}
                >
                  Hoàn tất
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
