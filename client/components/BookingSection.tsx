import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
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
import { Ticket, Users, UserCheck, CreditCard, Clock, Check, Loader2 } from "lucide-react";
import { Radio, Space, DatePicker } from "antd";
import type { RadioChangeEvent } from "antd";
import type { Movie } from "@shared/api";
import { useMovies2025 } from "@/hooks/useMovies";
import { toast } from "@/components/ui/use-toast";

interface BookingSectionProps {
  onBookClick: () => void;
}

export default function BookingSection({ onBookClick }: BookingSectionProps) {
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
  const { data: movies = [], refetch: refetchMovies } = useMovies2025();
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearTimeout(countdownRef.current);
    };
  }, []);

  // movies fetched via React Query; no manual effect needed

  const handleOpenModal = () => {
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
    const defaults = { name: "", phone: "", email: "", ticketType: "standard", quantity: 1, movie: "" };
    const changed = Object.keys(defaults).some((k) => (formData as any)[k] !== (defaults as any)[k]);
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const max = new Date();
    max.setDate(max.getDate() + 3);
    max.setHours(23, 59, 59, 999);
    return d < today || d > max;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!formData.movie) nextErrors.movie = "Vui lòng chọn phim";
    if (!formData.name || formData.name.trim().length < 2)
      nextErrors.name = "Họ tên chưa hợp lệ";
    if (!/^[0-9]{9,11}$/.test(formData.phone))
      nextErrors.phone = "Số điện thoại 9-11 chữ số";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      nextErrors.email = "Email chưa hợp lệ";
    if (formData.quantity < 1 || formData.quantity > 10)
      nextErrors.quantity = "Số lượng từ 1 đến 10";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      toast({ title: "Thông tin chưa hợp lệ", description: "Vui lòng kiểm tra lại các trường", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    setCountdown(600);

    // Simulate payment processing with countdown
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setIsProcessing(false);
          toast({
            title: "Thanh toán thất bại",
            variant: "destructive",
          });
          handleCloseModal();
          return 600;
        }
        return prev - 1;
      });
    }, 1000);

    // In real app, this would call payment API
    timerRef.current = setTimeout(() => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setIsProcessing(false);
      const summary = {
        movie: selectedMovie?.title,
        dateDisplay: formData.date ? formData.date.toLocaleDateString("vi-VN") : "",
        showtime: formData.showtime,
        name: formData.name,
        quantity: formData.quantity,
        amount: totalPrice,
        method: paymentMethod,
      };
      const dataStr = encodeURIComponent(JSON.stringify({ ...summary, ref: Date.now().toString() }));
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${dataStr}`;
      setQrUrl(url);
      setOrderInfo(summary);
      setIsResultOpen(true);
      setIsModalOpen(false);
      setCountdown(600);
    }, 5000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const ticketPrice = 250000;
  const totalPrice = ticketPrice * formData.quantity;
  const selectedMovie = movies.find((m) => m.id === formData.movie);
console.log(formData)

  return (
    <>
      <section className="py-20 bg-gradient-section relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
                BẢNG GIÁ VÉ
              </h2>
              <div className="w-24 h-1 bg-gradient-to-r from-blue-400 to-purple-400 mx-auto mb-4"></div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="rounded-2xl p-6 border border-white/10 text-left bg-black/30 backdrop-blur-sm hover:bg-gradient-to-br hover:from-cyan-900/40 hover:via-cyan-700/20 hover:to-fuchsia-800/40 hover:shadow-[0_0_35px_rgba(99,102,241,0.25)] transition-all duration-300"
              >
                <div className="text-white font-semibold text-lg mb-3">Vé Tiêu Chuẩn</div>
                <div className="text-4xl md:text-5xl font-extrabold text-cyan-400 mb-1">
                  {ticketPrice.toLocaleString("vi-VN")}₫
                </div>
                <div className="text-sm text-gray-300 mb-5">/ phim (10-15 phút)</div>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-gray-100"><Check className="h-4 w-4 text-emerald-400" /> Ghế chuyển động 6D</li>
                  <li className="flex items-center gap-2 text-gray-100"><Check className="h-4 w-4 text-emerald-400" /> Mắt kính 3D active</li>
                  <li className="flex items-center gap-2 text-gray-100"><Check className="h-4 w-4 text-emerald-400" /> Hiệu ứng môi trường</li>
                </ul>
                <Button
                  onClick={handleOpenModal}
                  className="bg-white text-black hover:bg-white/90 font-semibold px-6 py-5 rounded-lg"
                >
                  Đặt Ngay
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="bg-black/30 rounded-2xl p-6 border border-white/10 text-center"
              >
                <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <div className="text-xl font-semibold text-white mb-1">Vé Nhóm</div>
                <div className="text-sm text-gray-400 mb-2">Đang cập nhật</div>
                <div className="text-xs text-gray-500 mb-6">Dành cho nhóm 4-6 người</div>
                <Button disabled className="bg-gray-700/60 text-gray-300">Sắp ra mắt</Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="bg-black/30 rounded-2xl p-6 border border-white/10 text-center"
              >
                <UserCheck className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <div className="text-xl font-semibold text-white mb-1">Thành Viên</div>
                <div className="text-sm text-gray-400 mb-2">Đang cập nhật</div>
                <div className="text-xs text-gray-500 mb-6">Ưu đãi đặc biệt cho hội viên</div>
                <Button disabled className="bg-gray-700/60 text-gray-300">Sắp ra mắt</Button>
              </motion.div>
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
          className="bg-gradient-dark border-cyan-400/30 shadow-[0_0_40px_rgba(34,211,238,0.25)] max-w-md max-h-[90vh] overflow-y-auto scrollbar-neon">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-cyan-300">
              Đặt Vé CINESPHERE
            </DialogTitle>
            <DialogDescription className="text-gray-300">
              Vui lòng điền thông tin để hoàn tất đặt vé
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="movie" className="text-white">
                Chọn Phim *
              </Label>
              <Select
                value={formData.movie}
                onValueChange={(value) => {
                  setFormData({ ...formData, movie: value });
                  refetchMovies();
                }}
              >
                <SelectTrigger disabled={isProcessing} className={`bg-black/40 text-white ${errors.movie ? "border-red-500" : "border-cyan-400/40"} focus:ring-cyan-400`}>
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
              {selectedMovie && (
                <div className="flex items-center gap-3 mt-2 p-2 rounded-lg bg-black/30 border border-white/10">
                  <img src={selectedMovie.posterUrl} alt={selectedMovie.title} className="w-12 h-12 rounded object-cover" />
                  <div className="text-sm text-gray-300">
                    <div className="font-semibold text-white">{selectedMovie.title}</div>
                    <div className="text-cyan-300">{selectedMovie.duration}</div>
                    <div className="text-fuchsia-400">{selectedMovie.genres.join(" / ")}</div>
                  </div>
                </div>
              )}
              {errors.movie && <div className="text-red-400 text-xs mt-1">{errors.movie}</div>}
              {selectedMovie && (
                <div className="mt-4 grid gap-3">
                  <Label className=" text-white">Chọn ngày</Label>
                  <DatePicker
                    className="w-full bg-white text-gray-900 placeholder:text-gray-500"
                    disabled={isProcessing}
                    onChange={(v) => setFormData({ ...formData, date: v ? v.toDate() : null, showtime: "" })}
                    disabledDate={disableOutOfRangeDate}
                    placeholder="Chọn ngày"
                  />
                  {errors.date && <div className="text-red-500 text-xs">{errors.date}</div>}
                  {formData.date && (
                    <div className="mt-2">
                      <Label className="text-white">Giờ chiếu</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {["10:00", "13:00", "16:00", "19:00", "21:00"].map((t) => (
                          <Button
                            key={t}
                            type="button"
                            variant={formData.showtime === t ? "default" : "outline"}
                            className={formData.showtime === t ? "bg-blue-600 text-white" : "border-gray-300 text-gray-900"}
                            disabled={isProcessing}
                            onClick={() => setFormData({ ...formData, showtime: t })}
                          >
                            {t}
                          </Button>
                        ))}
                      </div>
                      {errors.showtime && <div className="text-red-500 text-xs mt-1">{errors.showtime}</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">
                Họ và Tên *
              </Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                disabled={isProcessing}
                className={`bg-black/40 text-white ${errors.name ? "border-red-500" : "border-cyan-400/40"} focus-visible:ring-cyan-400`}
                placeholder="Nhập họ và tên"
              />
              {errors.name && <div className="text-red-400 text-xs mt-1">{errors.name}</div>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-white">
                Số Điện Thoại *
              </Label>
              <Input
                id="phone"
                type="tel"
                required
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                disabled={isProcessing}
                className={`bg-black/40 text-white ${errors.phone ? "border-red-500" : "border-cyan-400/40"} focus-visible:ring-cyan-400`}
                placeholder="Nhập số điện thoại"
              />
              {errors.phone && <div className="text-red-400 text-xs mt-1">{errors.phone}</div>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">
                Email *
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                disabled={isProcessing}
                className={`bg-black/40 text-white ${errors.email ? "border-red-500" : "border-cyan-400/40"} focus-visible:ring-cyan-400`}
                placeholder="Nhập email"
              />
              {errors.email && <div className="text-red-400 text-xs mt-1">{errors.email}</div>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity" className="text-white">Số Lượng Vé *</Label>
              <div className="flex items-center gap-2">
                <Button disabled={isProcessing} type="button" variant="outline" className="h-10 w-10 border-cyan-400/40 hover:bg-cyan-500/10" onClick={() => setFormData({ ...formData, quantity: Math.max(1, formData.quantity - 1) })}>-</Button>
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
                      quantity: Math.min(10, Math.max(1, parseInt(e.target.value) || 1)),
                    })
                  }
                  disabled={isProcessing}
                  className={`bg-black/40 text-white text-center ${errors.quantity ? "border-red-500" : "border-cyan-400/40"} focus-visible:ring-cyan-400`}
                />
                <Button disabled={isProcessing} type="button" variant="outline" className="h-10 w-10 border-cyan-400/40 hover:bg-cyan-500/10" onClick={() => setFormData({ ...formData, quantity: Math.min(10, formData.quantity + 1) })}>+</Button>
              </div>
              {errors.quantity && <div className="text-red-400 text-xs mt-1">{errors.quantity}</div>}
            </div>

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

            <div className="bg-black/40 rounded-lg p-4 border border-white/10">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-300">Tổng Tiền:</span>
                <span className="text-2xl font-bold text-blue-400">
                  {totalPrice.toLocaleString("vi-VN")}₫
                </span>
              </div>
              {selectedMovie && (
                <div className="text-sm text-gray-300">{selectedMovie.title} • {selectedMovie.duration}</div>
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

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={attemptClose}
                className="flex-1 border-white/20 text-black-400 hover:bg-gray-300"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={isProcessing || !formData.movie}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang xử lý...
                  </span>
                ) : (
                  "Tiếp tục"
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
            <DialogDescription className="text-gray-300">Bạn có chắc muốn đóng form? Dữ liệu đang nhập sẽ bị mất.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsConfirmOpen(false)}>Tiếp tục chỉnh sửa</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleCloseModal}>Tiếp tục đóng</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
        <DialogContent className="max-w-md bg-white text-black border border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Thông tin mua vé</DialogTitle>
            <DialogDescription className="text-gray-600">Quét QR để thanh toán và lưu vé của bạn</DialogDescription>
          </DialogHeader>
          {orderInfo && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-600">Phim</span><span className="font-medium">{orderInfo.movie}</span>
                <span className="text-gray-600">Ngày</span><span className="font-medium">{orderInfo.dateDisplay}</span>
                <span className="text-gray-600">Giờ</span><span className="font-medium">{orderInfo.showtime}</span>
                <span className="text-gray-600">Họ tên</span><span className="font-medium">{orderInfo.name}</span>
                <span className="text-gray-600">Số lượng</span><span className="font-medium">{orderInfo.quantity}</span>
                <span className="text-gray-600">Thanh toán</span><span className="font-medium">{orderInfo.method === "momo" ? "MoMo" : "VNPay"}</span>
                <span className="text-gray-600">Tổng tiền</span><span className="font-semibold text-blue-600">{orderInfo.amount.toLocaleString("vi-VN")}₫</span>
              </div>
              <div className="flex items-center justify-center py-4">
                {qrUrl && <img src={qrUrl} alt="QR thanh toán" className="rounded-md border" />}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setIsResultOpen(false)}>Đóng</Button>
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => {
                  setIsResultOpen(false);
                  handleCloseModal();
                }}>Hoàn tất</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

