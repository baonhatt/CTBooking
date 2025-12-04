import React, { useEffect, useMemo, useState } from "react";
import { getMoviesAdmin } from "@/lib/api";
import AdminLayout from "@/components/admin/AdminLayout";
import MoviesContent from "@/components/admin/content/MoviesContent";
import AdminEditModal from "@/components/admin/AdminEditModal";

export default function MoviesPage() {
  const [moviesLocal, setMoviesLocal] = useState<any[]>([]);
  const [movieStatus, setMovieStatus] = useState<
    Record<string, "active" | "inactive">
  >({});
  const [totalMovies, setTotalMovies] = useState(0);
  const [moviesPage, setMoviesPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const pageSize = 10;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editType, setEditType] = useState<"movie" | null>(null);
  const [editData, setEditData] = useState<any>({});

  useEffect(() => {
    (async () => {
      const { items, total } = await getMoviesAdmin({
        page: moviesPage,
        pageSize,
        q: searchQuery,
      });
      const mapped = items.map((m: any) => ({
        id: String(m.id),
        title: m.title,
        year: new Date(m.release_date || Date.now()).getFullYear(),
        duration: m?.duration_min ? `${Number(m.duration_min)}` : "",
        genres: Array.isArray(m.genres) ? m.genres : [],
        posterUrl: m.cover_image || "",
        release_date: m.release_date
          ? new Date(m.release_date).toISOString()
          : null,
        rating: m.rating ?? null,
        price: Number(m.price || 0),
      }));
      setMoviesLocal(mapped);
      setTotalMovies(total);
      setMovieStatus((prev) => ({
        ...prev,
        ...Object.fromEntries(mapped.map((x: any) => [x.id, "active"])),
      }));
    })();
  }, [moviesPage, pageSize, searchQuery]);

  const moviesTotalPages = useMemo(
    () => Math.max(1, Math.ceil(totalMovies / pageSize)),
    [totalMovies],
  );

  function toLocalDateTimeString(date: Date) {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }
  function formatLocalDateTime(date: Date) {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return (
      <>
        {year}-{month}-{day}{" "}
        <strong style={{ color: "red" }}>
          {" "}
          / {hours}:{minutes}
        </strong>
      </>
    );
  }

  const handleOpenEdit = (_type: "movie", data: any) => {
    setEditType("movie");
    setEditData(data);
    setIsEditOpen(true);
  };
  const handleOpenCreate = () => {
    setEditType("movie");
    setEditData({
      id: "",
      title: "",
      genres: [],
      duration: "",
      posterUrl: "",
      status: "active",
      price: 0,
    });
    setIsEditOpen(true);
  };

  const handleRefresh = async () => {
    const { items, total } = await getMoviesAdmin({
      page: moviesPage,
      pageSize,
    });
    const mapped = items.map((m: any) => ({
      id: String(m.id),
      title: m.title,
      year: new Date(m.release_date || Date.now()).getFullYear(),
      duration: m?.duration_min ? `${Number(m.duration_min)}` : "",
      genres: Array.isArray(m.genres) ? m.genres : [],
      posterUrl: m.cover_image || "",
      release_date: m.release_date
        ? new Date(m.release_date).toISOString()
        : null,
      rating: m.rating ?? null,
      price: Number(m.price || 0),
    }));
    setMoviesLocal(mapped);
    setTotalMovies(total);
    setMovieStatus((prev) => ({
      ...prev,
      ...Object.fromEntries(mapped.map((x: any) => [x.id, "active"])),
    }));
  };

  return (
    <AdminLayout
      active="movies"
      setActive={() => { }}
      adminEmailState={localStorage.getItem("adminEmail") || "admin@email.com"}
      handleLogout={() => { }}
    >
      <MoviesContent
        data={moviesLocal}
        totalPages={moviesTotalPages}
        currentPage={moviesPage}
        setPage={setMoviesPage}
        movieStatus={movieStatus}
        onEdit={handleOpenEdit}
        onCreate={handleOpenCreate}
        moviesLength={totalMovies}
        formatLocalDateTime={formatLocalDateTime}
        onRefresh={handleRefresh}
        searchQuery={searchQuery}
        onSearchChange={(query) => {
          setSearchQuery(query);
          setMoviesPage(1);
        }}
      />
      <AdminEditModal
        isEditOpen={isEditOpen}
        setIsEditOpen={setIsEditOpen}
        editType={editType as any}
        editData={editData}
        setEditData={setEditData}
        setUsers={() => { }}
        moviesLocal={moviesLocal}
        toLocalDateTimeString={toLocalDateTimeString}
        pageSize={pageSize}
        currentPage={moviesPage}
        setMoviesLocal={setMoviesLocal}
        setMovieStatus={setMovieStatus}
        setToys={() => { }}
        setShowtimes={() => { }}
      />
    </AdminLayout>
  );
}
