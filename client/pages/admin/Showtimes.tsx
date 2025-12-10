import React, { useEffect, useMemo, useState } from "react";
import { getShowtimes, getMoviesAdmin, deleteShowtimeApi, updateShowtimeApi } from "@/lib/api";
import AdminLayout from "@/admin/layouts/AdminLayout";
import ShowtimesContent from "@/components/admin/content/ShowtimesContent";
import AdminEditModal from "@/components/admin/AdminEditModal";

export default function ShowtimesPage() {
  const [showtimes, setShowtimes] = useState<any[]>([]);
  const [totalShowtimes, setTotalShowtimes] = useState(0);
  const [showtimesPage, setShowtimesPage] = useState(1);
  const pageSize = 10;
  const [sortKey, setSortKey] = useState<"start_time" | "created_at" | "movie_title">("start_time");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [voidOnly, setVoidOnly] = useState(false);
  const [futureOnly, setFutureOnly] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchId, setSearchId] = useState<string>("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editType, setEditType] = useState<"showtime" | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [moviesLocal, setMoviesLocal] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const fromTo = (() => {
        if (selectedDate) {
          const d = new Date(selectedDate);
          const start = new Date(d);
          start.setHours(0, 0, 0, 0);
          const end = new Date(d);
          end.setHours(23, 59, 59, 999);
          return { from: start.toISOString(), to: end.toISOString() };
        }
        if (futureOnly) {
          const now = new Date();
          return { from: now.toISOString() } as any;
        }
        return {} as any;
      })();
      const input = (searchQuery || "").trim();
      const idNum = Number(input);
      const isId = Number.isInteger(idNum) && idNum > 0;
      const { items, total } = await getShowtimes({
        page: showtimesPage,
        pageSize,
        sort: sortKey,
        dir: "asc",
        ...fromTo,
        q: isId ? undefined : searchQuery,
        void: voidOnly,
        id: isId ? idNum : undefined,
      });
      setShowtimes(
        items.map((s: any) => ({
          id: s.id,
          movie_id: s.movie_id,
          movie_title: s.movie?.title || "",
          start_time: new Date(s.start_time).toISOString(),
          total_sold: Number(s.total_sold || 0),
          is_active: s.is_active !== false,
          hasPaidBookings: !!s.hasPaidBookings,
          hasRecentPending: !!s.hasRecentPending,
        })),
      );
      setTotalShowtimes(total);
      setIsLoading(false);
    })();
  }, [showtimesPage, pageSize, sortKey, selectedDate, searchQuery, voidOnly, futureOnly]);

  useEffect(() => {
    setShowtimesPage(1);
  }, [sortKey, selectedDate]);

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
    setIsLoading(true);
    const fromTo = (() => {
      if (selectedDate) {
        const d = new Date(selectedDate);
        const start = new Date(d);
        start.setHours(0, 0, 0, 0);
        const end = new Date(d);
        end.setHours(23, 59, 59, 999);
        return { from: start.toISOString(), to: end.toISOString() };
      }
      if (futureOnly) {
        const now = new Date();
        return { from: now.toISOString() } as any;
      }
      return {} as any;
    })();
    const input = (searchQuery || "").trim();
    const idNum = Number(input);
    const isId = Number.isInteger(idNum) && idNum > 0;
    const { items, total } = await getShowtimes({
      page: showtimesPage,
      pageSize,
      sort: sortKey,
      dir: "asc",
      ...fromTo,
      q: isId ? undefined : searchQuery,
      void: voidOnly,
      id: isId ? idNum : undefined,
    });
    setShowtimes(
      items.map((s: any) => ({
        id: s.id,
        movie_id: s.movie_id,
        movie_title: s.movie?.title || "",
        start_time: new Date(s.start_time).toISOString(),
        total_sold: Number(s.total_sold || 0),
        is_active: s.is_active !== false,
        hasPaidBookings: !!s.hasPaidBookings,
        hasRecentPending: !!s.hasRecentPending,
      })),
    );
    setTotalShowtimes(total);
    setIsLoading(false);
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
        selectedDate={selectedDate}
        setSelectedDate={(d) => {
          setSelectedDate(d);
          setShowtimesPage(1);
        }}
        futureOnly={futureOnly}
        setFutureOnly={(v) => {
          setFutureOnly(v);
          setShowtimesPage(1);
        }}
        voidOnly={voidOnly}
        setVoidOnly={(v) => {
          setVoidOnly(v);
          if (v) setFutureOnly(false);
          setShowtimesPage(1);
        }}
        totalItems={totalShowtimes}
        onReactivate={async (id: number) => {
          try {
            await updateShowtimeApi(id, { is_active: true });
            await handleRefresh();
          } catch (e: any) {
            alert(e?.message || "Không thể kích hoạt lại suất chiếu");
          }
        }}
        onRefresh={handleRefresh}
        searchQuery={searchQuery}
        onSearchChange={(query) => {
          setSearchQuery(query);
          setShowtimesPage(1);
        }}
        searchId={searchId}
        setSearchId={(v) => {
          setSearchId(v);
          setShowtimesPage(1);
        }}
        isLoading={isLoading}
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
