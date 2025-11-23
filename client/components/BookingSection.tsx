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
import { Ticket, Users, UserCheck, CreditCard, Clock, Check } from "lucide-react";
import { Radio, Space } from "antd";
import type { RadioChangeEvent } from "antd";

interface BookingSectionProps {
  onBookClick: () => void;
}

export default function BookingSection({ onBookClick }: BookingSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("momo");
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    ticketType: "standard",
    quantity: 1,
    movie: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [countdown, setCountdown] = useState(600); // 10 minutes in seconds
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const movies = [
    { id: "cinesphere-1", title: "CineSphere Experience 1" },
    { id: "cinesphere-2", title: "CineSphere Experience 2" },
    { id: "cinesphere-3", title: "CineSphere Experience 3" },
  ];

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearTimeout(countdownRef.current);
    };
  }, []);

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
    });
    setPaymentMethod("momo");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setCountdown(600);
    
    // Simulate payment processing with countdown
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setIsProcessing(false);
          alert("Hết thời gian thanh toán!");
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
      alert(`Thanh toán thành công qua ${paymentMethod === "momo" ? "MoMo" : "VNPay"}!`);
      handleCloseModal();
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-gradient-dark border-white/20 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-blue-400">
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
                onValueChange={(value) =>
                  setFormData({ ...formData, movie: value })
                }
              >
                <SelectTrigger className="bg-black/40 border-neon-cyan/30 text-white">
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
                className="bg-black/40 border-neon-cyan/30 text-white"
                placeholder="Nhập họ và tên"
              />
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
                className="bg-black/40 border-neon-cyan/30 text-white"
                placeholder="Nhập số điện thoại"
              />
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
                className="bg-black/40 border-neon-cyan/30 text-white"
                placeholder="Nhập email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity" className="text-white">
                Số Lượng Vé *
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                required
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    quantity: parseInt(e.target.value) || 1,
                  })
                }
                className="bg-black/40 border-neon-cyan/30 text-white"
              />
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
                    className="text-white [&>span]:text-white"
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-pink-400" />
                      <span>MoMo</span>
                    </div>
                  </Radio>
                  <Radio
                    value="vnpay"
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
                onClick={handleCloseModal}
                className="flex-1 border-white/20 text-gray-400 hover:bg-white/10"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={isProcessing || !formData.movie}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
              >
                {isProcessing ? "Đang xử lý..." : "Thanh Toán"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

