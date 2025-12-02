import { useMemo, useState, useEffect } from "react";
// 1. Imports Components MỚI
import AdminLayout from "@/components/admin/AdminLayout";
import AdminEditModal from "@/components/admin/AdminEditModal";
// 2. Imports Content Components MỚI (Cần tạo các file này)
import DashboardContent from "@/components/admin/content/DashboardContent";
import UsersContent from "@/components/admin/content/UsersContent";
import MoviesContent from "@/components/admin/content/MoviesContent";
import ShowtimesContent from "@/components/admin/content/ShowtimesContent";
import ToysContent from "@/components/admin/content/ToysContent";
import TransactionsContent from "@/components/admin/content/TransactionsContent";

// Giữ các imports cần thiết cho logic
import { useMovies2025 } from "@/hooks/useMovies";
import { useNavigate } from "react-router-dom";
// ✅ Cần import getAdminUsers, getTransactions (giả định có hỗ trợ paging)
import { getToys, getMoviesAdmin, getAdminRevenue, getShowtimes, deleteShowtimeApi, deleteToyApi, getAdminUsers, getTransactions } from "@/lib/api";
interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: "active" | "inactive"; // Kiểu hẹp, chính xác
  createdAt: Date;
}
interface MovieData {
  id: string;
  title: string;
  year: number;
  duration: string;
  genres: string[];
  posterUrl: string;
  release_date: string | null; // Kiểu string/null
  rating: number | null;
  price: number;
}
// ✅ THÊM INTERFACE CHO TRANSACTION (Nếu chưa có)
interface TransactionData {
  id: string;
  user: string;
  amount: number;
  method: string;
  status: string;
  createdAt: Date;
}

