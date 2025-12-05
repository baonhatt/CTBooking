import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getBookingByCodeApi } from "@/lib/api";
import { AlertCircle, CheckCircle, Clock, MapPin, Users, DollarSign, Mail, Phone, User } from "lucide-react";

interface TicketInfo {
  id: number;
  booking_code: string;
  payment_status: string;
  user_id: number;
  name: string;
  phone: string;
  email: string;
  ticket_count: number;
  total_price: number;
  showtime_id: number;
  created_at: string;
  paid_at: string | null;
  payment_method: string | null;
  userName: string;
  showtime?: {
    id: number;
    start_time: string;
    end_time: string | null;
    movie?: {
      id: number;
      title: string;
      genres: any;
      duration_min: number | null;
      cover_image: string | null;
    };
  };
}

export default function TicketCheckContent() {
  const [code, setCode] = useState("");
  const [ticketInfo, setTicketInfo] = useState<TicketInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!code.trim()) {
      setError("Vui lòng nhập mã vé");
      return;
    }

    setIsLoading(true);
    setError(null);
    setTicketInfo(null);

    try {
      // Normalize code: uppercase and trim whitespace
      const normalizedCode = code.trim().toUpperCase();
      const data = await getBookingByCodeApi(normalizedCode);
      setTicketInfo(data);
    } catch (err: any) {
      setError(err.message || "Không tìm thấy vé");
      setTicketInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "paid":
      case "success":
        return (
          <Badge className="bg-green-600 hover:bg-green-700">
            <CheckCircle className="w-3 h-3 mr-1" />
            Đã thanh toán
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-600 hover:bg-yellow-700">
            <Clock className="w-3 h-3 mr-1" />
            Chờ thanh toán
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-600 hover:bg-red-700">Thất bại</Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const genres = Array.isArray(ticketInfo?.showtime?.movie?.genres)
    ? ticketInfo.showtime.movie.genres
    : typeof ticketInfo?.showtime?.movie?.genres === "string"
      ? ticketInfo.showtime.movie.genres.split(",")
      : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">Kiểm Tra Vé</h1>
        <p className="text-gray-600">Nhập mã vé từ email để xem thông tin chi tiết</p>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle>Tìm Kiếm Vé</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              placeholder="Nhập mã vé (vd: BOOKING-20251205-001)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button
              onClick={handleSearch}
              disabled={isLoading}
              className="px-6"
            >
              {isLoading ? "Đang tìm..." : "Tìm Kiếm"}
            </Button>
          </div>

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-600">
                {error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Ticket Details Section */}
      {ticketInfo && (
        <div className="space-y-4">
          {/* Booking Code & Status */}
          <Card className="border-l-4 border-l-blue-600">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Mã Vé</p>
                  <p className="text-xl font-bold text-blue-600">
                    {ticketInfo.booking_code}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Trạng Thái Thanh Toán</p>
                  <div>{getStatusBadge(ticketInfo.payment_status)}</div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Ngày Đặt Vé</p>
                  <p className="font-semibold text-gray-800">
                    {formatDate(ticketInfo.created_at)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Movie Information */}
          {ticketInfo.showtime?.movie && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">
                  {ticketInfo.showtime.movie.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-600">Thời Lượng</p>
                      <p className="font-semibold">
                        {ticketInfo.showtime.movie.duration_min || "N/A"} phút
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-600">Suất Chiếu</p>
                      <p className="font-semibold">
                        {formatTime(ticketInfo.showtime.start_time)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-600">Số Vé</p>
                      <p className="font-semibold">{ticketInfo.ticket_count}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-600">Tổng Tiền</p>
                      <p className="font-semibold text-green-600">
                        {Number(ticketInfo.total_price).toLocaleString("vi-VN")} ₫
                      </p>
                    </div>
                  </div>
                </div>

                {genres.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs text-gray-600 mb-2">Thể Loại</p>
                    <div className="flex flex-wrap gap-2">
                      {genres.map((genre: string, idx: number) => (
                        <Badge key={idx} variant="secondary">
                          {genre}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Thông Tin Khách Hàng</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-blue-600 mt-1" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-600">Tên Khách Hàng</p>
                      <p className="font-semibold text-lg">{ticketInfo.name}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-blue-600 mt-1" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-600">Số Điện Thoại</p>
                      <p className="font-semibold">{ticketInfo.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-blue-600 mt-1" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-semibold text-blue-600">
                        {ticketInfo.email}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Phương Thức Thanh Toán</p>
                    <Badge variant="outline" className="text-base py-2 px-3">
                      {ticketInfo.payment_method?.toUpperCase() || "N/A"}
                    </Badge>
                  </div>

                  {ticketInfo.paid_at && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Ngày Thanh Toán</p>
                      <p className="font-semibold">
                        {formatDate(ticketInfo.paid_at)}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-gray-600 mb-1">ID Khách Hàng</p>
                    <p className="font-mono text-sm bg-gray-100 p-2 rounded">
                      {ticketInfo.user_id}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Confirmation Section */}
          <Card className="border-l-4 border-l-green-600 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">
                    Thông tin vé đã được xác minh
                  </p>
                  <p className="text-sm text-green-700">
                    Nhân viên có thể xác nhận vé này
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!ticketInfo && !error && code && (
        <Card>
          <CardContent className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Nhập mã vé để bắt đầu tìm kiếm</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
