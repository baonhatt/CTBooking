import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getUserById } from "@/lib/api";

interface Props {
  data: any[];
  totalPages: number;
  currentPage: number;
  setPage: (p: number) => void;
  userQuery: string;
  setUserQuery: (q: string) => void;
  onEdit: (type: "user", data: any) => void;
  usersLength: number;
  onRefresh: () => void;
}

export default function UsersContent({
  data,
  totalPages,
  currentPage,
  setPage,
  userQuery,
  setUserQuery,
  onEdit,
  usersLength,
  onRefresh,
}: Props) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  useEffect(() => {
    if (isDetailsOpen && selectedUserId) {
      (async () => {
        try {
          setIsLoadingDetails(true);
          setDetailsError(null);
          const details = await getUserById(selectedUserId);
          setUserDetails(details);
        } catch (err) {
          setDetailsError("Không thể tải thông tin người dùng");
          console.error("Lỗi load user details:", err);
        } finally {
          setIsLoadingDetails(false);
        }
      })();
    }
  }, [isDetailsOpen, selectedUserId]);

  const handleViewDetails = (userId: number) => {
    setSelectedUserId(userId);
    setIsDetailsOpen(true);
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          Tổng cộng: {usersLength} người dùng
        </h3>
        <div className="flex gap-2">
          <input
            className="border rounded px-2 py-1"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Tìm người dùng"
          />
          <Button onClick={onRefresh} variant="outline">
            ↻ Refresh
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>SĐT</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.id}</TableCell>
                  <TableCell>{u.fullname}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.phone}</TableCell>
                  <TableCell>{u.is_active ? "Hoạt động" : "Tạm khóa"}</TableCell>
                  <TableCell>{u.created_at.toLocaleDateString("vi-VN")}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(Number(u.id))}
                    >
                      Xem
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Pagination className="mt-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setPage(Math.max(1, currentPage - 1));
              }}
              aria-disabled={currentPage === 1}
              className={
                currentPage === 1 ? "pointer-events-none opacity-50" : ""
              }
            />
          </PaginationItem>
          {Array.from({ length: totalPages }).map((_, i) => (
            <PaginationItem key={i}>
              <PaginationLink
                href="#"
                isActive={currentPage === i + 1}
                onClick={(e) => {
                  e.preventDefault();
                  setPage(i + 1);
                }}
              >
                {i + 1}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setPage(Math.min(totalPages, currentPage + 1));
              }}
              aria-disabled={currentPage === totalPages}
              className={
                currentPage === totalPages
                  ? "pointer-events-none opacity-50"
                  : ""
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      {/* User Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết người dùng</DialogTitle>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <span>Đang tải...</span>
            </div>
          ) : detailsError ? (
            <div className="text-center py-8 text-red-600">{detailsError}</div>
          ) : userDetails ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="font-semibold mb-3">Thông tin cơ bản</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">ID</p>
                    <p className="font-medium">{userDetails.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Trạng thái</p>
                    <Badge
                      variant={
                        userDetails.is_active ? "default" : "secondary"
                      }
                    >
                      {userDetails.is_active ? "Hoạt động" : "Tạm khóa"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Họ tên</p>
                    <p className="font-medium">{userDetails.fullname}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Số điện thoại</p>
                    <p className="font-medium">{userDetails.phone}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{userDetails.email}</p>
                  </div>
                </div>
              </div>

              {/* Account Info */}
              <div>
                <h3 className="font-semibold mb-3">Thông tin tài khoản</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Loại đăng nhập</p>
                    <p className="font-medium">{userDetails.login_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Ngày tạo tài khoản</p>
                    <p className="font-medium">
                      {userDetails.account_created_at
                        ? new Date(
                          userDetails.account_created_at,
                        ).toLocaleDateString("vi-VN")
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Ngày tạo hồ sơ</p>
                    <p className="font-medium">
                      {new Date(userDetails.user_created_at).toLocaleDateString(
                        "vi-VN",
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Cập nhật lần cuối</p>
                    <p className="font-medium">
                      {new Date(userDetails.user_updated_at).toLocaleDateString(
                        "vi-VN",
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Booking Stats */}
              <div>
                <h3 className="font-semibold mb-3">Thống kê đặt vé</h3>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-600">Tổng số đơn đặt vé</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {userDetails.total_bookings}
                  </p>
                </div>
              </div>

              {/* Recent Bookings */}
              {userDetails.recent_bookings &&
                userDetails.recent_bookings.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">
                      Đơn đặt vé gần đây (10 mới nhất)
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {userDetails.recent_bookings.map(
                        (booking: any, idx: number) => (
                          <div
                            key={idx}
                            className="border rounded p-3 hover:bg-gray-50"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-medium">
                                  {booking.showtime?.movie?.title ||
                                    "Phim không xác định"}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Số vé: {booking.ticket_count}
                                </p>
                              </div>
                              <Badge
                                variant={
                                  ["paid"].includes(
                                    booking.payment_status
                                  )
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {["paid"].includes(
                                  booking.payment_status
                                )
                                  ? "Đã thanh toán"
                                  : "Chưa thanh toán"}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <p className="text-gray-600">
                                Phương thức:{" "}
                                <span className="font-medium">
                                  {booking.payment_method || "N/A"}
                                </span>
                              </p>
                              <p className="text-gray-600">
                                Số tiền:{" "}
                                <span className="font-medium">
                                  {booking.total_price?.toLocaleString(
                                    "vi-VN",
                                  ) || "0"}{" "}
                                  đ
                                </span>
                              </p>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              {new Date(booking.created_at).toLocaleDateString(
                                "vi-VN",
                              )}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