export default function Admin() {
  const { data: movies = [] } = useMovies2025();
  const navigate = useNavigate();
  // --- CẬP NHẬT TOÀN BỘ STATES ---
  const [active, setActive] = useState<"dashboard" | "users" | "movies" | "toys" | "showtimes" | "transactions">("dashboard");
  const [moviesLoaded, setMoviesLoaded] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [txQuery, setTxQuery] = useState("");
  const [users, setUsers] = useState<UserData[]>(() => [
    { id: "u1", name: "a", email: "admin@email.com", phone: "0900000000", status: "active", createdAt: new Date() },
  ]);
  // 🛑 SỬA: Dùng type TransactionData[] và state phải thay đổi khi fetch
  const [transactions, setTransactions] = useState<TransactionData[]>(() => []);
  const [moviesLocal, setMoviesLocal] = useState<MovieData[]>([]);
  const [movieStatus, setMovieStatus] = useState<Record<string, "active" | "inactive">>({});
  const [toys, setToys] = useState([] as Array<{ id: number; name: string; category?: string; price: number; stock: number; status: string; image_url?: string }>)
  const [showtimes, setShowtimes] = useState([] as Array<{ id: number; movie_id: number; movie_title: string; start_time: string; price: number; total_sold: number }>)
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editType, setEditType] = useState<"user" | "movie" | "toy" | "showtime" | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [adminToken, setAdminToken] = useState<string>(() => localStorage.getItem("adminToken") || "");
  const [adminEmailState, setAdminEmailState] = useState<string>(() => localStorage.getItem("adminEmail") || "admin@email.com");
  const [usersPage, setUsersPage] = useState(1);
  const [moviesPage, setMoviesPage] = useState(1);
  const [toysPage, setToysPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const pageSize = 2;
  const [revenueTotal, setRevenueTotal] = useState(0);
  const [revenueCount, setRevenueCount] = useState(0);
  const [showtimesPage, setShowtimesPage] = useState(1);
  const [totalShowtimes, setTotalShowtimes] = useState(0);
  const [totalMovies, setTotalMovies] = useState(0);
  // ✅ THÊM STATE TỔNG MỚI
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalToys, setTotalToys] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);


  // --- LOGIC USEMEMO (TÍNH TOÁN) ---
  // Giữ lại logic mapping từ hook useMovies2025() nếu cần, nhưng không nên phụ thuộc vào nó cho Admin table
  if (!moviesLoaded && active !== "movies" && moviesLocal.length !== movies.length) {
    const mapped: MovieData[] = movies.map((m: any) => ({
      id: String(m.id),
      title: m.title,
      year: new Date(m.release_date || Date.now()).getFullYear(),
      duration: m?.duration_min ? `${Number(m.duration_min)} phút` : "",
      genres: Array.isArray(m.genres) ? m.genres : [],
      posterUrl: m.cover_image || "",
      release_date: m.release_date ? new Date(m.release_date).toISOString() : null,
      rating: m.rating ?? null,
      price: Number(m.price || 0),
    }));
    setMoviesLocal(mapped);
  }

  // 🛑 LOẠI BỎ LOGIC CLIENT-SIDE CŨ CHO USERS
  // const filteredUsers = useMemo(() => users.filter(...
  // const usersTotalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  // const usersPageData = useMemo(() => filteredUsers.slice(...
  // ✅ LOGIC SERVER-SIDE MỚI CHO USERS
  const usersTotalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const usersPageData = users; // Data này giờ là data đã được phân trang từ server

  // 🛑 LOẠI BỎ LOGIC CLIENT-SIDE CŨ CHO TRANSACTIONS
  // const filteredTransactions = useMemo(() => transactions.filter(...
  // const txTotalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  // const txPageData = useMemo(() => filteredTransactions.slice(...
  // ✅ LOGIC SERVER-SIDE MỚI CHO TRANSACTIONS
  const txTotalPages = Math.max(1, Math.ceil(totalTransactions / pageSize));
  const txPageData = transactions;

  // KHẮC PHỤC: Thêm logic tính toán metrics
  const metrics = useMemo(() => ({
    totalUsers: totalUsers,
    totalMovies: totalMovies,
    revenueTotal: revenueTotal,
    revenueCount: revenueCount,
    avgRevenuePerUser: revenueTotal / (totalUsers || 1), // Sửa totalUsers
    totalShowtimes: totalShowtimes,
    totalToys: totalToys, // Sửa totalToys
    totalTransactions: totalTransactions, // ✅ THÊM
  }), [totalMovies, totalUsers, revenueTotal, revenueCount, totalShowtimes, totalToys, totalTransactions]); // Cập nhật dependencies

  const showtimesTotalPages = Math.max(1, Math.ceil(totalShowtimes / pageSize));

  // KHẮC PHỤC: Thêm data mockup cho userStats 
  const userStats = useMemo(() => ([
    { date: '2025-01-01', count: 10 },
    { date: '2025-01-05', count: 15 },
    { date: '2025-01-10', count: 25 },
    { date: '2025-01-15', count: 22 },
    { date: '2025-01-20', count: 30 },
  ]), []);

  // KHẮC PHỤC: Thêm data mockup cho movieStats 
  const movieStats = useMemo(() => ([
    { title: 'Dune: Part Two', count: 150 },
    { title: 'Oppenheimer', count: 120 },
    { title: 'Barbie', count: 90 },
    { title: 'The Creator', count: 80 },
    { title: 'Mission Impossible', count: 70 },
  ]), []);

  // ✅ LOGIC SERVER-SIDE MỚI CHO MOVIES
  const moviesTotalPages = Math.max(1, Math.ceil(totalMovies / pageSize));

  // 🛑 LOẠI BỎ LOGIC CLIENT-SIDE CŨ CHO TOYS
  // const toysTotalPages = Math.max(1, Math.ceil(toys.length / pageSize));
  // const toysPageData = useMemo(() => toys.slice(...
  // ✅ LOGIC SERVER-SIDE MỚI CHO TOYS
  const toysTotalPages = Math.max(1, Math.ceil(totalToys / pageSize));
  const toysPageData = toys;

  // --- USEEFFECT FETCH SERVER-SIDE ---

  // ✅ FETCH USERS
  useEffect(() => {
    if (active === "users") {
      (async () => {
        try {
          const res = await getAdminUsers({ page: usersPage, pageSize: pageSize, query: userQuery });
          const { items, total } = res;

          setUsers(items.map((u: any) => ({
            id: String(u.id),
            name: u.name,
            email: u.email,
            phone: u.phone,
            status: u.is_active ? "active" : "inactive",
            createdAt: new Date(u.createdAt)
          })));
          setTotalUsers(total);
        } catch (error) {
          console.error("Lỗi fetch users:", error);
          setUsers([]);
          setTotalUsers(0);
        }
      })();
    }
  }, [active, usersPage, pageSize, userQuery]);


  // ✅ FETCH MOVIES
  useEffect(() => {
    if (active === "movies") {
      (async () => {
        try {
          const res = await getMoviesAdmin({ page: moviesPage, pageSize: pageSize });
          const { items, total } = res;
          setMoviesLocal(items.map((m: any) => ({
            id: String(m.id),
            title: m.title,
            year: new Date(m.release_date || Date.now()).getFullYear(),
            duration: m?.duration_min ? `${Number(m.duration_min)} phút` : "",
            genres: Array.isArray(m.genres) ? m.genres : [],
            posterUrl: m.cover_image || "",
            release_date: m.release_date ? new Date(m.release_date).toISOString() : null,
            rating: m.rating ?? null,
            price: Number(m.price || 0),
          })));
          setTotalMovies(total);
        } catch (error) {
          console.error("Lỗi fetch movies:", error);
        }
      })();
    }
  }, [active, moviesPage, pageSize]);

  // ✅ FETCH SHOWTIMES
  useEffect(() => {
    if (active === "showtimes") {
      (async () => {
        try {
          const res = await getShowtimes({ page: showtimesPage, pageSize: pageSize });
          const { items, total } = res;

          setShowtimes(items.map((s: any) => ({
            id: s.id,
            movie_id: s.movie_id,
            movie_title: s.movie?.title || "",
            start_time: new Date(s.start_time).toISOString(),
            price: Number(s.price),
            total_sold: Number(s.total_sold || 0)
          })));

          setTotalShowtimes(total);
        } catch {
          setShowtimes([]);
          setTotalShowtimes(0);
        }
      })()
    }
  }, [active, showtimesPage, pageSize]);

  // ✅ FETCH TOYS
  useEffect(() => {
    if (active === "toys") {
      (async () => {
        try {
          const res = await getToys({ page: toysPage, pageSize: pageSize });
          const { items, total } = res;

          setToys(items.map((t: any) => ({
            id: t.id,
            name: t.name,
            category: t.category,
            price: Number(t.price),
            stock: t.stock,
            status: t.status,
            image_url: t.image_url
          })));
          setTotalToys(total);
        } catch (error) {
          console.error("Lỗi fetch toys:", error);
          setToys([]);
          setTotalToys(0);
        }
      })();
    }
  }, [active, toysPage, pageSize]);

  // ✅ FETCH TRANSACTIONS (MỚI)
  useEffect(() => {
    if (active === "transactions") {
      (async () => {
        try {
          // Giả định getTransactions nhận query, page, pageSize
          const res = await getTransactions({ page: txPage, pageSize: pageSize, query: txQuery });
          const { items, total } = res;

          setTransactions(items.map((tx: any) => ({
            id: String(tx.id),
            user: tx.user_id, // Giả định
            amount: Number(tx.amount),
            method: tx.payment_method, // Giả định
            status: tx.status,
            createdAt: new Date(tx.createdAt)
          })));
          setTotalTransactions(total);
        } catch (error) {
          console.error("Lỗi fetch transactions:", error);
          setTransactions([]);
          setTotalTransactions(0);
        }
      })();
    }
    // Phụ thuộc vào txPage, txQuery
  }, [active, txPage, pageSize, txQuery]);


  // Giữ các useEffect còn lại (movies for showtimes, revenue)
  useEffect(() => {
    // Logic fetch movies for showtimes
    if (active === "showtimes" && moviesLocal.length === 0 && moviesLoaded) {
      getMoviesAdmin({ page: 1, pageSize: 2 }).then(({ items }) => {
        const mapped = items.map((m: any) => ({
          id: String(m.id),
          title: m.title,
          year: new Date(m.release_date || Date.now()).getFullYear(),
          duration: m?.duration_min ? `${Number(m.duration_min)} phút` : "",
          genres: Array.isArray(m.genres) ? m.genres : [],
          posterUrl: m.cover_image || "",
          release_date: m.release_date ? new Date(m.release_date).toISOString() : null,
          rating: m.rating ?? null,
          price: Number(m.price || 0),
        }));
        setMoviesLocal(mapped);
      });
    }
  }, [active, moviesLoaded, moviesLocal]);

  useEffect(() => {
    // Logic fetch revenue
    if (active === "transactions") {
      getAdminRevenue().then(({ total, count }) => {
        setRevenueTotal(total);
        setRevenueCount(count);
      });
    }
  }, [active]);

  // --- HÀM HELPER & LOGOUT (TÁCH KHỎI JSX) ---
  function toLocalDateTimeString(date: Date) {
    if (!date) return "";
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }
  function formatLocalDateTime(date: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return (
      <>
        {year}-{month}-{day} <strong style={{ color: 'red' }}> / {hours}:{minutes}</strong>
      </>
    );
  }

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminEmail");
    setAdminToken("");
    setAdminEmailState("admin@email.com");
    window.dispatchEvent(new Event("admin-auth-changed"));
    navigate("/admin", { replace: true });
  };

  // Hàm này được truyền vào Content component để mở Modal
  const handleOpenEdit = (type: "user" | "movie" | "toy" | "showtime", data: any) => {
    setEditType(type);
    setEditData(data);
    setIsEditOpen(true);
  }

  // Hàm này được truyền vào Content component để tạo mới (Movie, Toy, Showtime)
  const handleOpenCreate = (type: "movie" | "toy" | "showtime") => {
    setEditType(type);
    if (type === 'movie') { setEditData({ id: "", title: "", genres: [], duration: "", posterUrl: "", status: "active", price: 0 }); }
    if (type === 'toy') { setEditData({ id: 0, name: "", category: "", price: 0, stock: 0, status: "active", image_url: "" }); }
    if (type === 'showtime') { setEditData({ id: 0, movie_id: 0, start_time: "", price: 0 }); }
    setIsEditOpen(true);
  }


  return (
    // Sử dụng Layout component MỚI và truyền các state/handler
    <AdminLayout
      active={active}
      setActive={setActive}
      adminEmailState={adminEmailState}
      handleLogout={handleLogout}
    >

      {/* 3. Render Content Components MỚI */}
      {active === "dashboard" && <DashboardContent metrics={metrics} userStats={userStats} movieStats={movieStats} users={users} />}

      {active === "users" && <UsersContent
        data={usersPageData} // ✅ SERVER-SIDE
        totalPages={usersTotalPages} // ✅ SERVER-SIDE
        currentPage={usersPage}
        setPage={setUsersPage}
        userQuery={userQuery}
        setUserQuery={setUserQuery}
        onEdit={handleOpenEdit}
        usersLength={totalUsers} // ✅ SERVER-SIDE
      />}

      {active === "movies" && <MoviesContent
        data={moviesLocal} // ✅ SERVER-SIDE
        totalPages={moviesTotalPages} // ✅ SERVER-SIDE
        currentPage={moviesPage}
        setPage={setMoviesPage}
        movieStatus={movieStatus}
        onEdit={handleOpenEdit}
        onCreate={() => handleOpenCreate('movie')}
        moviesLength={totalMovies} // ✅ SERVER-SIDE
        formatLocalDateTime={formatLocalDateTime}
      />}

      {active === "showtimes" && <ShowtimesContent
        data={showtimes} // ✅ SERVER-SIDE
        onEdit={handleOpenEdit}
        onCreate={() => handleOpenCreate('showtime')}
        formatLocalDateTime={formatLocalDateTime}
        deleteShowtimeApi={deleteShowtimeApi}
        setShowtimes={setShowtimes} // Để xoá local

        totalPages={showtimesTotalPages} // ✅ SERVER-SIDE
        currentPage={showtimesPage}
        setPage={setShowtimesPage}
      />}

      {active === "toys" && <ToysContent
        data={toys} // ✅ SERVER-SIDE
        totalPages={toysTotalPages} // ✅ SERVER-SIDE
        currentPage={toysPage}
        setPage={setToysPage}
        onEdit={handleOpenEdit}
        onCreate={() => handleOpenCreate('toy')}
        toysLength={totalToys} // ✅ SERVER-SIDE
        deleteToyApi={deleteToyApi}
        setToys={setToys} // Để xoá local
      />}

      {active === "transactions" && <TransactionsContent
        data={txPageData} // ✅ SERVER-SIDE
        totalPages={txTotalPages} // ✅ SERVER-SIDE
        currentPage={txPage}
        setPage={setTxPage}
        txQuery={txQuery}
        setTxQuery={setTxQuery}
        metrics={metrics}
        transactions={transactions}
        transactionsLength={totalTransactions} // ✅ THÊM
      />}

      {/* 4. Render Modal Component MỚI */}
      <AdminEditModal
        isEditOpen={isEditOpen}
        setIsEditOpen={setIsEditOpen}
        editType={editType}
        editData={editData}
        setEditData={setEditData}
        setUsers={setUsers}
        moviesLocal={moviesLocal}
        toLocalDateTimeString={toLocalDateTimeString}
        // Truyền các setters để Modal có thể cập nhật lại state cục bộ (Dù ít được khuyến khích, nhưng là cách nhanh nhất để refactor code hiện tại)
        setMoviesLocal={setMoviesLocal}
        setMovieStatus={setMovieStatus}
        setToys={setToys}
        setShowtimes={setShowtimes}
        pageSize={pageSize}
        currentPage={usersPage}
      />
    </AdminLayout>
  );
}