import React, { useState, useEffect } from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { BranchIdsBadge } from '@/components/admin/BranchIdsBadge';
import { Switch } from '@/components/ui/switch';
import {
  Pencil,
  Clock,
  Star,
  Search,
  FilterX,
  RefreshCw,
  Plus,
  History,
  Trash2,
  FileText,
  Image,
  Calendar,
  Ticket,
  AlertCircle,
  SortDesc,
  SortAsc,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { getMovieById } from '@/lib/api';
import { activeStatusLabel, formatVnd, formatVnDate, formatVnDateTime } from '@/lib/format';
import { AdminDialog } from '@/components/admin/common/AdminDialog';
import { ConfirmDialog } from '@/components/admin/common/ConfirmDialog';
import { RowActionButton, RowActions } from '@/components/admin/common/RowActionButton';
import { StatusBadge } from '@/components/admin/common/StatusBadge';
import { PageHeader } from '@/components/admin/common/PageHeader';
import { AdminPagination } from '@/components/admin/common/AdminPagination';
import { EmptyState, TableSkeleton, InlineLoading } from '@/components/admin/common/EmptyState';
import {
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_OUTLINE,
  ADMIN_CARD,
  ADMIN_TABLE_HEAD,
  ADMIN_TH,
  ADMIN_TEXT
} from '@/components/admin/common/adminTokens';
import { optimizeCloudinaryUrl } from '@/lib/utils';

import { useNavigate } from 'react-router-dom';
import { useStaffPermissions, useIsSuperAdmin, useStaffBranchIds } from '@/hooks/useStaffPermission';
import { parseBranchIdsFromApi } from '@/lib/branch-ids';

interface MovieData {
  id: string | number;
  title: string;
  duration: string;
  genres: string[];
  posterUrl: string;
  release_date: string | null;
  rating: number | null;
  updated_at: string;
  cover_image?: string;
  created_by_staff_name?: string;
  updated_by_staff_name?: string;
  branch_id?: number | null;
  branch_ids?: number[] | null;
}

interface Props {
  data: MovieData[];
  totalPages: number;
  currentPage: number;
  setPage: (p: number) => void;
  movieStatus: Record<string, string>; // Changed from "active" | "inactive" to string
  onToggleStatus: (id: string | number, currentStatus: boolean) => void;
  onEdit: (type: 'movie', data: any) => void;
  onCreate: () => void;
  moviesLength: number;
  onRefresh: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  setSortKey?: (k: any) => void;
  setSortDir?: (d: 'asc' | 'desc') => void;
  isLoading?: boolean;
  showActiveOnly?: boolean;
  setShowActiveOnly?: (v: boolean) => void;
  isDetailsOpen: boolean;
  setIsDetailsOpen: (v: boolean) => void;
  selectedMovieId: number | null;
  setSelectedMovieId: (id: number | null) => void;
  branches?: any[];
  selectedBranchId?: number | 'all' | null;
  setSelectedBranchId?: (id: number | 'all' | null) => void;
  onDelete?: (id: number) => void;
}

export default function MoviesContent({
  data,
  totalPages,
  currentPage,
  setPage,
  movieStatus,
  onToggleStatus,
  onEdit,
  onCreate,
  moviesLength,
  onRefresh,
  searchQuery = '',
  onSearchChange = () => {},
  sortKey = 'updated_at',
  setSortKey = () => {},
  sortDir = 'desc',
  setSortDir = () => {},
  isLoading = false,
  showActiveOnly = false,
  setShowActiveOnly = () => {},
  isDetailsOpen = false,
  setIsDetailsOpen = () => {},
  selectedMovieId = null,
  setSelectedMovieId = () => {},
  branches = [],
  selectedBranchId = null,
  setSelectedBranchId = () => {},
  onDelete
}: Props) {
  const navigate = useNavigate();
  const permissions = useStaffPermissions();
  const isSuperAdmin = useIsSuperAdmin();
  const staffBranchIds = useStaffBranchIds();

  const canModifyMovie = (movie: any) => {
    if (isSuperAdmin) return true;
    if (!staffBranchIds.length) return false;
    const parsed = parseBranchIdsFromApi(movie.branch_ids ?? movie.branch_id);
    if (parsed === null) return false; // Global records cannot be modified by branch staff
    if (parsed.length === 0) return false;
    return parsed.every((id: number) => staffBranchIds.includes(id));
  };

  const hasPermission = (module: string, action: string) => {
    if (isSuperAdmin) return true;
    return permissions.some((p) => p.module === module && p.action === action);
  };


  const [movieDetails, setMovieDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  // Bumped by the retry button to load the detail again
  const [detailsReloadKey, setDetailsReloadKey] = useState(0);
  // The movie whose active switch was clicked, waiting for the user to confirm
  const [statusTarget, setStatusTarget] = useState<{ movie: MovieData; isActive: boolean } | null>(null);

  const openEditFromDetails = () => {
    if (!movieDetails) return;
    onEdit('movie', {
      id: movieDetails.id,
      title: movieDetails.title,
      description: movieDetails.description,
      genres: movieDetails.genres,
      rating: movieDetails.rating,
      duration: movieDetails.duration_min,
      posterUrl: movieDetails.cover_image,
      is_active: movieDetails.is_active,
      release_date: movieDetails.release_date,
      // Without the branches the form would save this movie as "all branches"
      branch_id: movieDetails.branch_id,
      branch_ids: movieDetails.branch_ids
    });
  };

  useEffect(() => {
    if (isDetailsOpen && selectedMovieId) {
      (async () => {
        try {
          setIsLoadingDetails(true);
          setDetailsError('');
          const details = await getMovieById(selectedMovieId);
          setMovieDetails(details);
        } catch (err: any) {
          console.error('Lỗi load chi tiết:', err);
          setMovieDetails(null);
          setDetailsError(err?.message || 'Không tải được chi tiết phim');
        } finally {
          setIsLoadingDetails(false);
        }
      })();
    } else {
      setMovieDetails(null);
      setDetailsError('');
    }
  }, [isDetailsOpen, selectedMovieId, detailsReloadKey]);

  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSearchChange(localSearch);
  };

  return (
    <div className="space-y-4 font-sans">
      <PageHeader title="Quản lý phim" description={`Tổng cộng ${moviesLength} phim trong hệ thống`} />

      {/* TOOLBAR */}
      <div className={`${ADMIN_CARD} flex flex-col items-start justify-between gap-4 p-4 xl:flex-row xl:items-center`}>
        {/* L E F T - G R O U P */}
        <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative w-[280px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm tên phim..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button type="submit" className={`${ADMIN_BTN_PRIMARY} shrink-0 gap-1.5`}>
              <Search className="h-4 w-4" /> {ADMIN_TEXT.search}
            </Button>
          </form>

          <div className="flex h-10 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
            <span className="whitespace-nowrap text-xs font-medium text-slate-500">Chỉ hiện đang chiếu</span>
            <Switch
              checked={showActiveOnly}
              onCheckedChange={setShowActiveOnly}
              className="cursor-pointer data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300"
            />
          </div>
        </div>

        {/* R I G H T - G R O U P */}
        <div className="flex w-full flex-wrap items-center justify-start gap-2.5 font-sans xl:w-auto xl:justify-end">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 p-1">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
              aria-label="Sắp xếp theo"
              className="h-9 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-xs shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="updated_at">Mới cập nhật</option>
              <option value="title">Theo tên phim</option>
              <option value="rating">Đánh giá cao</option>
              <option value="release_date">Ngày phát hành</option>
            </select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortDir?.(sortDir === 'asc' ? 'desc' : 'asc')}
              className="h-9 w-9 shrink-0 rounded-lg border-slate-200 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
              title={sortDir === 'asc' ? 'Tăng dần' : 'Giảm dần'}
              aria-label={sortDir === 'asc' ? 'Đang tăng dần, bấm để giảm dần' : 'Đang giảm dần, bấm để tăng dần'}
            >
              {sortDir === 'desc' ? (
                <SortDesc className="h-4 w-4 text-slate-600" />
              ) : (
                <SortAsc className="h-4 w-4 text-slate-600" />
              )}
            </Button>
          </div>

          {branches.length > 0 ? (
            <select
              value={selectedBranchId || 'all'}
              onChange={(e) => setSelectedBranchId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              aria-label="Lọc theo chi nhánh"
              className="h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-xs shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              {isSuperAdmin && <option value="all">Tất cả chi nhánh</option>}
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
              <span>Đang tải chi nhánh...</span>
            </div>
          )}

          {hasPermission('movies', 'view_deleted') && (
            <Button variant="outline" onClick={() => navigate('/deleted/movies')} className={`${ADMIN_BTN_OUTLINE} gap-2`}>
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Xem đã xóa</span>
            </Button>
          )}

          {hasPermission('movies', 'create') && (
            <Button onClick={onCreate} className={`${ADMIN_BTN_PRIMARY} gap-2`}>
              <Plus className="h-4 w-4" /> Thêm mới
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLocalSearch('');
              onSearchChange('');
              onRefresh();
            }}
            className={`${ADMIN_BTN_OUTLINE} gap-2`}
            aria-label="Làm mới danh sách"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> {ADMIN_TEXT.refresh}
          </Button>
        </div>
      </div>

      {/* TABLE */}
      <div className={`${ADMIN_CARD} overflow-hidden font-sans`}>
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={<FilterX className="h-6 w-6" />}
            title={searchQuery || showActiveOnly ? 'Không tìm thấy phim nào phù hợp' : 'Chưa có phim nào'}
            action={
              searchQuery || showActiveOnly ? (
                <Button variant="link" onClick={onRefresh} className="text-xs text-blue-600">
                  Xóa bộ lọc & thử lại
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader className={ADMIN_TABLE_HEAD}>
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className={`${ADMIN_TH} py-3`}>Phim & thể loại</TableHead>
                <TableHead className={`${ADMIN_TH} py-3 text-center`}>Đánh giá</TableHead>
                <TableHead className={`${ADMIN_TH} py-3`}>Ngày phát hành</TableHead>
                {/* Low priority: hidden below 2xl so the action column always fits next to the open sidebar */}
                <TableHead className={`${ADMIN_TH} hidden py-3 2xl:table-cell`}>Cập nhật</TableHead>
                <TableHead className={`${ADMIN_TH} py-3`}>Chi nhánh</TableHead>
                <TableHead className={`${ADMIN_TH} py-3 text-center`}>Trạng thái</TableHead>
                <TableHead className={`${ADMIN_TH} py-3 pr-6 text-right`}>{ADMIN_TEXT.actionColumn}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((movie) => {
                const isActive = movieStatus[movie.id] === 'active';
                const canEditThisMovie = canModifyMovie(movie);
                return (
                  <TableRow key={movie.id} className="group h-[52px] border-b border-slate-200 transition-colors hover:bg-slate-50">
                    <TableCell>
                      <div className="flex items-center gap-3 py-2">
                        <div className="relative shrink-0 transition-transform group-hover:scale-105">
                          <img
                            src={optimizeCloudinaryUrl(movie.posterUrl, 200) || 'https://placehold.co/400x600?text=No+Poster'}
                            loading="lazy"
                            className="h-16 w-12 rounded-lg border border-slate-100 object-cover shadow-sm"
                            alt=""
                          />
                          {movie.duration && (
                            <div className="absolute -bottom-1 -right-1 flex items-center gap-0.5 rounded border bg-white px-1 text-[11px] font-bold text-slate-600 shadow-sm">
                              <Clock size={8} /> {movie.duration}′
                            </div>
                          )}
                        </div>
                        <div className="flex min-w-0 max-w-[260px] flex-col gap-0.5">
                          <h4 className="line-clamp-2 font-bold leading-tight text-slate-900" title={movie.title}>
                            {movie.title}
                          </h4>
                          <p className="line-clamp-1 text-[11px] text-slate-500" title={movie.genres.join(' • ')}>
                            {movie.genres.length > 0 ? movie.genres.join(' • ') : '-'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1 rounded-md border border-yellow-100 bg-yellow-50 px-2 py-0.5">
                        <Star size={10} className="fill-yellow-500 text-yellow-500" />
                        {/* A blank rating is shown as "-", not as 0 */}
                        <span className="text-xs font-black text-yellow-700">
                          {movie.rating === null || movie.rating === undefined ? '-' : movie.rating}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">{formatVnDate(movie.release_date)}</TableCell>
                    <TableCell className="hidden 2xl:table-cell">
                      <div className="flex flex-col text-[11px]">
                        <span className="flex items-center gap-1 font-medium text-slate-600">
                          <History size={10} className="text-slate-400" />
                          {formatVnDateTime(movie.updated_at)}
                        </span>
                        <span className="cursor-help italic text-slate-400" title={formatVnDateTime(movie.updated_at)}>
                          {movie.updated_at
                            ? formatDistanceToNow(new Date(movie.updated_at), { addSuffix: true, locale: vi })
                            : ''}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <BranchIdsBadge branch_ids={movie.branch_ids} branch_id={movie.branch_id} branches={branches || []} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2 py-2">
                        {hasPermission('movies', 'toggle_status') && canEditThisMovie ? (
                          <Switch
                            checked={isActive}
                            onCheckedChange={() => setStatusTarget({ movie, isActive })}
                            aria-label={`Đổi trạng thái phim ${movie.title}`}
                            className="cursor-pointer border-2 border-transparent transition-all"
                            style={{ opacity: 1, backgroundColor: isActive ? '#10b981' : '#d1d5db', boxShadow: 'none' }}
                          />
                        ) : (
                          <Switch
                            checked={isActive}
                            disabled
                            className="cursor-not-allowed opacity-40"
                            style={{ backgroundColor: isActive ? '#10b981' : '#d1d5db' }}
                          />
                        )}
                        <StatusBadge status={isActive ? 'active' : 'inactive'} />
                      </div>
                    </TableCell>

                    <TableCell className="pr-6">
                      <RowActions>
                        <RowActionButton
                          action="view"
                          label={`Xem chi tiết phim ${movie.title}`}
                          onClick={() => {
                            setSelectedMovieId(Number(movie.id));
                            setIsDetailsOpen(true);
                          }}
                        />
                        {hasPermission('movies', 'edit') && (
                          <RowActionButton
                            action="edit"
                            disabled={!canEditThisMovie}
                            label={canEditThisMovie ? undefined : 'Chỉ Super Admin mới có quyền sửa phim này'}
                            onClick={() => canEditThisMovie && onEdit('movie', movie)}
                          />
                        )}
                        {onDelete && hasPermission('movies', 'delete') && canEditThisMovie && (
                          <RowActionButton action="delete" label={`Xóa phim ${movie.title}`} onClick={() => onDelete(Number(movie.id))} />
                        )}
                      </RowActions>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* PAGINATION */}
      <AdminPagination
        page={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        totalLabel={`${moviesLength} phim trong hệ thống`}
      />

      {/* STATUS CONFIRM */}
      <ConfirmDialog
        open={!!statusTarget}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        variant={statusTarget?.isActive ? 'warning' : 'info'}
        title="Xác nhận thay đổi trạng thái"
        description={
          statusTarget?.isActive ? (
            <span>
              Bạn có muốn <strong>ngừng hoạt động</strong> phim này không?
              <br />
              Phim sẽ không xuất hiện trên giao diện người dùng.
            </span>
          ) : (
            <span>
              Bạn có muốn <strong>kích hoạt</strong> phim này không?
              <br />
              Phim sẽ bắt đầu hiển thị công khai trên website.
            </span>
          )
        }
        confirmText={statusTarget?.isActive ? 'Ngừng hoạt động' : 'Kích hoạt'}
        onConfirm={() => {
          if (statusTarget) onToggleStatus(statusTarget.movie.id, statusTarget.isActive);
          setStatusTarget(null);
        }}
      />

      {/* MODAL CHI TIẾT */}
      <AdminDialog
        open={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        mode="view"
        size="lg"
        title="Chi tiết phim"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setIsDetailsOpen(false)} className={ADMIN_BTN_OUTLINE}>
              {ADMIN_TEXT.close}
            </Button>
            {movieDetails && hasPermission('movies', 'edit') && canModifyMovie(movieDetails) && (
              <Button type="button" onClick={openEditFromDetails} className={`${ADMIN_BTN_PRIMARY} gap-2`}>
                <Pencil className="h-4 w-4" /> {ADMIN_TEXT.edit}
              </Button>
            )}
          </>
        }
      >
        {isLoadingDetails ? (
          <InlineLoading />
        ) : detailsError ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <p className="text-sm font-semibold text-slate-700">Không tải được chi tiết phim</p>
            <p className="text-xs text-slate-500">{detailsError}</p>
            <Button onClick={() => setDetailsReloadKey((key) => key + 1)} className={`${ADMIN_BTN_PRIMARY} mt-2`}>
              Thử lại
            </Button>
          </div>
        ) : movieDetails ? (
          <div className="space-y-6">
            {/* Poster, title and genres */}
            <div className="flex items-start gap-4">
              <div className="rounded border border-gray-200 bg-gray-100 p-1">
                <img
                  src={optimizeCloudinaryUrl(movieDetails.cover_image, 400)}
                  className="h-14 w-10 rounded object-cover"
                  alt=""
                  onError={(e) => {
                    e.currentTarget.src = 'https://placehold.co/80x112?text=No+Image';
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold leading-tight tracking-tight text-gray-900">{movieDetails.title}</h2>
                {/* THỂ LOẠI: Hiển thị rõ ràng dạng Tag - max 4 tags */}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {Array.isArray(movieDetails.genres) && movieDetails.genres.length > 0 ? (
                    <>
                      {movieDetails.genres.slice(0, 4).map((genre: string) => (
                        <span
                          key={genre}
                          className="rounded border border-gray-200 bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600"
                        >
                          {genre}
                        </span>
                      ))}
                      {movieDetails.genres.length > 4 && (
                        <span className="rounded border border-gray-300 bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                          +{movieDetails.genres.length - 4} thể loại khác
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[11px] italic text-gray-500">Chưa có thể loại</span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Row - 4 cards flex */}
            <div className="flex flex-wrap gap-3">
              {[
                {
                  label: 'Đánh giá',
                  val:
                    movieDetails.rating === null || movieDetails.rating === undefined ? '-' : `${movieDetails.rating}/10`,
                  icon: <Star size={12} />,
                  color: 'text-blue-600'
                },
                {
                  label: 'Trạng thái',
                  val: activeStatusLabel(movieDetails.is_active),
                  color: movieDetails.is_active === true ? 'text-emerald-600' : 'text-slate-400'
                },
                {
                  label: 'Thời lượng',
                  val: movieDetails.duration_min ? `${movieDetails.duration_min} phút` : '-',
                  icon: <Clock size={12} />,
                  color: 'text-slate-700'
                },
                {
                  label: 'Ngày phát hành',
                  val: formatVnDate(movieDetails.release_date),
                  icon: <Calendar size={12} />,
                  color: 'text-slate-700'
                }
              ].map((stat) => (
                <div key={stat.label} className="min-w-[120px] flex-1 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="text-slate-400">{stat.icon}</span>
                    <p className="text-[11px] font-black uppercase text-slate-400">{stat.label}</p>
                  </div>
                  <p className={`text-lg font-bold ${stat.color || 'text-slate-700'}`}>{stat.val}</p>
                </div>
              ))}
            </div>

            {/* Single row: Ticket packages | System info */}
            <div className="flex gap-6">
              {/* LEFT: Ticket packages */}
              <div className="flex-1">
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                    <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-tight text-slate-600">
                      <Ticket size={14} className="text-indigo-500" /> Phân loại gói vé áp dụng
                    </h3>
                    {/* Packages are managed on the ticket packages screen */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] text-blue-600 hover:bg-blue-50"
                      onClick={() => navigate('/tickets')}
                    >
                      Cấu hình
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-3 p-4">
                    {Array.isArray(movieDetails.applicable_packages) && movieDetails.applicable_packages.length > 0 ? (
                      movieDetails.applicable_packages.map((pkg: any, index: number) => {
                        const isVip = pkg.code?.toLowerCase().includes('vip') || pkg.name?.toLowerCase().includes('vip');
                        return (
                          <div
                            key={pkg.id || index}
                            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${
                              isVip ? 'border-indigo-100 bg-indigo-50' : 'border-emerald-100 bg-emerald-50'
                            }`}
                          >
                            <div className={`h-2 w-2 rounded-full ${isVip ? 'animate-pulse bg-indigo-500' : 'bg-emerald-500'}`} />
                            <span className={`text-xs font-semibold ${isVip ? 'text-indigo-700' : 'text-emerald-700'}`}>
                              {pkg.name} ({formatVnd(pkg.price)})
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-2 text-xs italic text-slate-400">Chưa có gói vé nào được áp dụng cho phim này</div>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate('/tickets')}
                      className="rounded-lg border border-dashed border-slate-300 px-4 py-2 text-xs text-slate-400 transition-all hover:border-slate-400 hover:bg-slate-50"
                    >
                      + Gán gói mới
                    </button>
                  </div>
                </section>
              </div>

              {/* RIGHT: Metadata - fixed width (duration is already in the stat cards above) */}
              <div className="w-[260px]">
                <div className="h-full space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Thông tin hệ thống</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Ngày phát hành:</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">
                        {formatVnDateTime(movieDetails.release_date)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Calendar size={12} /> Thêm vào lúc:
                      </span>
                      <span className="font-mono text-slate-600">{formatVnDateTime(movieDetails.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Người thêm:</span>
                      <span className="font-medium text-slate-700">{movieDetails.created_by_staff_name || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <History size={12} /> Sửa lần cuối:
                      </span>
                      <span className="font-mono text-slate-600">{formatVnDateTime(movieDetails.updated_at)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Người sửa cuối:</span>
                      <span className="font-medium text-slate-700">{movieDetails.updated_by_staff_name || '-'}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2 text-[11px]">
                      <span className="shrink-0 text-slate-400">Chi nhánh:</span>
                      <BranchIdsBadge
                        branch_ids={movieDetails.branch_ids}
                        branch_id={movieDetails.branch_id}
                        branches={branches || []}
                      />
                    </div>
                    {movieDetails.deleted_at && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Đã xóa lúc:</span>
                        <span className="font-mono text-red-600">{formatVnDateTime(movieDetails.deleted_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Description - full width at bottom */}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
                <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                  <FileText size={14} className="text-blue-500" /> Mô tả hệ thống
                </h3>
              </div>
              <div className="line-clamp-6 min-h-[80px] p-5 text-[13px] leading-relaxed text-slate-600">
                {movieDetails.description || 'Chưa có mô tả nội dung cho phim này.'}
              </div>
            </section>

            {/* Gallery: the extra images of the movie */}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
                <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                  {/* TẠM BỎ QUA NHIỀU ẢNH (20261110): hiện mỗi phim chỉ dùng 1 poster (cover_image). Ảnh chi tiết (detail_images) chưa dùng: website khách không hiển thị và form sửa chưa có chỗ thêm/xóa ảnh này. Khi cần thư viện ảnh phim: thêm upload nhiều ảnh vào form sửa (MovieEditModal), hiển thị ở website khách, rồi bỏ ghi chú này. */}
                  <Image size={14} className="text-blue-500" /> Hình ảnh chi tiết
                </h3>
              </div>
              <div className="flex flex-wrap gap-3 p-4">
                {Array.isArray(movieDetails.detail_images) && movieDetails.detail_images.length > 0 ? (
                  movieDetails.detail_images.map((imageUrl: string, index: number) => (
                    <a key={`${imageUrl}-${index}`} href={imageUrl} target="_blank" rel="noreferrer">
                      <img
                        src={optimizeCloudinaryUrl(imageUrl, 300)}
                        alt={`Hình chi tiết ${index + 1}`}
                        loading="lazy"
                        className="h-20 w-32 rounded-lg border border-slate-200 object-cover"
                      />
                    </a>
                  ))
                ) : (
                  <div className="text-xs italic text-slate-400">Chưa có hình ảnh chi tiết</div>
                )}
              </div>
            </section>
          </div>
        ) : null}
      </AdminDialog>
    </div>
  );
}
