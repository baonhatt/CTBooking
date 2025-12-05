import React, { useEffect, useMemo, useState } from "react";
import { getShowtimes, getMoviesAdmin, deleteShowtimeApi } from "@/lib/api";
import AdminLayout from "@/components/admin/AdminLayout";
import ShowtimesContent from "@/components/admin/content/ShowtimesContent";
import AdminEditModal from "@/components/admin/AdminEditModal";

export default function ShowtimesPage() {
  const [showtimes, setShowtimes] = useState<any[]>([]);
  const [totalShowtimes, setTotalShowtimes] = useState(0);
  const [showtimesPage, setShowtimesPage] = useState(1);
  const pageSize = 10;
  const [sortKey, setSortKey] = useState<
    "start_time" | "created_at" | "movie_title"
  >("start_time");
  const [todayOnly, setTodayOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editType, setEditType] = useState<"showtime" | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [moviesLocal, setMoviesLocal] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { items, total } = await getShowtimes({
        page: showtimesPage,
        pageSize,
        sort: sortKey,
        dir: "asc",
        today: todayOnly,
      });
      setShowtimes(
        items.map((s: any) => ({
          id: s.id,
          movie_id: s.movie_id,
          movie_title: s.movie?.title || "",
          start_time: new Date(s.start_time).toISOString(),
          total_sold: Number(s.total_sold || 0),
        })).filter(s =>
          searchQuery === "" ||
          s.movie_title.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      );
      setTotalShowtimes(total);
    })();
  }, [showtimesPage, pageSize, sortKey, todayOnly, searchQuery]);

  useEffect(() => {
    setShowtimesPage(1);
  }, [sortKey, todayOnly]);

  const showtimesTotalPages = useMemo(
    () => Math.max(1, Math.ceil(totalShowtimes / pageSize)),
    [totalShowtimes],
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

  const handleOpenEdit = (_type: "showtime", data: any) => {
    setEditType("showtime");
    setEditData(data);
    setIsEditOpen(true);
  };
  const handleOpenCreate = () => {
    setEditType("showtime");
    setEditData({ id: 0, movie_id: 0, start_time: "" });
    setIsEditOpen(true);
    // Load movies when creating showtime
    (async () => {
      const { items } = await getMoviesAdmin({ page: 1, pageSize: 50 });
      setMoviesLocal(
        items.map((m: any) => ({
          id: String(m.id),
          title: m.title,
          duration: m.duration_min,
          release_date: m.release_date,
          genres: m.genres,
        })),
      );
    })();
  };

  const handleRefresh = async () => {
    const { items, total } = await getShowtimes({
      page: showtimesPage,
      pageSize,
      sort: sortKey,
      dir: "asc",
      today: todayOnly,
    });
    setShowtimes(
      items.map((s: any) => ({
        id: s.id,
        movie_id: s.movie_id,
        movie_title: s.movie?.title || "",
        start_time: new Date(s.start_time).toISOString(),
        total_sold: Number(s.total_sold || 0),
      })),
    );
    setTotalShowtimes(total);
  };

  return (
    <AdminLayout
      active="showtimes"
      setActive={() => { }}
      adminEmailState={localStorage.getItem("adminEmail") || "admin@email.com"}
      handleLogout={() => { }}
    >
      <ShowtimesContent
        data={showtimes}
        onEdit={handleOpenEdit}
        onCreate={handleOpenCreate}
        formatLocalDateTime={formatLocalDateTime}
        deleteShowtimeApi={deleteShowtimeApi as any}
        setShowtimes={setShowtimes}
        totalPages={showtimesTotalPages}
        currentPage={showtimesPage}
        setPage={setShowtimesPage}
        sortKey={sortKey}
        setSortKey={setSortKey}
        todayOnly={todayOnly}
        setTodayOnly={setTodayOnly}
        onRefresh={handleRefresh}
        searchQuery={searchQuery}
        onSearchChange={(query) => {
          setSearchQuery(query);
          setShowtimesPage(1);
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
        currentPage={showtimesPage}
        setMoviesLocal={setMoviesLocal}
        setMovieStatus={() => { }}
        setToys={() => { }}
        setShowtimes={setShowtimes}
      />
    </AdminLayout>
  );
}
