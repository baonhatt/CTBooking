import { useMemo, useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMovies2025 } from "@/hooks/useMovies";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarRail,
} from "@/components/ui/sidebar";
import { LayoutDashboard, UserCircle, Film, Gamepad2, CreditCard, Ticket, Users, ShieldCheck, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, BarChart, Bar, CartesianGrid, XAxis, YAxis } from "recharts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { getToys, createToyApi, updateToyApi, deleteToyApi, createMovieApi, getMoviesAdmin, updateMovieApi, deleteMovieApi, getAdminRevenue, getShowtimes, createShowtimeApi, updateShowtimeApi, deleteShowtimeApi } from "@/lib/api";

export default function Admin() {
  const { data: movies = [] } = useMovies2025();
  const navigate = useNavigate();
  const [active, setActive] = useState<"dashboard" | "users" | "movies" | "toys" | "showtimes" | "transactions">("dashboard");
  const [moviesLoaded, setMoviesLoaded] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [txQuery, setTxQuery] = useState("");
  const [users, setUsers] = useState(() => [
    { id: "u1", name: "a", email: "admin@email.com", phone: "0900000000", status: "active", createdAt: new Date() },
  ]);
  const [transactions] = useState(() => [] as Array<{ id: string; user: string; amount: number; method: string; status: string; createdAt: Date }>);
  const [moviesLocal, setMoviesLocal] = useState(movies);
  const [movieStatus, setMovieStatus] = useState<Record<string, "active" | "inactive">>({});
  const [toys, setToys] = useState([] as Array<{ id: number; name: string; category?: string; price: number; stock: number; status: string; image_url?: string }>)
  const [toysLoaded, setToysLoaded] = useState(false)
  const [showtimes, setShowtimes] = useState([] as Array<{ id: number; movie_id: number; movie_title: string; start_time: string; price: number; total_sold: number }>)
  const [showtimesLoaded, setShowtimesLoaded] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editType, setEditType] = useState<"user" | "movie" | "toy" | "showtime" | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [adminToken, setAdminToken] = useState<string>(() => localStorage.getItem("adminToken") || "");
  const [adminEmailState, setAdminEmailState] = useState<string>(() => localStorage.getItem("adminEmail") || "admin@email.com");
  const [usersPage, setUsersPage] = useState(1);
  const [moviesPage, setMoviesPage] = useState(1);
  const [toysPage, setToysPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const pageSize = 5;
  const [revenueTotal, setRevenueTotal] = useState(0);
  const [revenueCount, setRevenueCount] = useState(0);

  if (!moviesLoaded && active !== "movies" && moviesLocal.length !== movies.length) {
    setMoviesLocal(movies);
  }

  const filteredUsers = useMemo(() => {
    const q = userQuery.toLowerCase();
    return users.filter((u) => [u.name, u.email, u.phone].some((x) => x.toLowerCase().includes(q)));
  }, [userQuery, users]);
  const usersTotalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const usersPageData = useMemo(() => filteredUsers.slice((usersPage - 1) * pageSize, usersPage * pageSize), [filteredUsers, usersPage]);

  const filteredTransactions = useMemo(() => {
    const q = txQuery.toLowerCase();
    return transactions.filter((t) => [t.user, t.method, t.status, t.id].some((x) => String(x).toLowerCase().includes(q)));
  }, [txQuery, transactions]);
  const txTotalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const txPageData = useMemo(() => filteredTransactions.slice((txPage - 1) * pageSize, txPage * pageSize), [filteredTransactions, txPage]);

  const metrics = useMemo(() => {
    const activeUsers = users.filter((u) => u.status === "active").length;
    const totalRevenue = revenueTotal;
    const tx = revenueCount;
    return { movies: movies.length, activeUsers, totalRevenue, toys: 0, tx };
  }, [movies, users, revenueTotal, revenueCount]);

  const userStats = useMemo(() => (
    [
      { day: "Sat", value: 1.4 },
      { day: "Sun", value: 1.5 },
      { day: "Mon", value: 2.6 },
      { day: "Tue", value: 2.1 },
      { day: "Wed", value: 3.5 },
      { day: "Thu", value: 2.6 },
      { day: "Fri", value: 4.99 },
    ]
  ), []);

  const movieStats = useMemo(() => (
    [
      { month: "Jan", value: 12 },
      { month: "Feb", value: 18 },
      { month: "Mar", value: 15 },
      { month: "Apr", value: 22 },
      { month: "May", value: 17 },
      { month: "Jun", value: 26 },
      { month: "Jul", value: 21 },
      { month: "Aug", value: 23 },
      { month: "Sep", value: 19 },
      { month: "Oct", value: 20 },
      { month: "Nov", value: 24 },
      { month: "Dec", value: 28 },
    ]
  ), []);
  const moviesTotalPages = Math.max(1, Math.ceil(moviesLocal.length / pageSize));
  const moviesPageData = useMemo(() => moviesLocal.slice((moviesPage - 1) * pageSize, moviesPage * pageSize), [moviesLocal, moviesPage]);
  const toysTotalPages = Math.max(1, Math.ceil(toys.length / pageSize));
  const toysPageData = useMemo(() => toys.slice((toysPage - 1) * pageSize, toysPage * pageSize), [toys, toysPage]);

  useEffect(() => {
    if (active === "toys" && !toysLoaded) {
      (async () => {
        try {
          const { items } = await getToys({ page: 1, pageSize: 100 });
          setToys(items.map((t: any) => ({ id: t.id, name: t.name, category: t.category, price: Number(t.price), stock: t.stock, status: t.status, image_url: t.image_url })));
          setToysLoaded(true)
        } catch {}
      })();
    }
  }, [active, toysLoaded]);

  useEffect(() => {
    if (active === "movies" && !moviesLoaded) {
      (async () => {
        try {
          const { items } = await getMoviesAdmin({ page: 1, pageSize: 50 });
          const mapped = items.map((m: any) => ({
            id: String(m.id),
            title: m.title,
            year: new Date(m.release_date || Date.now()).getFullYear(),
            duration: m?.duration_min ? `${Number(m.duration_min)} phút` : "",
            genres: Array.isArray(m.genres) ? m.genres : [],
            posterUrl: m.cover_image || "",
            release_date: m.release_date || null,
            rating: m.rating ?? null,
            price: Number(m.price || 0),
          }))
          setMoviesLocal(mapped)
          setMoviesLoaded(true)
        } catch {}
      })()
    }
  }, [active, moviesLoaded])

  useEffect(() => {
    if (active === "showtimes" && !showtimesLoaded) {
      (async () => {
        try {
          const { items } = await getShowtimes({ page: 1, pageSize: 100 });
          setShowtimes(items.map((s: any) => ({ id: s.id, movie_id: s.movie_id, movie_title: s.movie?.title || "", start_time: new Date(s.start_time).toISOString(), price: Number(s.price), total_sold: Number(s.total_sold || 0) })))
          setShowtimesLoaded(true)
        } catch {}
      })()
    }
  }, [active, showtimesLoaded])

  useEffect(() => {
    if (active === "showtimes") {
      (async () => {
        try {
          if (!moviesLoaded || (Array.isArray(moviesLocal) && moviesLocal.every((m: any) => m.id === undefined))) {
            const { items } = await getMoviesAdmin({ page: 1, pageSize: 100 });
            const mapped = items.map((m: any) => ({
              id: String(m.id),
              title: m.title,
              year: new Date(m.release_date || Date.now()).getFullYear(),
              duration: m?.duration_min ? `${Number(m.duration_min)} phút` : "",
              genres: Array.isArray(m.genres) ? m.genres : [],
              posterUrl: m.cover_image || "",
              release_date: m.release_date || null,
              rating: m.rating ?? null,
              price: Number(m.price || 0),
            }))
            setMoviesLocal(mapped)
            setMoviesLoaded(true)
          }
        } catch {}
      })()
    }
  }, [active, moviesLoaded, moviesLocal])

  useEffect(() => {
    if (active === "dashboard") {
      (async () => {
        try {
          const now = new Date();
          const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const res = await getAdminRevenue({ from: from.toISOString(), to: now.toISOString() });
          setRevenueTotal(res.total || 0);
          setRevenueCount(res.count || 0);
        } catch {}
      })();
    }
  }, [active])

  return (
    <SidebarProvider
      style={{
        // Dark sidebar background, light active tab, dark text for active
        "--sidebar-background": "220 60% 6%",
        "--sidebar-foreground": "0 0% 98%",
        "--sidebar-border": "220 20% 20%",
        "--sidebar-accent": "0 0% 98%",
        "--sidebar-accent-foreground": "240 5.9% 10%",
        "--sidebar-ring": "217.2 91.2% 59.8%",
      } as React.CSSProperties}
    >
      <Sidebar collapsible="icon" className="bg-[#0a1220] text-white">
        <SidebarHeader>
          <div className="px-2 text-sm">Quản lý</div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Bảng điều khiển" isActive={active === "dashboard"} onClick={() => setActive("dashboard")}>
                <LayoutDashboard className="mr-2" /> Bảng điều khiển
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Người dùng" isActive={active === "users"} onClick={() => setActive("users")}>
                <UserCircle className="mr-2" /> Người dùng
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Phim" isActive={active === "movies"} onClick={() => setActive("movies")}>
                <Film className="mr-2" /> Phim
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Lịch chiếu" isActive={active === "showtimes"} onClick={() => setActive("showtimes")}>
                <Ticket className="mr-2" /> Lịch chiếu
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Đồ chơi" isActive={active === "toys"} onClick={() => setActive("toys")}>
                <Gamepad2 className="mr-2" /> Đồ chơi
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Giao dịch" isActive={active === "transactions"} onClick={() => setActive("transactions")}>
                <CreditCard className="mr-2" /> Giao dịch
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <Button
            variant="ghost"
            className="justify-start"
            onClick={() => {
              localStorage.removeItem("adminToken");
              localStorage.removeItem("adminEmail");
              setAdminToken("");
              setAdminEmailState("admin@email.com");
              window.dispatchEvent(new Event("admin-auth-changed"));
              navigate("/admin", { replace: true });
            }}
          >
            Đăng xuất
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarRail />
      <SidebarInset>
        <div className="border-b px-6 py-3 flex items-center justify-between bg-white/80">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <div className="font-semibold">Bảng điều khiển</div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-black/5">
                  <div className="text-sm text-gray-700">{adminEmailState}</div>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" />
                    <AvatarFallback>{(adminEmailState?.split("@")[0] || "AD").slice(0,2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-white">
                <DropdownMenuItem disabled>Quản trị viên</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  localStorage.removeItem("adminToken");
                  localStorage.removeItem("adminEmail");
                  setAdminToken("");
                  setAdminEmailState("admin@email.com");
                  window.dispatchEvent(new Event("admin-auth-changed"));
                  navigate("/admin", { replace: true });
                }}>Đăng xuất</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="p-6">
          {active === "dashboard" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="rounded-xl">
                  <CardContent className="pt-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-purple-600 text-white flex items-center justify-center"><Film className="h-5 w-5" /></div>
                    <div>
                      <div className="text-xs text-gray-500">Tổng phim</div>
                      <div className="text-xl font-bold">{metrics.movies}</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-xl">
                  <CardContent className="pt-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-600 text-white flex items-center justify-center"><ShieldCheck className="h-5 w-5" /></div>
                    <div>
                      <div className="text-xs text-gray-500">Vé đang mở</div>
                      <div className="text-xl font-bold">260</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-xl">
                  <CardContent className="pt-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-red-600 text-white flex items-center justify-center"><ShieldCheck className="h-5 w-5" /></div>
                    <div>
                      <div className="text-xs text-gray-500">Vé đã đóng</div>
                      <div className="text-xl font-bold">1</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-xl">
                  <CardContent className="pt-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-600 text-white flex items-center justify-center"><Users className="h-5 w-5" /></div>
                    <div>
                      <div className="text-xs text-gray-500">Tổng người dùng</div>
                      <div className="text-xl font-bold">{metrics.activeUsers}</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-xl">
                  <CardContent className="pt-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center"><UserCircle className="h-5 w-5" /></div>
                    <div>
                      <div className="text-xs text-gray-500">Tổng quản trị</div>
                      <div className="text-xl font-bold">3</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-xl">
                  <CardContent className="pt-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-teal-600 text-white flex items-center justify-center"><CreditCard className="h-5 w-5" /></div>
                    <div>
                      <div className="text-xs text-gray-500">Tổng giao dịch</div>
                      <div className="text-xl font-bold">{metrics.tx}</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-sm">Đăng ký gần đây</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {users.slice(0, 4).map((u) => (
                        <div className="flex items-center justify-between" key={u.id}>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8"><AvatarImage src="" /><AvatarFallback>{(u.name || "U").slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
                            <div>
                              <div className="text-sm font-medium">{u.name}</div>
                              <div className="text-xs text-gray-500">{u.email}</div>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
             
                <Card className="rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-sm">Thống kê người dùng</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={{ users: { label: "Người dùng", color: "#6366f1" } }}>
                      <LineChart data={userStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis tickFormatter={(v) => `${v}M`} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="value" stroke="var(--color-users)" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </div>
   <Card className="rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-sm">Doanh thu</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">{metrics.totalRevenue.toLocaleString("vi-VN")} đ</div>
                    <div className="text-xs text-gray-500 mt-1">Trong 7 ngày gần đây</div>
                  </CardContent>
                </Card>
                <Card className="rounded-xl">
                  <CardHeader>
                  <CardTitle className="text-sm">Thống kê phim</CardTitle>
                  </CardHeader>
                  <CardContent>
                  <ChartContainer config={{ movies: { label: "Phim", color: "#8b5cf6" } }}>
                    <BarChart data={movieStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(v)=>`${v}`} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" fill="var(--color-movies)" radius={[8,8,0,0]} />
                    </BarChart>
                  </ChartContainer>
                  </CardContent>
                </Card>


            </div>
          )}

          {active === "users" && (
            <div className="space-y-4">
              <div>
                <h1 className="text-3xl font-bold">Quản lý người dùng</h1>
                <p className="text-gray-500">Danh sách tất cả người dùng trong hệ thống</p>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Danh sách người dùng ({users.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3 mb-4">
                    <Input placeholder="Tìm kiếm" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Họ tên</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Ngày tạo</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersPageData.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>{u.name}</TableCell>
                          <TableCell>{u.id.slice(0, 7)}...</TableCell>
                          <TableCell>{u.createdAt.toLocaleDateString("vi-VN")}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">Hoạt động</Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => { setEditType("user"); setEditData(u); setIsEditOpen(true); }}>Sửa</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <Pagination className="mt-4">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setUsersPage(Math.max(1, usersPage - 1)); }} />
                        </PaginationItem>
                        {Array.from({ length: usersTotalPages }).map((_, i) => (
                          <PaginationItem key={i}>
                            <PaginationLink href="#" isActive={usersPage === i + 1} onClick={(e) => { e.preventDefault(); setUsersPage(i + 1); }}>
                              {i + 1}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setUsersPage(Math.min(usersTotalPages, usersPage + 1)); }} />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {active === "movies" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold">Quản lý phim</h1>
                  <p className="text-gray-500">Danh sách tất cả phim trong hệ thống</p>
                </div>
                <Button onClick={() => { setEditType("movie"); setEditData({ id: "", title: "", genres: [], duration: "", posterUrl: "", status: "active" }); setIsEditOpen(true); }}>Thêm phim</Button>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Danh sách phim ({moviesLocal.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tên phim</TableHead>
                        <TableHead>Thể loại</TableHead>
                        <TableHead>Thời lượng</TableHead>
                        <TableHead>Giá</TableHead>
                        <TableHead>Đánh giá</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {moviesPageData.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="flex items-center gap-2"><img src={m.posterUrl} className="w-8 h-8 rounded" />{m.title}</TableCell>
                          <TableCell>{m.genres.join(", ")}</TableCell>
                          <TableCell>{m.duration}</TableCell>
                          <TableCell>—</TableCell>
                          <TableCell>—</TableCell>
                          <TableCell>
                            <Badge variant={(movieStatus[m.id] ?? "active") === "active" ? "secondary" : "outline"}>
                              {(movieStatus[m.id] ?? "active") === "active" ? "Hoạt động" : "Đã ẩn"}
                            </Badge>
                          </TableCell>
                          <TableCell><Button variant="outline" size="sm" onClick={() => { setEditType("movie"); setEditData(m); setIsEditOpen(true); }}>Sửa</Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <Pagination className="mt-4">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setMoviesPage(Math.max(1, moviesPage - 1)); }} />
                        </PaginationItem>
                        {Array.from({ length: moviesTotalPages }).map((_, i) => (
                          <PaginationItem key={i}>
                            <PaginationLink href="#" isActive={moviesPage === i + 1} onClick={(e) => { e.preventDefault(); setMoviesPage(i + 1); }}>
                              {i + 1}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setMoviesPage(Math.min(moviesTotalPages, moviesPage + 1)); }} />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {active === "showtimes" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold">Quản lý lịch chiếu</h1>
                  <p className="text-gray-500">Tạo lịch chiếu thủ công, tránh trùng giờ</p>
                </div>
                <Button onClick={() => { setEditType("showtime"); setEditData({ id: 0, movie_id: 0, start_time: "", price: 0 }); setIsEditOpen(true); }}>Thêm lịch</Button>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Danh sách lịch ({showtimes.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Phim</TableHead>
                        <TableHead>Thời gian</TableHead>
                        <TableHead>Giá vé</TableHead>
                        <TableHead>Đã bán</TableHead>
                        <TableHead>Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {showtimes.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.movie_title}</TableCell>
                          <TableCell>{new Date(s.start_time).toLocaleString("vi-VN")}</TableCell>
                          <TableCell>{s.price.toLocaleString("vi-VN")} đ</TableCell>
                          <TableCell>{s.total_sold}</TableCell>
                          <TableCell className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => { setEditType("showtime"); setEditData(s); setIsEditOpen(true); }}>Sửa</Button>
                            <Button size="sm" variant="destructive" onClick={async () => { try { await deleteShowtimeApi(s.id); const { items } = await getShowtimes({ page: 1, pageSize: 100 }); setShowtimes(items.map((x: any) => ({ id: x.id, movie_id: x.movie_id, movie_title: x.movie?.title || "", start_time: new Date(x.start_time).toISOString(), price: Number(x.price), total_sold: Number(x.total_sold || 0) }))); } catch (e: any) {} }}>Xóa</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {active === "toys" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold">Quản lý đồ chơi</h1>
                  <p className="text-gray-500">Danh sách tất cả đồ chơi trong kho</p>
                </div>
                <Button onClick={() => { setEditType("toy"); setEditData({ id: 0, name: "", category: "", price: 0, stock: 0, status: "active", image_url: "" }); setIsEditOpen(true); }}>Thêm đồ chơi</Button>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Danh sách đồ chơi (0)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tên đồ chơi</TableHead>
                        <TableHead>Danh mục</TableHead>
                        <TableHead>Giá</TableHead>
                        <TableHead>Tồn kho</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {toysPageData.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="flex items-center gap-2">{t.image_url && <img src={t.image_url} className="w-8 h-8 rounded object-cover" />}<span>{t.name}</span></TableCell>
                          <TableCell>{t.category}</TableCell>
                          <TableCell>{t.price.toLocaleString("vi-VN")} đ</TableCell>
                          <TableCell>{t.stock}</TableCell>
                          <TableCell><Badge variant="secondary">{t.status}</Badge></TableCell>
                          <TableCell className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => { setEditType("toy"); setEditData(t); setIsEditOpen(true); }}>Sửa</Button>
                            <Button size="sm" variant="destructive" onClick={async () => { try { await deleteToyApi(t.id as any); const { items } = await getToys({ page: 1, pageSize: 100 }); setToys(items.map((x: any) => ({ id: x.id, name: x.name, category: x.category, price: Number(x.price), stock: x.stock, status: x.status, image_url: x.image_url }))); } catch {} }}>Xóa</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <Pagination className="mt-4">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setToysPage(Math.max(1, toysPage - 1)); }} />
                        </PaginationItem>
                        {Array.from({ length: toysTotalPages }).map((_, i) => (
                          <PaginationItem key={i}>
                            <PaginationLink href="#" isActive={toysPage === i + 1} onClick={(e) => { e.preventDefault(); setToysPage(i + 1); }}>
                              {i + 1}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setToysPage(Math.min(toysTotalPages, toysPage + 1)); }} />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {active === "transactions" && (
            <div className="space-y-4">
              <div>
                <h1 className="text-3xl font-bold">Quản lý giao dịch</h1>
                <p className="text-gray-500">Danh sách tất cả giao dịch trong hệ thống</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card><CardHeader><CardTitle>Tổng giao dịch</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.tx}</CardContent></Card>
                <Card><CardHeader><CardTitle>Doanh thu</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-blue-600">{metrics.totalRevenue.toLocaleString("vi-VN")} đ</CardContent></Card>
                <Card><CardHeader><CardTitle>Hoàn thành</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-emerald-600">{transactions.filter(t => t.status === 'success').length}</CardContent></Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Lịch sử giao dịch</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3 mb-4">
                    <Input placeholder="Lọc giao dịch" value={txQuery} onChange={(e) => setTxQuery(e.target.value)} />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loại</TableHead>
                        <TableHead>Sản phẩm</TableHead>
                        <TableHead>Số lượng</TableHead>
                        <TableHead>Số tiền</TableHead>
                        <TableHead>Phương thức</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Ngày giao dịch</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {txPageData.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>Vé</TableCell>
                          <TableCell>{t.user}</TableCell>
                          <TableCell>1</TableCell>
                          <TableCell>{t.amount.toLocaleString("vi-VN")} đ</TableCell>
                          <TableCell>{t.method}</TableCell>
                          <TableCell><Badge variant={t.status === 'success' ? 'secondary' : 'outline'}>{t.status}</Badge></TableCell>
                          <TableCell>{t.createdAt.toLocaleString("vi-VN")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <Pagination className="mt-4">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setTxPage(Math.max(1, txPage - 1)); }} />
                        </PaginationItem>
                        {Array.from({ length: txTotalPages }).map((_, i) => (
                          <PaginationItem key={i}>
                            <PaginationLink href="#" isActive={txPage === i + 1} onClick={(e) => { e.preventDefault(); setTxPage(i + 1); }}>
                              {i + 1}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setTxPage(Math.min(txTotalPages, txPage + 1)); }} />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        {null}
      </SidebarInset>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editType === "user" ? "Chỉnh sửa người dùng" : editType === "movie" ? "Chỉnh sửa phim" : editType === "toy" ? "Chỉnh sửa đồ chơi" : editType === "showtime" ? "Chỉnh sửa lịch chiếu" : ""}</DialogTitle>
          </DialogHeader>
          {editType === "user" && (
            <div className="space-y-3">
              <div>
                <Label>Họ tên</Label>
                <Input value={editData?.name || ""} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={editData?.email || ""} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
              </div>
              <div>
                <Label>SĐT</Label>
                <Input value={editData?.phone || ""} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>Hủy</Button>
                <Button onClick={() => {
                  setUsers((prev) => prev.map((u) => (u.id === editData.id ? { ...u, ...editData } : u)));
                  setIsEditOpen(false);
                }}>Lưu</Button>
              </div>
            </div>
          )}
          {editType === "movie" && (
            <div className="space-y-3">
              <div>
                <Label>Poster</Label>
                <Input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = URL.createObjectURL(file);
                    setEditData({ ...editData, posterUrl: url, posterFile: file });
                  }
                }} />
                {editData?.posterUrl && (<div className="mt-2"><img src={editData?.posterUrl} className="w-full max-h-40 object-cover rounded" /></div>)}
              </div>
              <div>
                <Label>Tên phim</Label>
                <Input value={editData?.title || ""} onChange={(e) => setEditData({ ...editData, title: e.target.value })} />
              </div>
              <div>
                <Label>Mô tả</Label>
                <textarea value={editData?.description || ""} onChange={(e) => setEditData({ ...editData, description: e.target.value })} className="w-full h-24 border rounded-md px-3 py-2" />
              </div>
              <div>
                <Label>Giá</Label>
                <Input type="number" value={editData?.price ?? 0} onChange={(e) => setEditData({ ...editData, price: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Thể loại</Label>
                <Input value={(editData?.genres || []).join(", ")} onChange={(e) => setEditData({ ...editData, genres: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
              </div>
              <div>
                <Label>Thời lượng</Label>
                <Input value={editData?.duration || ""} onChange={(e) => setEditData({ ...editData, duration: e.target.value })} />
              </div>
              <div>
                <Label>Đánh giá (0–10)</Label>
                <Input type="number" min={0} max={10} step={0.1} value={editData?.rating ?? ""} onChange={(e) => setEditData({ ...editData, rating: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div>
                <Label>Ngày phát hành</Label>
                <Input type="datetime-local" value={editData?.release_date ? new Date(editData.release_date).toISOString().slice(0,16) : ""} onChange={(e) => setEditData({ ...editData, release_date: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
              </div>
              <div>
                <Label>Trạng thái</Label>
                <select
                  value={editData?.status || "active"}
                  onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                  className="w-full h-10 border rounded-md px-3"
                >
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Đã ẩn</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>Hủy</Button>
                <Button onClick={async () => {
                  try {
                    if (!editData.id) {
                      let coverBase64: string | undefined = undefined
                      if (editData.posterFile) {
                        const file = editData.posterFile as File
                        coverBase64 = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsDataURL(file) })
                      }
                      const payload = {
                        title: editData.title,
                        description: editData.description,
                        cover_image: editData.posterUrl,
                        cover_image_base64: coverBase64,
                        detail_images: editData.detail_images,
                        genres: editData.genres,
                        rating: editData.rating ? Number(editData.rating) : undefined,
                        duration_min: editData.duration ? Number(editData.duration) : undefined,
                        price: Number(editData.price || 0),
                        is_active: (editData?.status || "active") === "active",
                        release_date: editData?.release_date,
                      };
                      const res = await createMovieApi(payload as any);
                      const m = res.movie;
                      setMoviesLocal((prev) => [
                        ...prev,
                        {
                          id: String(m.id),
                          title: m.title,
                          posterUrl: m.cover_image || "",
                          duration: m?.duration_min ? `${Number(m.duration_min)} phút` : "",
                          year: m?.release_date ? new Date(m.release_date).getFullYear() : new Date().getFullYear(),
                          genres: Array.isArray(m.genres) ? m.genres : [],
                          release_date: m.release_date || null,
                          rating: m.rating ?? null,
                          price: Number(m.price || 0),
                        },
                      ]);
                      setMovieStatus((prev) => ({ ...prev, [m.id]: m.is_active ? "active" : "inactive" }));
                    } else {
                      let coverBase64: string | undefined = undefined
                      if (editData.posterFile) {
                        const file = editData.posterFile as File
                        coverBase64 = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsDataURL(file) })
                      }
                      await updateMovieApi(Number(editData.id), {
                        title: editData.title,
                        description: editData.description,
                        cover_image: editData.posterUrl,
                        cover_image_base64: coverBase64,
                        genres: editData.genres,
                        rating: editData.rating ? Number(editData.rating) : undefined,
                        duration_min: editData.duration ? Number(editData.duration) : undefined,
                        price: Number(editData.price || 0),
                        is_active: (editData?.status || "active") === "active",
                        release_date: editData?.release_date,
                      })
                      const { items } = await getMoviesAdmin({ page: 1, pageSize: 50 })
                      const mapped = items.map((m: any) => ({
                        id: String(m.id),
                        title: m.title,
                        year: new Date(m.release_date || Date.now()).getFullYear(),
                        duration: m?.duration_min ? `${Number(m.duration_min)} phút` : "",
                        genres: Array.isArray(m.genres) ? m.genres : [],
                        posterUrl: m.cover_image || "",
                        release_date: m.release_date || null,
                        rating: m.rating ?? null,
                        price: Number(m.price || 0),
                      }))
                      setMoviesLocal(mapped)
                      setMovieStatus((prev) => ({ ...prev, ...Object.fromEntries(mapped.map((x:any) => [x.id, "active"])) }))
                    }
                  } finally {
                    setIsEditOpen(false);
                  }
                }}>Lưu</Button>
              </div>
            </div>
          )}
          {editType === "toy" && (
            <div className="space-y-3">
              <div>
                <Label>Ảnh</Label>
                <Input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = URL.createObjectURL(file);
                    setEditData({ ...editData, image_url: url, imageFile: file });
                  }
                }} />
                {editData?.image_url && (<div className="mt-2"><img src={editData?.image_url} className="w-full max-h-40 object-cover rounded" /></div>)}
              </div>
              <div>
                <Label>Tên đồ chơi</Label>
                <Input value={editData?.name || ""} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
              </div>
              <div>
                <Label>Danh mục</Label>
                <Input value={editData?.category || ""} onChange={(e) => setEditData({ ...editData, category: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Giá</Label>
                  <Input type="number" value={editData?.price ?? 0} onChange={(e) => setEditData({ ...editData, price: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Tồn kho</Label>
                  <Input type="number" value={editData?.stock ?? 0} onChange={(e) => setEditData({ ...editData, stock: Number(e.target.value) || 0 })} />
                </div>
              </div>
              <div>
                <Label>Trạng thái</Label>
                <select
                  value={editData?.status || "active"}
                  onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                  className="w-full h-10 border rounded-md px-3"
                >
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Đã ẩn</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>Hủy</Button>
                <Button onClick={async () => {
                  try {
                    if (!editData.id || editData.id === 0) {
                      let imageBase64: string | undefined = undefined
                      if (editData.imageFile) {
                        const file = editData.imageFile as File
                        imageBase64 = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsDataURL(file) })
                      }
                      await createToyApi({ name: editData.name, category: editData.category, price: Number(editData.price || 0), stock: Number(editData.stock || 0), status: editData.status, image_url: editData.image_url, image_base64: imageBase64 });
                    } else {
                      let imageBase64: string | undefined = undefined
                      if (editData.imageFile) {
                        const file = editData.imageFile as File
                        imageBase64 = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsDataURL(file) })
                      }
                      await updateToyApi(Number(editData.id), { name: editData.name, category: editData.category, price: Number(editData.price || 0), stock: Number(editData.stock || 0), status: editData.status, image_url: editData.image_url, image_base64: imageBase64 });
                    }
                    const { items } = await getToys({ page: 1, pageSize: 100 });
                    setToys(items.map((t: any) => ({ id: t.id, name: t.name, category: t.category, price: Number(t.price), stock: t.stock, status: t.status, image_url: t.image_url })));
                  } finally {
                    setIsEditOpen(false);
                  }
                }}>Lưu</Button>
              </div>
            </div>
          )}
          {editType === "showtime" && (
            <div className="space-y-3">
              <div>
                <Label>Phim</Label>
                <select
                  value={String(editData?.movie_id ?? 0)}
                  onChange={(e) => setEditData({ ...editData, movie_id: Number(e.target.value) })}
                  className="w-full h-10 border rounded-md px-3"
                >
                  <option value="0">Chọn phim</option>
                  {moviesLocal.map((m) => (
                    <option key={String((m as any).id ?? m.title)} value={String((m as any).id ?? 0)}>{(m as any).title}</option>
                  ))}
              </select>
              </div>
              <div>
                <Label>Chọn ngày</Label>
                <Input type="date" value={String(editData?.start_time || "").split("T")[0] || ""} onChange={(e) => { const d = e.target.value; const t = String(editData?.start_time || "").split("T")[1]?.slice(0,5) || "00:00"; setEditData({ ...editData, start_time: d ? `${d}T${t}` : "" }); }} />
              </div>
              <div>
                <Label>Giờ bắt đầu</Label>
                <Input type="time" step={60} value={String(editData?.start_time || "").split("T")[1]?.slice(0,5) || ""} onChange={(e) => { const t = e.target.value; const d = String(editData?.start_time || "").split("T")[0] || new Date().toISOString().slice(0,10); setEditData({ ...editData, start_time: t ? `${d}T${t}` : d ? `${d}T00:00` : "" }); }} />
              </div>
              <div>
                <Label>Giá vé</Label>
                <Input type="number" value={editData?.price ?? null} onChange={(e) => setEditData({ ...editData, price: Number(e.target.value) || null })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>Hủy</Button>
                <Button onClick={async () => {
                  try {
                    if (!editData?.id || editData?.id === 0) {
                      await createShowtimeApi({ movie_id: Number(editData.movie_id), start_time: editData.start_time, price: Number(editData.price || 0) })
                    } else {
                      await updateShowtimeApi(Number(editData.id), { movie_id: Number(editData.movie_id), start_time: editData.start_time, price: Number(editData.price || 0) })
                    }
                    const { items } = await getShowtimes({ page: 1, pageSize: 100 });
                    setShowtimes(items.map((x: any) => ({ id: x.id, movie_id: x.movie_id, movie_title: x.movie?.title || "", start_time: new Date(x.start_time).toISOString(), price: Number(x.price), total_sold: Number(x.total_sold || 0) })))
                  } catch (e: any) {
                    alert(e?.message || "Lỗi")
                  } finally {
                    setIsEditOpen(false)
                  }
                }}>Lưu</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
