import { useMemo, useState } from "react";
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
} from "@/components/ui/sidebar";
import { LayoutDashboard, UserCircle, Film, Gamepad2, CreditCard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { adminLoginApi } from "@/lib/api";

export default function Admin() {
  const { data: movies = [] } = useMovies2025();
  const [active, setActive] = useState<"dashboard" | "users" | "movies" | "toys" | "transactions">("dashboard");
  const [userQuery, setUserQuery] = useState("");
  const [txQuery, setTxQuery] = useState("");
  const [users, setUsers] = useState(() => [
    { id: "u1", name: "a", email: "admin@email.com", phone: "0900000000", status: "active", createdAt: new Date() },
  ]);
  const [transactions] = useState(() => [] as Array<{ id: string; user: string; amount: number; method: string; status: string; createdAt: Date }>);
  const [moviesLocal, setMoviesLocal] = useState(movies);
  const [movieStatus, setMovieStatus] = useState<Record<string, "active" | "inactive">>({});
  const [toys, setToys] = useState([] as Array<{ id: string; name: string; category: string; price: number; stock: number; status: string; imageUrl?: string }>)
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editType, setEditType] = useState<"user" | "movie" | "toy" | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [adminToken, setAdminToken] = useState<string>(() => localStorage.getItem("adminToken") || "");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const isAuthed = !!adminToken;

  if (moviesLocal.length !== movies.length) {
    setMoviesLocal(movies);
  }

  const filteredUsers = useMemo(() => {
    const q = userQuery.toLowerCase();
    return users.filter((u) => [u.name, u.email, u.phone].some((x) => x.toLowerCase().includes(q)));
  }, [userQuery, users]);

  const filteredTransactions = useMemo(() => {
    const q = txQuery.toLowerCase();
    return transactions.filter((t) => [t.user, t.method, t.status, t.id].some((x) => String(x).toLowerCase().includes(q)));
  }, [txQuery, transactions]);

  const metrics = useMemo(() => {
    const activeUsers = users.filter((u) => u.status === "active").length;
    const totalRevenue = transactions.filter((t) => t.status === "success").reduce((s, t) => s + t.amount, 0);
    return { movies: movies.length, activeUsers, totalRevenue, toys: 0, tx: transactions.length };
  }, [movies, users, transactions]);

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
      <Sidebar className="bg-[#0a1220] text-white">
        <SidebarHeader>
          <div className="px-2 text-sm">Quản lý</div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={active === "dashboard"} onClick={() => setActive("dashboard")}>
                <LayoutDashboard className="mr-2" /> Dashboard
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={active === "users"} onClick={() => setActive("users")}>
                <UserCircle className="mr-2" /> Người dùng
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={active === "movies"} onClick={() => setActive("movies")}>
                <Film className="mr-2" /> Phim
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={active === "toys"} onClick={() => setActive("toys")}>
                <Gamepad2 className="mr-2" /> Đồ chơi
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={active === "transactions"} onClick={() => setActive("transactions")}>
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
              setAdminToken("");
            }}
          >
            Đăng xuất
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="border-b px-6 py-3 flex items-center justify-between bg-white/80">
          <div className="font-semibold">Admin Portal</div>
          <div className="text-sm text-gray-600">admin@email.com</div>
        </div>
        <div className="p-6">
          {active === "dashboard" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-gray-500">Tổng quan hệ thống quản lý</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Tổng người dùng</CardTitle>
                  </CardHeader>
                  <CardContent className="text-3xl font-bold">{metrics.activeUsers}</CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Phim</CardTitle>
                  </CardHeader>
                  <CardContent className="text-3xl font-bold">{metrics.movies}</CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Đồ chơi</CardTitle>
                  </CardHeader>
                  <CardContent className="text-3xl font-bold">{metrics.toys}</CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Giao dịch</CardTitle>
                  </CardHeader>
                  <CardContent className="text-3xl font-bold">{metrics.tx}</CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Tổng doanh thu</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-blue-600">{metrics.totalRevenue.toLocaleString("vi-VN")} đ</div>
                  <div className="text-gray-500">Từ {metrics.tx} giao dịch</div>
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
                      {filteredUsers.map((u) => (
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
                      {moviesLocal.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="flex items-center gap-2"><img src={m.posterUrl} className="w-8 h-8 rounded" />{m.title}</TableCell>
                          <TableCell>{m.genres.join(", ")}</TableCell>
                          <TableCell>{m.duration}</TableCell>
                          <TableCell>—</TableCell>
                          <TableCell>—</TableCell>
                          <TableCell>
                            <Badge variant={ (movieStatus[m.id] ?? "active") === "active" ? "secondary" : "outline" }>
                              { (movieStatus[m.id] ?? "active") === "active" ? "Hoạt động" : "Đã ẩn" }
                            </Badge>
                          </TableCell>
                          <TableCell><Button variant="outline" size="sm" onClick={() => { setEditType("movie"); setEditData(m); setIsEditOpen(true); }}>Sửa</Button></TableCell>
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
                <Button onClick={() => { setEditType("toy"); setEditData({ id: "", name: "", category: "", price: 0, stock: 0, status: "active", imageUrl: "" }); setIsEditOpen(true); }}>Thêm đồ chơi</Button>
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
                      {toys.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="flex items-center gap-2">{t.imageUrl && <img src={t.imageUrl} className="w-8 h-8 rounded object-cover" />}<span>{t.name}</span></TableCell>
                          <TableCell>{t.category}</TableCell>
                          <TableCell>{t.price.toLocaleString("vi-VN")} đ</TableCell>
                          <TableCell>{t.stock}</TableCell>
                          <TableCell><Badge variant="secondary">{t.status}</Badge></TableCell>
                          <TableCell><Button size="sm" variant="outline" onClick={() => { setEditType("toy"); setEditData(t); setIsEditOpen(true); }}>Sửa</Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
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
                <Card><CardHeader><CardTitle>Hoàn thành</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-emerald-600">{transactions.filter(t=>t.status==='success').length}</CardContent></Card>
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
                      {filteredTransactions.map((t) => (
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
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        {!isAuthed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <Card className="w-full max-w-sm bg-white">
              <CardHeader>
                <CardTitle>Đăng nhập Admin</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label>Email</Label>
                    <Input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label>Mật khẩu</Label>
                    <Input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={async () => {
                        try {
                          const { token } = await adminLoginApi({ email: loginEmail, password: loginPassword });
                          localStorage.setItem("adminToken", token);
                          setAdminToken(token);
                        } catch (err) {}
                      }}
                    >
                      Đăng nhập
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </SidebarInset>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editType === "user" ? "Chỉnh sửa người dùng" : editType === "movie" ? "Chỉnh sửa phim" : editType === "toy" ? "Chỉnh sửa đồ chơi" : ""}</DialogTitle>
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
                <Label>Thể loại</Label>
                <Input value={(editData?.genres || []).join(", ")} onChange={(e) => setEditData({ ...editData, genres: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
              </div>
              <div>
                <Label>Thời lượng</Label>
                <Input value={editData?.duration || ""} onChange={(e) => setEditData({ ...editData, duration: e.target.value })} />
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
                <Button onClick={() => {
                  if (!editData.id) {
                    const id = `mv-${Date.now()}`;
                    setMoviesLocal((prev) => [...prev, { ...editData, id }]);
                    setMovieStatus((prev) => ({ ...prev, [id]: (editData?.status || "active") }));
                  } else {
                    setMoviesLocal((prev) => prev.map((m) => (m.id === editData.id ? { ...m, ...editData } : m)));
                    setMovieStatus((prev) => ({ ...prev, [editData.id]: (editData?.status || (prev[editData.id] ?? "active")) }));
                  }
                  setIsEditOpen(false);
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
                    setEditData({ ...editData, imageUrl: url, imageFile: file });
                  }
                }} />
                {editData?.imageUrl && (<div className="mt-2"><img src={editData?.imageUrl} className="w-full max-h-40 object-cover rounded" /></div>)}
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
                <Button onClick={() => {
                  if (!editData.id) {
                    const id = `toy-${Date.now()}`;
                    setToys((prev) => [...prev, { ...editData, id }]);
                  } else {
                    setToys((prev) => prev.map((t) => (t.id === editData.id ? { ...t, ...editData } : t)));
                  }
                  setIsEditOpen(false);
                }}>Lưu</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
