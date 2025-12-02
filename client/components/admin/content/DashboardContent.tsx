import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Film, CreditCard, ShieldCheck, UserCircle, Eye } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, BarChart, Bar, CartesianGrid, XAxis, YAxis } from "recharts";
import React from "react";

// ✅ Định nghĩa TransactionData để dùng trong props
interface TransactionData {
  id: string;
  user: string;
  amount: number;
  method: string;
  status: string;
  createdAt: Date;
}

// ✅ Định nghĩa UserData để dùng trong props
interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: "active" | "inactive";
  createdAt: Date;
}

// Định nghĩa props để nhận dữ liệu từ Admin.tsx
interface DashboardContentProps {
  metrics: {
    totalUsers: number;
    totalMovies: number;
    revenueTotal: number;
    revenueCount: number;
    avgRevenuePerUser: number;
    totalShowtimes: number;
    totalToys: number;
    totalTransactions: number;
  };
  userStats: { date: string, count: number }[];
  movieStats: { title: string, count: number }[];
  users: UserData[];
}

const DashboardContent: React.FC<DashboardContentProps> = ({ metrics, userStats, movieStats, users }) => {
  // Helper để format tiền tệ (Ví dụ: 100000 -> 100.000)
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount).replace('₫', ' VNĐ');
  };

  // Helper để format ngày tháng (ví dụ: dd/mm/yyyy)
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('vi-VN');
  };

  return (
    <div className="space-y-6">
      {/* 1. Thẻ Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">

        <Card className="rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng người dùng 🧑‍🤝‍🧑</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalUsers}</div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Doanh thu (Tổng) 💰</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.revenueTotal)}</div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Giao dịch thành công ✅</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.revenueCount}</div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng phim 🎬</CardTitle>
            <Film className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalMovies}</div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng suất chiếu 🎟️</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalShowtimes}</div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng đồ chơi 🧸</CardTitle>
            <Film className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalToys}</div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Hàng Biểu đồ và Bảng */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bảng Đăng ký gần đây */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-sm">Đăng ký gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users.slice(0, 4).map((user) => (
                <div key={user.id} className="flex items-center">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src="/avatars/01.png" alt="Avatar" />
                    <AvatarFallback><UserCircle /></AvatarFallback>
                  </Avatar>
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="ml-auto font-medium text-xs text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Biểu đồ Đường - LineChart (Thống kê người dùng) */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-sm">Thống kê người dùng</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="min-h-[200px] w-full">
              <LineChart data={userStats} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="count" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* 3. Hàng Biểu đồ phụ (Movie Stats) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-sm">Thống kê Doanh thu</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Đây là nơi đặt biểu đồ doanh thu thật (nếu có API data) */}
            <p className="text-4xl font-bold text-green-600">{formatCurrency(metrics.revenueTotal)}</p>
            <p className="text-sm text-muted-foreground">Từ {metrics.revenueCount} giao dịch</p>
          </CardContent>
        </Card>

        {/* ✅ Biểu đồ Cột - BarChart (Thống kê phim) */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-sm">5 Phim bán chạy nhất 🍿</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="min-h-[200px] w-full">
              <BarChart
                data={movieStats}
                margin={{ top: 20, right: 0, left: -20, bottom: 5 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="title"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                <YAxis
                  dataKey="count"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardContent;