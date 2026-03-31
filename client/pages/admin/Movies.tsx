import React, { useEffect, useMemo, useState } from 'react';
import { getMoviesAdmin, updateMovieStatus } from '@/lib/api';
import AdminLayout from '@/admin/layouts/AdminLayout';
import MoviesContent from '@/components/admin/content/MoviesContent';
import AdminEditModal from '@/components/admin/AdminEditModal';
import { toast } from 'sonner';

export default function MoviesPage() {
  const getInitialFilters = () => {
    try {
      const raw = localStorage.getItem('admin_movies_filters');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  };

  const initialFilters = getInitialFilters();

  const [moviesLocal, setMoviesLocal] = useState<any[]>([]);
  const [movieStatus, setMovieStatus] = useState<Record<string, 'active' | 'inactive'>>({});
  const [totalMovies, setTotalMovies] = useState(0);
  const [moviesPage, setMoviesPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState<string>(initialFilters.searchQuery ?? '');
  const [sortKey, setSortKey] = useState<'updated_at' | 'release_date' | 'title' | 'rating'>(
    initialFilters.sortKey ?? 'updated_at'
  );
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialFilters.sortDir ?? 'desc');
  const pageSize = 10;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editType, setEditType] = useState<'movie' | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState<boolean>(initialFilters.showActiveOnly ?? false);

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const { items, total } = await getMoviesAdmin({
        page: moviesPage,
        pageSize,
        q: searchQuery,
        sort: sortKey,
        dir: sortDir,
        status: showActiveOnly ? 'active' : 'all'
      });
      const mapped = items.map((m: any) => ({
        id: String(m.id),
        title: m.title,
        year: new Date(m.release_date || Date.now()).getFullYear(),
        duration: m?.duration_min ? `${Number(m.duration_min)}` : '',
        genres: Array.isArray(m.genres) ? m.genres : [],
        posterUrl: m.cover_image || '',
        release_date: m.release_date ? new Date(m.release_date).toISOString() : null,
        updated_at: m.updated_at ? new Date(m.updated_at).toISOString() : null,
        rating: m.rating ?? null,
        price: Number(m.price || 0),
        is_active: m.is_active
      }));
      setMoviesLocal(mapped);
      setTotalMovies(total);
      setMovieStatus((prev) => ({
        ...prev,
        ...Object.fromEntries(items.map((m: any) => [String(m.id), m.is_active ? 'active' : 'inactive']))
      }));
      setIsLoading(false);
    })();
    try {
      const state = { searchQuery, sortKey, sortDir, showActiveOnly };
      localStorage.setItem('admin_movies_filters', JSON.stringify(state));
    } catch {}
  }, [moviesPage, pageSize, searchQuery, sortKey, sortDir, showActiveOnly]);

  const moviesTotalPages = useMemo(() => Math.max(1, Math.ceil(totalMovies / pageSize)), [totalMovies]);
  const filteredMovies = useMemo(
    () => (showActiveOnly ? moviesLocal.filter((m) => (movieStatus[m.id] || 'active') === 'active') : moviesLocal),
    [showActiveOnly, moviesLocal, movieStatus]
  );
  const displayTotal = useMemo(
    () => (showActiveOnly ? filteredMovies.length : totalMovies),
    [showActiveOnly, filteredMovies, totalMovies]
  );

  function toLocalDateTimeString(date: Date) {
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
        {year}-{month}-{day}{' '}
        <strong style={{ color: 'red' }}>
          {' '}
          / {hours}:{minutes}
        </strong>
      </>
    );
  }

  const handleOpenEdit = (_type: 'movie', data: any) => {
    setEditType('movie');
    setEditData(data);
    setIsDetailsOpen(false); // Đóng modal chi tiết nếu đang mở
    setIsEditOpen(true);
  };
  const handleOpenCreate = () => {
    setEditType('movie');
    setEditData({
      id: '',
      title: '',
      genres: [],
      duration: '',
      posterUrl: '',
      status: 'active',
      price: 0
    });
    setIsEditOpen(true);
  };

  const handleViewDetails = (id: number) => {
    setSelectedMovieId(id);
    setIsEditOpen(false);
    setIsDetailsOpen(true);
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    const { items, total } = await getMoviesAdmin({
      page: moviesPage,
      pageSize,
      q: searchQuery,
      sort: sortKey,
      dir: sortDir,
      status: showActiveOnly ? 'active' : 'all'
    });
    const mapped = items.map((m: any) => ({
      id: String(m.id),
      title: m.title,
      year: new Date(m.release_date || Date.now()).getFullYear(),
      duration: m?.duration_min ? `${Number(m.duration_min)}` : '',
      genres: Array.isArray(m.genres) ? m.genres : [],
      posterUrl: m.cover_image || '',
      release_date: m.release_date ? new Date(m.release_date).toISOString() : null,
      rating: m.rating ?? null,
      price: Number(m.price || 0),
      is_active: m.is_active,
      updated_at: m.updated_at ? new Date(m.updated_at).toISOString() : null
    }));
    setMoviesLocal(mapped);
    setTotalMovies(total);
    setMovieStatus((prev) => ({
      ...prev,
      ...Object.fromEntries(items.map((m: any) => [String(m.id), m.is_active ? 'active' : 'inactive']))
    }));
    setIsLoading(false);
  };
  // Thêm hàm này vào file cha (MoviesPage.tsx)
  // In client/pages/admin/Movies.tsx

  const handleToggleStatus = async (id: string | number, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      const response = await updateMovieStatus(Number(id), newStatus);
      setMovieStatus((prev) => ({
        ...prev,
        [String(id)]: newStatus ? 'active' : 'inactive'
      }));

      toast.success(response.status == 'success' ? 'Thành công' : 'Thất bại', {
        description: response.message
      });
    } catch (e: any) {
      toast.error('Lỗi', {
        description: e?.message || 'Có lỗi xảy ra'
      });
    } finally {
    }
  };
  return (
    <AdminLayout
      active={'movies' as any}
      setActive={(() => {}) as any}
      adminEmailState={localStorage.getItem('adminEmail') || 'admin@email.com'}
      handleLogout={() => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminEmail');
        window.dispatchEvent(new Event('admin-auth-changed'));
        window.location.href = '/admin';
      }}
    >
      <MoviesContent
        data={filteredMovies}
        totalPages={moviesTotalPages}
        currentPage={moviesPage}
        setPage={setMoviesPage}
        movieStatus={movieStatus}
        onToggleStatus={handleToggleStatus}
        onEdit={handleOpenEdit}
        onCreate={handleOpenCreate}
        moviesLength={displayTotal}
        onRefresh={handleRefresh}
        searchQuery={searchQuery}
        onSearchChange={(query) => {
          setSearchQuery(query);
          setMoviesPage(1);
        }}
        sortKey={sortKey}
        sortDir={sortDir}
        setSortKey={setSortKey}
        setSortDir={setSortDir}
        isLoading={isLoading}
        showActiveOnly={showActiveOnly}
        setShowActiveOnly={setShowActiveOnly}
        isDetailsOpen={isDetailsOpen}
        setIsDetailsOpen={setIsDetailsOpen}
        selectedMovieId={selectedMovieId}
        setSelectedMovieId={setSelectedMovieId}
      />
      <AdminEditModal
        isEditOpen={isEditOpen}
        setIsEditOpen={setIsEditOpen}
        editType={editType as any}
        editData={editData}
        setEditData={setEditData}
        setUsers={() => {}}
        moviesLocal={moviesLocal}
        toLocalDateTimeString={toLocalDateTimeString}
        pageSize={pageSize}
        currentPage={moviesPage}
        setMoviesLocal={setMoviesLocal}
        setMovieStatus={setMovieStatus}
        setToys={() => {}}
        onViewDetails={handleViewDetails}
        onRefresh={handleRefresh}
      />
    </AdminLayout>
  );
}
