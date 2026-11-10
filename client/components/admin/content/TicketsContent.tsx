import React, { useState } from 'react';
import {
  Clock,
  History,
  Loader2,
  RefreshCw,
  Pencil,
  Trash2,
  Info,
  Ticket as TicketIcon,
  X,
  Plus,
  Eye,
  Gamepad2,
  Film,
  Upload,
  Image,
  Users,
  Sparkles,
  ShieldAlert,
  Copy,
  SortDesc,
  SortAsc
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { BranchMultiSelect } from '@/components/admin/BranchMultiSelect';
import { BranchIdsBadge } from '@/components/admin/BranchIdsBadge';
import { normalizeBranchIdsInput, parseBranchIdsFromApi } from '@/lib/branch-ids';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createTicketApi, updateTicketApi, getAdminBranchOptions, toggleTicketStatusApi, getTicketById } from '@/lib/api';
import { uploadDirectToCloudinary } from '@/lib/api/uploads';
import { getMoviesAdmin } from '@/lib/api/movies';
import { Skeleton } from '@/components/ui/skeleton';
import { useStaffPermissions, useIsSuperAdmin } from '@/hooks/useStaffPermission';
import { useStaffStore } from '@/store/staffStore';
import { useConfirmUnsaved } from '@/hooks/useConfirmUnsaved';
import { EMPTY_VALUE, activeStatusLabel, formatVnDateTime, formatVnd } from '@/lib/format';

// Message under a form field that failed validation
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500 mt-1">{message}</p>;
}

// Empty input -> no value (so "blank" is not saved as 0)
function parse_optional_number(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

interface TicketPackage {
  id: number;
  name: string;
  code?: string;
  description?: string;
  price: number;
  features?: string[];
  combo?: number[];
  type?: string;
  min_group_size?: number;
  max_group_size?: number;
  is_member_only?: boolean;
  is_active?: boolean;
  display_order?: number;
  branch_id?: number;
  branch_ids?: number[] | null;
  branch_name?: string;
  cover_image?: string;
  duration_min?: number;
  vr_genre?: string;
  min_players?: number;
  max_players?: number;
  updated_at?: string;
  created_at?: string;
  created_by_staff_name?: string;
  updated_by_staff_name?: string;
  // Movies of the combo with their titles (only the detail API returns this)
  combo_movies?: Array<{ id: number; title: string }>;
}

interface Props {
  data: TicketPackage[];
  totalPages: number;
  currentPage: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  onCreate: () => void;
  onEdit: (data: TicketPackage) => void;
  onClone?: (data: TicketPackage) => void;
  setTickets: React.Dispatch<React.SetStateAction<TicketPackage[]>>;
  isEditOpen: boolean;
  setIsEditOpen: (open: boolean) => void;
  editData: any;
  setEditData: (data: any) => void;
  onRefresh: () => Promise<void>;
  deleteTicketApi: (id: number) => Promise<any>;
  isLoading?: boolean;
  showActiveOnly: boolean;
  setShowActiveOnly: (v: boolean) => void;
  typeFilter?: 'all' | 'movie' | 'vr';
  setTypeFilter?: (v: 'all' | 'movie' | 'vr') => void;
  branches?: any[];
  selectedBranchId?: number | 'all' | null;
  setSelectedBranchId?: (id: number | 'all' | null) => void;
  onDelete?: (ticket: TicketPackage) => void;
  onViewDetail?: (ticket: TicketPackage) => void;
  isCodeEditable?: boolean;
  setIsCodeEditable?: (editable: boolean) => void;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  setSortKey?: (k: string) => void;
  setSortDir?: (d: 'asc' | 'desc') => void;
}

export default function TicketsContent(props: Props) {
  const navigate = useNavigate();
  const permissions = useStaffPermissions();
  const isSuperAdmin = useIsSuperAdmin();
  const staffBranchIds = useStaffStore((state) => state.branchIds);

  const hasPermission = (module: string, action: string) => {
    if (isSuperAdmin) return true;
    return permissions.some((p) => p.module === module && p.action === action);
  };

  const canModifyTicket = (t: TicketPackage) => {
    if (isSuperAdmin) return true;
    if (t.branch_ids === null || t.branch_ids === undefined) return false;
    if (t.branch_ids.length === 0) return true;
    return t.branch_ids.every((id) => staffBranchIds.includes(id));
  };

  const {
    data,
    totalPages,
    currentPage,
    setPage,
    onCreate,
    onEdit,
    onClone,
    setTickets,
    isEditOpen,
    setIsEditOpen,
    editData,
    setEditData,
    onRefresh,
    deleteTicketApi,
    showActiveOnly,
    setShowActiveOnly,
    typeFilter = 'all',
    setTypeFilter = () => {},
    branches = [],
    selectedBranchId = null,
    setSelectedBranchId = () => {},
    onDelete,
    onViewDetail,
    isCodeEditable = false,
    setIsCodeEditable = () => {},
    sortKey = 'updated_at',
    setSortKey = () => {},
    sortDir = 'desc',
    setSortDir = () => {}
  } = props;
  const { isLoading = false } = props as any;

  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [movies, setMovies] = useState<any[]>([]);
  const [branchOptions, setBranchOptions] = useState<any[]>([]);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketPackage | null>(null);
  const [toggleDialogOpen, setToggleDialogOpen] = useState(false);
  const [ticketToToggle, setTicketToToggle] = useState<{ id: number; currentStatus: boolean } | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [confirmSaveData, setConfirmSaveData] = useState<{ payload: any; changes: string[] } | null>(null);
  // Search box of the combo movie picker and how many movies match it on the server
  const [movieSearch, setMovieSearch] = useState('');
  const [movieTotal, setMovieTotal] = useState(0);
  // Every movie seen so far (search results, combo of the opened package), by id, to show titles of selected movies
  const [knownMovies, setKnownMovies] = useState<Record<number, any>>({});
  // Movies in the combo when the form was opened. They are kept on save even if the movie is hidden since.
  const [originalComboIds, setOriginalComboIds] = useState<number[]>([]);
  const [ticketErrors, setTicketErrors] = useState<Record<string, string>>({});
  const [detailLoadError, setDetailLoadError] = useState(false);

  const clearTicketError = (field: string) => {
    setTicketErrors((previous) => (previous[field] ? { ...previous, [field]: '' } : previous));
  };

  const rememberMovies = (movieList: any[]) => {
    setKnownMovies((previous) => {
      const next = { ...previous };
      movieList.forEach((movie) => {
        next[Number(movie.id)] = { ...next[Number(movie.id)], ...movie };
      });
      return next;
    });
  };

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'updated_at' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  // Column title that sorts the list on the server when clicked
  const renderSortableHead = (label: string, key: string) => (
    <TableHead
      className="text-xs font-semibold text-gray-600 uppercase py-3"
      aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="inline-flex items-center gap-1 uppercase hover:text-slate-900"
        title={`Sắp xếp theo ${label.toLowerCase()}`}
      >
        {label}
        {sortKey === key && (sortDir === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
      </button>
    </TableHead>
  );

  const isDirty = React.useMemo(() => {
    if (!isEditOpen || !editData) return false;
    
    if (!editData.id || editData.id === 0) {
      return !!(editData.name || editData.price || editData.description);
    }
    
    const original = data.find((t) => t.id === editData.id);
    if (!original) return false;
    
    if (editData.name !== original.name) return true;
    if (String(editData.price || '') !== String(original.price || '')) return true;
    if (editData.description !== original.description) return true;
    if (editData.type !== original.type) return true;
    
    return false;
  }, [isEditOpen, editData, data]);

  const { handleOpenChange: handleEditOpenChange, UnsavedAlert: EditAlert } = useConfirmUnsaved({
    isDirty: isDirty,
    isSubmitting: isSaving,
    onConfirmClose: () => {
      setIsEditOpen(false);
      setEditData({});
    }
  });

  // When the form opens: load branches, remember the combo it started with and name its movies
  React.useEffect(() => {
    if (!isEditOpen) {
      setMovieSearch('');
      setTicketErrors({});
      return;
    }
    getAdminBranchOptions({ includeInactive: true }).then((res) => {
      setBranchOptions(res.items);
    });
    const startCombo: number[] = Array.isArray(editData?.combo) ? editData.combo.map(Number) : [];
    setOriginalComboIds(startCombo);
    if (editData?.id && startCombo.length > 0) {
      getTicketById(Number(editData.id))
        .then((res: any) => {
          const detail = res?.item ?? res;
          if (Array.isArray(detail?.combo_movies)) rememberMovies(detail.combo_movies);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditOpen]);

  // Movies for the combo picker: the server searches by title, so a package can pick any movie, not only the first 100
  React.useEffect(() => {
    if (!isEditOpen) return;
    const searchText = movieSearch.trim();
    const timer = setTimeout(
      () => {
        getMoviesAdmin({ status: 'active', pageSize: 100, q: searchText })
          .then((res) => {
            setMovies(res.items);
            setMovieTotal(Number(res.total ?? res.items.length));
            rememberMovies(res.items);
          })
          .catch(() => toast.error('Không tải được danh sách phim'));
      },
      searchText ? 300 : 0
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditOpen, movieSearch]);

  // A movie can join the combo when the package is global, the movie is global, or they share a branch
  const isMovieEligible = (movie: any) => {
    const packageBranchesRaw =
      editData?.branch_ids !== undefined ? editData.branch_ids : editData?.branch_id ? [editData.branch_id] : [];
    if (packageBranchesRaw === null) return true;
    const packageBranches = Array.isArray(packageBranchesRaw) ? packageBranchesRaw : [];
    // The movie branch ids can be a stringified JSON from the API
    const movieBranchesRaw = parseBranchIdsFromApi(movie.branch_ids ?? movie.branch_id);
    if (movieBranchesRaw === null) return true;
    const movieBranches = Array.isArray(movieBranchesRaw) ? movieBranchesRaw : [];
    return packageBranches.some((branchId: number) => movieBranches.includes(branchId));
  };

  const filteredMovies = React.useMemo(() => {
    if (!movies) return [];
    return movies.filter((movie) => isMovieEligible(movie));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movies, editData?.branch_ids, editData?.branch_id]);

  // Movies of the combo that stay on save: the ones it started with, plus new ones the branch rule allows
  const keepComboIds = (combo: any[]): number[] =>
    (combo || [])
      .map(Number)
      .filter((movieId) => originalComboIds.includes(movieId) || (knownMovies[movieId] && isMovieEligible(knownMovies[movieId])));

  // Selected movies that the current search does not show, so they can still be seen and removed
  const selectedOutsideResults = keepComboIds(editData?.combo || []).filter(
    (movieId) => !filteredMovies.some((movie) => Number(movie.id) === movieId)
  );

  // Check the form and show each problem under its field. Returns true when the form can be saved.
  const validateTicketForm = () => {
    const errors: Record<string, string> = {};
    const isVr = editData?.type === 'vr';
    if (!editData?.name?.trim()) errors.name = 'Vui lòng nhập tên gói';
    if (editData?.price === undefined || editData?.price === null || editData?.price === '') {
      errors.price = 'Vui lòng nhập giá';
    } else if (Number.isNaN(Number(editData.price)) || Number(editData.price) < 0) {
      errors.price = 'Giá không được nhỏ hơn 0';
    }
    const displayOrder = parse_optional_number(editData?.display_order);
    if (displayOrder !== undefined && (displayOrder < 0 || !Number.isInteger(displayOrder))) {
      errors.display_order = 'Thứ tự phải là số nguyên từ 0 trở lên';
    }
    const branchIds = normalizeBranchIdsInput(editData?.branch_ids, editData?.branch_id);
    if (Array.isArray(branchIds) && branchIds.length === 0) {
      errors.branch_ids = 'Vui lòng chọn ít nhất một chi nhánh hoặc "Tất cả chi nhánh"';
    }
    if (isVr) {
      const duration = parse_optional_number(editData?.duration_min);
      if (duration !== undefined && duration <= 0) errors.duration_min = 'Thời lượng phải lớn hơn 0 phút';
      const minPlayers = parse_optional_number(editData?.min_players);
      const maxPlayers = parse_optional_number(editData?.max_players);
      if (minPlayers !== undefined && minPlayers < 1) errors.min_players = 'Tối thiểu 1 người chơi';
      if (maxPlayers !== undefined && maxPlayers < 1) errors.max_players = 'Tối thiểu 1 người chơi';
      if (minPlayers !== undefined && maxPlayers !== undefined && minPlayers > maxPlayers) {
        errors.max_players = 'Số người tối đa phải lớn hơn hoặc bằng số người tối thiểu';
      }
    } else {
      const minGroup = parse_optional_number(editData?.min_group_size);
      const maxGroup = parse_optional_number(editData?.max_group_size);
      if (minGroup !== undefined && minGroup < 1) errors.min_group_size = 'Tối thiểu 1 người';
      if (maxGroup !== undefined && maxGroup < 1) errors.max_group_size = 'Tối thiểu 1 người';
      if (minGroup !== undefined && maxGroup !== undefined && minGroup > maxGroup) {
        errors.max_group_size = 'Nhóm tối đa phải lớn hơn hoặc bằng nhóm tối thiểu';
      }
    }
    setTicketErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ✅ FIX: Chỉ đóng popup AFTER API call thành công
  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      setIsTogglingStatus(true);
      await toggleTicketStatusApi(id);
      toast.success(currentStatus ? 'Đã ẩn gói vé' : 'Đã kích hoạt gói vé');
      setToggleDialogOpen(false);
      // Refresh danh sách
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi thay đổi trạng thái');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Quản lý gói vé & trải nghiệm VR</h1>
          <p className="text-sm text-slate-400 mt-0.5">Tổng cộng {data.length} gói dịch vụ trong hệ thống</p>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Type Filter Pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setTypeFilter('all');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                typeFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => {
                setTypeFilter('movie');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                typeFilter === 'movie' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Film className="w-3.5 h-3.5" /> Vé Phim
            </button>
            <button
              type="button"
              onClick={() => {
                setTypeFilter('vr');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                typeFilter === 'vr' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" /> Gói VR
            </button>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 h-10">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Chỉ hiện khả dụng</span>
            <Switch
              checked={showActiveOnly}
              onCheckedChange={setShowActiveOnly}
              className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300 cursor-pointer"
            />
          </div>

        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={sortKey}
            onChange={(e) => setSortKey?.(e.target.value)}
            aria-label="Sắp xếp theo"
            className="bg-white border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer h-10"
          >
            <option value="updated_at">Mới cập nhật</option>
            <option value="name">Tên gói</option>
            <option value="price">Giá</option>
            <option value="type">Phân loại</option>
            <option value="display_order">Thứ tự hiển thị</option>
          </select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortDir?.(sortDir === 'asc' ? 'desc' : 'asc')}
            className="rounded-xl border-slate-200 hover:bg-slate-50 active:scale-95 transition-all shadow-sm h-10 w-10 shrink-0"
            title={sortDir === 'asc' ? 'Tăng dần' : 'Giảm dần'}
            aria-label={sortDir === 'asc' ? 'Đang tăng dần, bấm để giảm dần' : 'Đang giảm dần, bấm để tăng dần'}
          >
            {sortDir === 'desc' ? (
              <SortDesc className="w-4 h-4 text-slate-600" />
            ) : (
              <SortAsc className="w-4 h-4 text-slate-600" />
            )}
          </Button>

          {branches.length > 0 ? (
            <select
              value={selectedBranchId || 'all'}
              onChange={(e) => setSelectedBranchId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              aria-label="Lọc theo chi nhánh"
              className="bg-white border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer h-10"
            >
              {isSuperAdmin && <option value="all">Tất cả chi nhánh</option>}
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-2 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>Đang tải chi nhánh...</span>
            </div>
          )}
          {hasPermission('tickets', 'view_deleted') && (
            <Button
              variant="outline"
              onClick={() => navigate('/deleted/tickets')}
              className="rounded-xl flex items-center gap-2 h-10 px-4 shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Xem đã xóa</span>
            </Button>
          )}
          {hasPermission('tickets', 'create') && (
            <Button
              onClick={onCreate}
              className="bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm gap-2 text-white h-10 px-5 font-medium"
            >
              <Plus className="w-4 h-4" /> Thêm mới
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0 h-10 w-10"
            title="Làm mới"
            aria-label="Làm mới danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      <Card className="border border-gray-200 rounded-xl shadow-sm bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow className="hover:bg-transparent border-none">
                {renderSortableHead('Tên gói / Dịch vụ', 'name')}
                {renderSortableHead('Phân loại', 'type')}
                {renderSortableHead('Giá niêm yết', 'price')}
                {renderSortableHead('Thứ tự', 'display_order')}
                {renderSortableHead('Cập nhật', 'updated_at')}
                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3 min-w-[120px]">
                  Chi nhánh
                </TableHead>
                <TableHead className="text-center text-xs font-semibold text-gray-600 uppercase py-3">
                  Trạng thái
                </TableHead>
                <TableHead className="text-right text-xs font-semibold text-gray-600 uppercase py-3 pr-6">
                  Thao tác
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={`sk-${idx}`}>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-8" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-8 w-24 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                : data.length === 0
                  ? [
                      <TableRow key="empty">
                        <TableCell colSpan={8} className="h-32 text-center text-sm text-slate-400">
                          Không có gói vé nào phù hợp
                        </TableCell>
                      </TableRow>
                    ]
                  : data.map((t) => {
                    const isVR = t.type === 'vr';
                    return (
                      <TableRow
                        key={t.id}
                        className="group hover:bg-gray-50 transition-colors border-b border-gray-200 h-[52px]"
                      >
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            {isVR ? (
                              t.cover_image ? (
                                <img
                                  src={t.cover_image}
                                  alt={t.name}
                                  className="w-10 h-10 rounded-lg object-cover border border-purple-200 shrink-0 shadow-xs"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0 shadow-xs">
                                  <Gamepad2 className="w-5 h-5" />
                                </div>
                              )
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0 shadow-xs">
                                <Film className="w-5 h-5" />
                              </div>
                            )}
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-slate-900 max-w-[260px] truncate" title={t.name}>
                                {t.name}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-400 font-mono">Mã: {t.code || '—'}</span>
                                {isVR && t.vr_genre && (
                                  <span className="text-[11px] text-purple-600 bg-purple-50 px-1.5 py-0.2 rounded font-medium">
                                    {t.vr_genre}
                                  </span>
                                )}
                                {t.is_member_only && (
                                  <span className="text-[11px] text-amber-700 bg-amber-50 px-1.5 rounded font-medium">
                                    Thành viên
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isVR ? (
                            <Badge
                              variant="outline"
                              className="text-[11px] font-bold border-purple-200 text-purple-700 bg-purple-50 flex items-center gap-1 w-fit"
                            >
                              <Gamepad2 className="w-3 h-3 text-purple-600" />
                              Gói VR {t.duration_min ? `• ${t.duration_min}p` : ''}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[11px] font-bold border-blue-200 text-blue-700 bg-blue-50 flex items-center gap-1 w-fit"
                            >
                              <Film className="w-3 h-3 text-blue-600" />
                              Vé Phim {t.combo && t.combo.length > 0 ? `• ${t.combo.length} phim` : ''}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-black text-slate-700">{formatVnd(t.price)}</TableCell>
                        <TableCell className="text-xs text-slate-600">{t.display_order ?? EMPTY_VALUE}</TableCell>
                        <TableCell>
                          <div className="flex flex-col text-[11px]">
                            <span className="text-slate-600 font-bold flex items-center gap-1">
                              <History size={10} className="text-slate-400" />
                              {formatVnDateTime(t.updated_at)}
                            </span>
                            <span className="text-slate-400 italic cursor-help" title={formatVnDateTime(t.updated_at)}>
                              {t.updated_at
                                ? formatDistanceToNow(new Date(t.updated_at), { addSuffix: true, locale: vi })
                                : ''}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <BranchIdsBadge branch_ids={t.branch_ids} branch_id={t.branch_id} branches={branches || []} />
                        </TableCell>
                        <TableCell className="text-center">
                          {hasPermission('tickets', 'toggle_status') && canModifyTicket(t) ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Switch
                                  checked={t.is_active}
                                  aria-label={`Đổi trạng thái gói ${t.name}`}
                                  className="scale-100 transition-all border-2 border-transparent cursor-pointer"
                                  style={{
                                    opacity: 1,
                                    backgroundColor: t.is_active ? '#10b981' : '#d1d5db',
                                    boxShadow: 'none'
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setTicketToToggle({ id: t.id, currentStatus: t.is_active });
                                    setToggleDialogOpen(true);
                                  }}
                                />
                              </AlertDialogTrigger>
                            </AlertDialog>
                          ) : (
                            <Switch
                              checked={t.is_active}
                              disabled
                              aria-label={`Trạng thái gói ${t.name}: ${activeStatusLabel(t.is_active)}`}
                              className="scale-100 opacity-40 cursor-not-allowed"
                              style={{ backgroundColor: t.is_active ? '#10b981' : '#d1d5db' }}
                              title={!canModifyTicket(t) ? "Không có quyền sửa (Khác chi nhánh / Dùng chung)" : ""}
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6 space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg hover:bg-blue-50 text-blue-600 border-blue-200"
                            onClick={() => {
                              setSelectedTicket(t);
                              setIsDetailDialogOpen(true);
                              setDetailLoadError(false);
                              // The list does not carry who created/changed the package or the combo titles, so load them.
                              // The API returns the package itself (older code expected it inside "item").
                              getTicketById(t.id)
                                .then((res: any) => {
                                  const detail = res?.item ?? res;
                                  if (!detail) return;
                                  setSelectedTicket((current) =>
                                    current && current.id === t.id
                                      ? {
                                          ...current,
                                          created_at: detail.created_at ?? current.created_at,
                                          combo_movies: Array.isArray(detail.combo_movies) ? detail.combo_movies : [],
                                          created_by_staff_name: detail.created_by_staff_name ?? undefined,
                                          updated_by_staff_name: detail.updated_by_staff_name ?? undefined
                                        }
                                      : current
                                  );
                                })
                                .catch(() => setDetailLoadError(true));
                            }}
                            title="Xem chi tiết"
                            aria-label={`Xem chi tiết gói ${t.name}`}
                          >
                            <Eye className="h-4.5 w-4.5" />
                          </Button>
                          {onClone && hasPermission('tickets', 'create') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg hover:bg-emerald-50 text-emerald-600 border-emerald-200"
                              onClick={() => {
                                const packageToClone = {...t};
                                // Generate a clone without ID
                                onClone(packageToClone);
                              }}
                              title="Nhân bản"
                              aria-label={`Nhân bản gói ${t.name}`}
                            >
                              <Copy className="h-4.5 w-4.5" />
                            </Button>
                          )}
                          {hasPermission('tickets', 'edit') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className={`h-8 rounded-lg border-yellow-200 ${canModifyTicket(t) ? 'hover:bg-yellow-50 text-yellow-600' : 'opacity-40 cursor-not-allowed'}`}
                              onClick={() => canModifyTicket(t) && onEdit(t)}
                              title={!canModifyTicket(t) ? "Không có quyền sửa (Khác chi nhánh / Dùng chung)" : "Chỉnh sửa"}
                              aria-label={`Chỉnh sửa gói ${t.name}`}
                            >
                              <Pencil className="h-4.5 w-4.5" />
                            </Button>
                          )}
                          {onDelete && hasPermission('tickets', 'delete') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className={`h-8 rounded-lg border-red-200 ${canModifyTicket(t) ? 'hover:bg-red-50 text-red-600' : 'opacity-40 cursor-not-allowed'}`}
                              onClick={() => canModifyTicket(t) && onDelete(t)}
                              title={!canModifyTicket(t) ? "Không có quyền xóa (Khác chi nhánh / Dùng chung)" : "Xóa"}
                              aria-label={`Xóa gói ${t.name}`}
                            >
                              <Trash2 className="h-4.5 w-4.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
          <Pagination className="mt-3">
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
                    currentPage === 1 ? 'pointer-events-none opacity-30' : 'cursor-pointer rounded-lg border shadow-sm'
                  }
                />
              </PaginationItem>
              <PaginationItem>
                <span className="flex items-center px-3 text-sm text-slate-600">
                  Trang {currentPage} / {totalPages}
                </span>
              </PaginationItem>
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
                      ? 'pointer-events-none opacity-30'
                      : 'cursor-pointer rounded-lg border shadow-sm'
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardContent>
      </Card>
      {/* Create / Edit Dialog */}
      <EditAlert />
      <Dialog open={isEditOpen} onOpenChange={handleEditOpenChange}>
        <DialogContent className="max-w-[950px] max-h-[90vh] flex flex-col p-0 border border-gray-200 shadow-xl rounded-2xl overflow-hidden font-sans bg-white [&>button]:hidden">
          <DialogHeader className="px-6 py-4 bg-white border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl border ${
                    editData?.type === 'vr'
                      ? 'bg-purple-50 border-purple-100 text-purple-600'
                      : 'bg-blue-50 border-blue-100 text-blue-600'
                  }`}
                >
                  {editData?.type === 'vr' ? <Gamepad2 size={22} /> : <TicketIcon size={22} />}
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-gray-900">
                    {editData?.id
                      ? editData?.type === 'vr'
                        ? 'Chỉnh sửa gói trải nghiệm VR'
                        : 'Chỉnh sửa gói vé phim'
                      : editData?.type === 'vr'
                        ? 'Thêm gói trải nghiệm VR mới'
                        : 'Thêm gói vé phim mới'}
                  </DialogTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {editData?.type === 'vr'
                      ? 'Cấu hình gói dịch vụ thực tế ảo VR dành cho khách hàng'
                      : 'Cấu hình combo vé xem phim cho các cụm rạp'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleEditOpenChange(false)}
                aria-label="Đóng"
                title="Đóng"
                className="h-8 w-8 text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* TYPE SELECTOR TABS */}
          <div className="px-6 pt-4 pb-2 bg-slate-50/50 border-b border-slate-100">
            <div className="flex gap-2 p-1 bg-slate-200/70 rounded-xl max-w-md">
              <button
                type="button"
                onClick={() => setEditData({ ...editData, type: 'movie' })}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  editData?.type !== 'vr'
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Film className="w-4 h-4" /> 🎬 Vé xem phim
              </button>
              <button
                type="button"
                onClick={() => setEditData({ ...editData, type: 'vr' })}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  editData?.type === 'vr' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Gamepad2 className="w-4 h-4" /> 🎮 Trải nghiệm VR
              </button>
            </div>
          </div>

          <div className="overflow-y-auto px-6 py-4 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Cột trái: Thông tin cơ bản & Giá */}
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <h3 className="text-xs font-bold text-gray-700 border-b pb-2 flex items-center gap-2">
                    <Info size={14} className={editData?.type === 'vr' ? 'text-purple-500' : 'text-blue-500'} />
                    Thông tin cơ bản
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                        Tên gói <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        placeholder={editData?.type === 'vr' ? 'Vd: VR Escape Room Phiêu lưu' : 'Vd: Vé đôi VIP'}
                        value={editData?.name || ''}
                        onChange={(e) => {
                          setEditData({ ...editData, name: e.target.value });
                          clearTicketError('name');
                        }}
                        className={`h-9.5 text-sm ${ticketErrors.name ? 'border-red-500' : ''}`}
                      />
                      <FieldError message={ticketErrors.name} />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Mã gói</Label>
                      <div className="flex gap-1.5">
                        <Input
                          placeholder="Vd: VR01"
                          value={editData?.code || ''}
                          onChange={(e) => setEditData({ ...editData, code: e.target.value })}
                          disabled={!isCodeEditable}
                          className={`h-9.5 text-sm flex-1 ${!isCodeEditable ? 'bg-gray-100 text-gray-600' : ''}`}
                        />
                        {editData?.id === 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setIsCodeEditable && setIsCodeEditable(!isCodeEditable)}
                            className="h-9.5 w-9.5 shrink-0"
                            title={isCodeEditable ? 'Khóa mã' : 'Sửa mã'}
                            aria-label={isCodeEditable ? 'Khóa mã gói' : 'Sửa mã gói'}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                      Giá niêm yết (VNĐ) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      placeholder="150.000"
                      value={
                        editData?.price !== undefined && editData?.price !== null
                          ? Number(editData.price).toLocaleString('vi-VN')
                          : ''
                      }
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^\d]/g, '');
                        // Empty box stays empty so the required check can catch it
                        setEditData({ ...editData, price: digits === '' ? undefined : Number(digits) });
                        clearTicketError('price');
                      }}
                      className={`h-9.5 text-sm font-semibold text-slate-800 ${ticketErrors.price ? 'border-red-500' : ''}`}
                    />
                    <FieldError message={ticketErrors.price} />
                  </div>

                  {editData?.type === 'vr' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Thời lượng (phút)</Label>
                        <Input
                          type="number"
                          placeholder="Vd: 30"
                          value={editData?.duration_min ?? ''}
                          onChange={(e) => {
                            setEditData({
                              ...editData,
                              duration_min: e.target.value ? Number(e.target.value) : undefined
                            });
                            clearTicketError('duration_min');
                          }}
                          className={`h-9.5 text-sm ${ticketErrors.duration_min ? 'border-red-500' : ''}`}
                        />
                        <FieldError message={ticketErrors.duration_min} />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Thể loại VR</Label>
                        <Input
                          placeholder="Vd: Phiêu lưu, Kinh dị"
                          value={editData?.vr_genre || ''}
                          onChange={(e) => setEditData({ ...editData, vr_genre: e.target.value })}
                          className="h-9.5 text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Nhóm tối thiểu (người)</Label>
                        <Input
                          type="number"
                          min={1}
                          placeholder="Vd: 2"
                          value={editData?.min_group_size ?? ''}
                          onChange={(e) => {
                            setEditData({ ...editData, min_group_size: parse_optional_number(e.target.value) });
                            clearTicketError('min_group_size');
                          }}
                          className={`h-9.5 text-sm ${ticketErrors.min_group_size ? 'border-red-500' : ''}`}
                        />
                        <FieldError message={ticketErrors.min_group_size} />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Nhóm tối đa (người)</Label>
                        <Input
                          type="number"
                          min={1}
                          placeholder="Vd: 6"
                          value={editData?.max_group_size ?? ''}
                          onChange={(e) => {
                            setEditData({ ...editData, max_group_size: parse_optional_number(e.target.value) });
                            clearTicketError('max_group_size');
                          }}
                          className={`h-9.5 text-sm ${ticketErrors.max_group_size ? 'border-red-500' : ''}`}
                        />
                        <FieldError message={ticketErrors.max_group_size} />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Mô tả tóm tắt</Label>
                    <textarea
                      placeholder={
                        editData?.type === 'vr'
                          ? 'Mô tả không gian và kịch bản trải nghiệm VR...'
                          : 'Vé dành cho khách xem phim...'
                      }
                      value={editData?.description || ''}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      className="w-full h-20 border border-gray-300 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                      Tính năng nổi bật (ngăn cách bằng dấu phẩy)
                    </Label>
                    <Input
                      placeholder={
                        editData?.type === 'vr'
                          ? 'Kính Meta Quest 3, Không gian 20m2, Tay cầm haptic'
                          : 'Ghế VIP, Nước uống miễn phí'
                      }
                      value={
                        Array.isArray(editData?.features) ? editData.features.join(', ') : editData?.features || ''
                      }
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          features: e.target.value
                        })
                      }
                      className="h-9.5 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Cột phải: Media / Combo & Cấu hình rạp */}
              <div className="space-y-4">
                {editData?.type === 'vr' ? (
                  /* VR MEDIA & PLAYERS */
                  <div className="bg-white p-4 rounded-2xl border border-purple-100 bg-purple-50/20 shadow-xs space-y-4">
                    <h3 className="text-xs font-bold text-purple-800 border-b border-purple-100 pb-2 flex items-center gap-2">
                      <Gamepad2 size={15} className="text-purple-600" />
                      Hình ảnh & người chơi VR
                    </h3>

                    {/* Cover Image Upload & URL */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-gray-700 block">Ảnh bìa trải nghiệm VR</Label>
                      <div className="flex gap-2 items-center">
                        <Input
                          placeholder="URL ảnh hoặc tải lên..."
                          value={editData?.cover_image || ''}
                          onChange={(e) => setEditData({ ...editData, cover_image: e.target.value })}
                          className="h-9.5 text-xs flex-1 bg-white"
                        />
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={isUploadingImage}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                setIsUploadingImage(true);
                                const result = await uploadDirectToCloudinary(file, 'vr_packages');
                                setEditData({ ...editData, cover_image: result.url });
                                toast.success('Đã tải ảnh lên thành công');
                              } catch (err: any) {
                                toast.error(err.message || 'Tải ảnh thất bại');
                              } finally {
                                setIsUploadingImage(false);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isUploadingImage}
                            className="h-9.5 px-3 border-purple-200 text-purple-700 hover:bg-purple-50 flex items-center gap-1.5"
                            asChild
                          >
                            <span>
                              {isUploadingImage ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Upload className="w-3.5 h-3.5" />
                              )}
                              Upload
                            </span>
                          </Button>
                        </label>
                      </div>

                      {/* Image Preview */}
                      {editData?.cover_image && (
                        <div className="relative w-full h-32 rounded-xl overflow-hidden border border-purple-200 bg-slate-100 group mt-2">
                          <img
                            src={editData.cover_image}
                            alt="Xem trước ảnh bìa VR"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setEditData({ ...editData, cover_image: '' })}
                            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                            title="Xóa ảnh"
                            aria-label="Xóa ảnh bìa"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Player Count */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Người chơi tối thiểu</Label>
                        <Input
                          type="number"
                          placeholder="1"
                          value={editData?.min_players ?? ''}
                          onChange={(e) => {
                            setEditData({ ...editData, min_players: parse_optional_number(e.target.value) });
                            clearTicketError('min_players');
                          }}
                          className={`h-9.5 text-sm bg-white ${ticketErrors.min_players ? 'border-red-500' : ''}`}
                        />
                        <FieldError message={ticketErrors.min_players} />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Người chơi tối đa</Label>
                        <Input
                          type="number"
                          placeholder="4"
                          value={editData?.max_players ?? ''}
                          onChange={(e) => {
                            setEditData({ ...editData, max_players: parse_optional_number(e.target.value) });
                            clearTicketError('max_players');
                          }}
                          className={`h-9.5 text-sm bg-white ${ticketErrors.max_players ? 'border-red-500' : ''}`}
                        />
                        <FieldError message={ticketErrors.max_players} />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* MOVIE COMBO SELECT */
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="border-b pb-2 flex items-center justify-between">
                      <h3 className="text-xs font-bold text-gray-700 flex items-center gap-2">
                        <Film size={14} className="text-blue-500" />
                        Combo Phim (đã chọn {keepComboIds(editData?.combo || []).length})
                      </h3>
                      {filteredMovies.length > 0 && (
                        <div className="flex items-center gap-1.5 hover:bg-slate-50 px-2 py-1 rounded cursor-pointer transition-colors">
                          <Checkbox
                            id="check-all-movies"
                            checked={filteredMovies.length > 0 && filteredMovies.every(m => (editData.combo || []).includes(m.id))}
                            onCheckedChange={(checked) => {
                              const existingCombo = editData.combo || [];
                              const visibleMovieIds = filteredMovies.map(m => m.id);
                              if (checked) {
                                const toAdd = visibleMovieIds.filter(id => !existingCombo.includes(id));
                                setEditData({ ...editData, combo: [...existingCombo, ...toAdd] });
                              } else {
                                setEditData({ ...editData, combo: existingCombo.filter((id: number) => !visibleMovieIds.includes(id)) });
                              }
                            }}
                          />
                          <label
                            htmlFor="check-all-movies"
                            className="text-[11px] font-bold uppercase text-slate-500 cursor-pointer"
                          >
                            Chọn tất cả kết quả
                          </label>
                        </div>
                      )}
                    </div>
                    <Input
                      placeholder="Tìm phim theo tên..."
                      value={movieSearch}
                      onChange={(e) => setMovieSearch(e.target.value)}
                      aria-label="Tìm phim cho combo"
                      className="h-9 text-xs"
                    />
                    <div className="border border-gray-200 rounded-xl p-2.5 h-44 overflow-y-auto space-y-1.5 bg-gray-50/50">
                      {selectedOutsideResults.map((movieId) => (
                        <div
                          key={`selected-${movieId}`}
                          className="flex items-center space-x-2.5 bg-blue-50/60 p-1.5 rounded-lg border border-blue-100"
                        >
                          <Checkbox
                            id={`movie-${movieId}`}
                            checked
                            onCheckedChange={() =>
                              setEditData({
                                ...editData,
                                combo: (editData.combo || []).filter((id: number) => Number(id) !== movieId)
                              })
                            }
                          />
                          <label
                            htmlFor={`movie-${movieId}`}
                            className="text-xs font-medium leading-none cursor-pointer flex-1 text-slate-700 truncate"
                            title={knownMovies[movieId]?.title}
                          >
                            {knownMovies[movieId]?.title || `Phim #${movieId}`}
                            <span className="ml-1 text-[11px] text-slate-400">(đã chọn, ngoài kết quả tìm)</span>
                          </label>
                        </div>
                      ))}
                      {filteredMovies.length === 0 && selectedOutsideResults.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-6">
                          {movieSearch.trim()
                            ? 'Không tìm thấy phim nào'
                            : 'Không có phim nào khả dụng cho chi nhánh này'}
                        </p>
                      ) : (
                        filteredMovies.map((movie) => (
                          <div
                            key={movie.id}
                            className="flex items-center space-x-2.5 hover:bg-white p-1.5 rounded-lg border border-transparent hover:border-slate-200 transition-colors"
                          >
                            <Checkbox
                              id={`movie-${movie.id}`}
                              checked={(editData.combo || []).includes(movie.id)}
                              onCheckedChange={(checked) => {
                                const current = editData.combo || [];
                                if (checked) {
                                  setEditData({
                                    ...editData,
                                    combo: [...current, movie.id]
                                  });
                                } else {
                                  setEditData({
                                    ...editData,
                                    combo: current.filter((id: number) => id !== movie.id)
                                  });
                                }
                              }}
                            />
                            <label
                              htmlFor={`movie-${movie.id}`}
                              className="text-xs font-medium leading-none cursor-pointer flex-1 text-slate-700 truncate"
                              title={movie.title}
                            >
                              {movie.title}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                    {movieTotal > movies.length && (
                      <p className="text-[11px] text-slate-400">
                        Đang hiện {movies.length}/{movieTotal} phim. Gõ tên phim để tìm thêm.
                      </p>
                    )}
                  </div>
                )}

                {/* CHI NHÁNH & HIỂN THỊ */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold text-gray-700 border-b pb-2 flex items-center gap-2">
                    <Info size={14} className="text-blue-500" /> Chi nhánh & cài đặt hiển thị
                  </h3>
                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                      Chi nhánh áp dụng <span className="text-red-500">*</span>
                    </Label>
                    <BranchMultiSelect
                      branches={branchOptions}
                      value={normalizeBranchIdsInput(editData?.branch_ids, editData?.branch_id)}
                      onChange={(branch_ids) => {
                        setEditData({
                          ...editData,
                          branch_ids,
                          branch_id: branch_ids && branch_ids.length === 1 ? branch_ids[0] : undefined
                        });
                        clearTicketError('branch_ids');
                      }}
                    />
                    <FieldError message={ticketErrors.branch_ids} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Thứ tự hiển thị</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={editData?.display_order ?? 0}
                        onChange={(e) => {
                          setEditData({
                            ...editData,
                            display_order: Number(e.target.value || 0)
                          });
                          clearTicketError('display_order');
                        }}
                        className={`h-9.5 text-sm ${ticketErrors.display_order ? 'border-red-500' : ''}`}
                      />
                      <FieldError message={ticketErrors.display_order} />
                    </div>
                    <div className="flex items-center justify-between pt-5">
                      <Label
                        className="text-xs font-semibold text-gray-700 cursor-pointer"
                        htmlFor="is_member_only_switch"
                      >
                        Chỉ cho thành viên
                      </Label>
                      <Switch
                        id="is_member_only_switch"
                        checked={!!editData?.is_member_only}
                        onCheckedChange={(v) => setEditData({ ...editData, is_member_only: v })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 px-6 py-3.5 border-t bg-gray-50">
            <Button variant="outline" onClick={() => handleEditOpenChange(false)} disabled={isSaving} className="rounded-xl">
              Hủy
            </Button>
            <Button
              disabled={isSaving || isUploadingImage}
              className={`rounded-xl px-5 text-white ${
                editData?.type === 'vr' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
              onClick={async () => {
                if (isUploadingImage) return;
                if (!validateTicketForm()) {
                  toast.error('Vui lòng kiểm tra các ô báo lỗi');
                  return;
                }
                try {
                  setIsSaving(true);
                  const branch_ids = normalizeBranchIdsInput(editData?.branch_ids, editData?.branch_id);

                  const features =
                    typeof editData.features === 'string'
                      ? editData.features
                          .split(',')
                          .map((s: string) => s.trim())
                          .filter(Boolean)
                      : editData.features || [];

                  // Movies already in the combo stay even when hidden since; new ones must pass the branch rule
                  const validCombo = editData.type === 'vr' ? [] : keepComboIds(editData.combo || []);

                  const payload = {
                    name: editData.name.trim(),
                    code: editData.code?.trim() || undefined,
                    description: editData.description?.trim() || undefined,
                    price: Number(editData.price || 0),
                    features,
                    type: editData.type || 'movie',
                    combo: validCombo,
                    min_group_size: parse_optional_number(editData.min_group_size),
                    max_group_size: parse_optional_number(editData.max_group_size),
                    is_member_only: !!editData.is_member_only,
                    is_active: editData.is_active !== undefined ? !!editData.is_active : true,
                    display_order: editData.display_order ? Number(editData.display_order) : 0,
                    branch_ids,
                    cover_image: editData.cover_image?.trim() || undefined,
                    duration_min: editData.duration_min ? Number(editData.duration_min) : undefined,
                    vr_genre: editData.vr_genre?.trim() || undefined,
                    min_players: parse_optional_number(editData.min_players),
                    max_players: parse_optional_number(editData.max_players)
                  };

                  const executeSaveTicket = async (p: any) => {
                    setIsSaving(true);
                    try {
                      if (!editData?.id) {
                        await createTicketApi(p);
                      } else {
                        await updateTicketApi(Number(editData.id), p);
                      }
                      await onRefresh();
                      toast.success('Thành công', {
                        description: editData?.id ? 'Cập nhật thành công' : 'Thêm gói thành công'
                      });
                      setConfirmSaveData(null);
                      setIsEditOpen(false);
                    } catch (err: any) {
                      toast.error(err.message || 'Lưu thất bại');
                    } finally {
                      setIsSaving(false);
                    }
                  };

                  if (editData?.id) {
                    const originalItem = data.find((t) => t.id === editData.id);
                    if (originalItem) {
                      const changes: string[] = [];
                      if (Number(originalItem.price) !== Number(payload.price)) {
                        changes.push(
                          `Giá niêm yết gói: ${formatVnd(originalItem.price)} → ${formatVnd(payload.price)}`
                        );
                      }
                      if (changes.length > 0) {
                        setConfirmSaveData({ payload, changes });
                        return;
                      }
                    }
                  }

                  await executeSaveTicket(payload);
                } catch (err: any) {
                  toast.error(err.message || 'Lưu thất bại');
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...
                </span>
              ) : isUploadingImage ? (
                'Đang tải ảnh lên...'
              ) : (
                'Lưu gói'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="[&>button]:hidden bg-white max-w-4xl rounded-2xl overflow-hidden p-0 border border-gray-200">
          <DialogHeader className="flex flex-row items-center gap-3 space-y-0 px-6 py-4 border-b bg-white">
            <div
              className={`p-2 rounded-xl border ${
                selectedTicket?.type === 'vr'
                  ? 'bg-purple-50 border-purple-100 text-purple-600'
                  : 'bg-blue-50 border-blue-100 text-blue-600'
              }`}
            >
              {selectedTicket?.type === 'vr' ? <Gamepad2 size={20} /> : <TicketIcon size={20} />}
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-800">
                {selectedTicket?.type === 'vr' ? 'Chi tiết gói trải nghiệm VR' : 'Chi tiết gói vé phim'}
              </DialogTitle>
              <p className="text-xs text-slate-400">Mã: {selectedTicket?.code || EMPTY_VALUE}</p>
            </div>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDetailDialogOpen(false)}
              title="Đóng"
              aria-label="Đóng"
              className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </Button>
          </DialogHeader>

          {selectedTicket && (
            <div className="p-6 overflow-y-auto max-h-[75vh] space-y-4">
              {detailLoadError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  Không tải được người tạo, người sửa và danh sách phim của gói. Đóng và mở lại để thử lại.
                </div>
              )}
              {/* Cover image (VR hero card; movie packages show the cover when one was set) */}
              {selectedTicket.cover_image && (
                <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-purple-200 shadow-xs group">
                  <img
                    src={selectedTicket.cover_image}
                    alt={selectedTicket.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-5">
                    <div className="text-white">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-purple-600 text-white border-none font-bold text-xs">
                          {selectedTicket.type === 'vr' ? '🎮 TRẢI NGHIỆM VR' : '🎬 VÉ PHIM'}
                        </Badge>
                        {selectedTicket.vr_genre && (
                          <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-xs">
                            {selectedTicket.vr_genre}
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl font-black">{selectedTicket.name}</h2>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Basic Info */}
                <Card className="border border-gray-200 rounded-2xl shadow-xs bg-white">
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-blue-500" />
                      Thông tin cơ bản
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold uppercase text-gray-400 block">Tên gói</Label>
                        <div className="text-sm font-bold text-slate-800 truncate" title={selectedTicket.name}>
                          {selectedTicket.name}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold uppercase text-gray-400 block">Mã gói</Label>
                        <div className="text-xs font-mono bg-slate-100 px-2 py-1 rounded w-fit">
                          {selectedTicket.code || '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold uppercase text-gray-400 block">Phân loại</Label>
                        <div>
                          {selectedTicket.type === 'vr' ? (
                            <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">Gói VR</Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Vé Phim</Badge>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold uppercase text-gray-400 block">Trạng thái</Label>
                        <div>
                          <Badge
                            className={
                              selectedTicket.is_active
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200 text-xs'
                                : 'bg-gray-100 text-gray-500 border-gray-200 text-xs'
                            }
                          >
                            {activeStatusLabel(selectedTicket.is_active)}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold uppercase text-gray-400 block">Thứ tự hiển thị</Label>
                        <div className="text-xs">{selectedTicket.display_order ?? EMPTY_VALUE}</div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold uppercase text-gray-400 block">Đối tượng</Label>
                        <div>
                          <Badge
                            className={
                              selectedTicket.is_member_only
                                ? 'bg-amber-100 text-amber-700 border-amber-200 text-xs'
                                : 'bg-slate-100 text-slate-600 border-slate-200 text-xs'
                            }
                          >
                            {selectedTicket.is_member_only ? 'Chỉ thành viên' : 'Mọi khách hàng'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Pricing & Stats */}
                <Card className="border border-gray-200 rounded-2xl shadow-xs bg-white">
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-2">
                      <span className="text-xs">💰</span>
                      Giá & thông số
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold uppercase text-gray-400 block">Giá niêm yết</Label>
                        <div className="text-base font-black text-emerald-600">
                          {formatVnd(selectedTicket.price)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold uppercase text-gray-400 block">Chi nhánh</Label>
                        <div>
                          <BranchIdsBadge
                            branch_ids={selectedTicket.branch_ids}
                            branch_id={selectedTicket.branch_id}
                            branches={branches || []}
                          />
                        </div>
                      </div>
                      {selectedTicket.type === 'vr' ? (
                        <>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-bold uppercase text-gray-400 block">Thời lượng</Label>
                            <div className="text-xs font-bold text-purple-700 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {selectedTicket.duration_min ? `${selectedTicket.duration_min} phút` : EMPTY_VALUE}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-bold uppercase text-gray-400 block">Số người chơi</Label>
                            <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
                              <Users className="w-3 h-3 text-slate-400" />
                              {selectedTicket.min_players || selectedTicket.max_players
                                ? `${selectedTicket.min_players ?? EMPTY_VALUE} - ${selectedTicket.max_players ?? 'Không giới hạn'} người`
                                : EMPTY_VALUE}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-bold uppercase text-gray-400 block">
                              Nhóm tối thiểu
                            </Label>
                            <div className="text-xs">{selectedTicket.min_group_size ?? EMPTY_VALUE}</div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-bold uppercase text-gray-400 block">Nhóm tối đa</Label>
                            <div className="text-xs">{selectedTicket.max_group_size ?? EMPTY_VALUE}</div>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Description */}
                <Card className="border border-gray-200 rounded-2xl shadow-xs bg-white col-span-2">
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-2">
                      <span className="text-xs">📝</span>
                      Mô tả chi tiết
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="text-xs leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 text-slate-700">
                      {selectedTicket.description || EMPTY_VALUE}
                    </div>
                  </CardContent>
                </Card>

                {/* Movies of the combo */}
                {selectedTicket.type !== 'vr' && (
                  <Card className="border border-gray-200 rounded-2xl shadow-xs bg-white col-span-2">
                    <CardHeader className="pb-2 px-4 pt-4">
                      <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-2">
                        <Film className="w-3.5 h-3.5 text-blue-500" />
                        Phim trong combo
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTicket.combo_movies && selectedTicket.combo_movies.length > 0 ? (
                          selectedTicket.combo_movies.map((movie) => (
                            <Badge
                              key={movie.id}
                              variant="outline"
                              className="bg-blue-50 text-blue-700 border-blue-200 text-xs max-w-[260px] truncate"
                              title={movie.title}
                            >
                              {movie.title}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">
                            {selectedTicket.combo && selectedTicket.combo.length > 0
                              ? `${selectedTicket.combo.length} phim (đang tải tên phim)`
                              : EMPTY_VALUE}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Features & Audit */}
                <Card className="border border-gray-200 rounded-2xl shadow-xs bg-white col-span-2">
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Tính năng & thông tin tạo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTicket.features && selectedTicket.features.length > 0 ? (
                        selectedTicket.features.map((feature, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="bg-slate-50 text-slate-700 border-slate-200 text-xs"
                          >
                            ✓ {feature}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">Không có tính năng đặc biệt</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      <div>
                        Ngày tạo:{' '}
                        <span className="font-semibold text-slate-700">{formatVnDateTime(selectedTicket.created_at)}</span>
                      </div>
                      <div>
                        Tạo bởi:{' '}
                        <span className="font-semibold text-slate-700">
                          {selectedTicket.created_by_staff_name || '-'}
                        </span>
                      </div>
                      <div>
                        Cập nhật:{' '}
                        <span className="font-semibold text-slate-700">{formatVnDateTime(selectedTicket.updated_at)}</span>
                      </div>
                      <div>
                        Người sửa:{' '}
                        <span className="font-semibold text-slate-700">
                          {selectedTicket.updated_by_staff_name || '-'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ✅ Toggle Status Alert Dialog - Fixed */}
      <AlertDialog open={toggleDialogOpen} onOpenChange={setToggleDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900">Xác nhận thay đổi trạng thái</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 text-sm">
              {ticketToToggle?.currentStatus ? (
                <span>
                  Bạn có chắc muốn <strong>ẩn</strong> gói này khỏi danh sách công khai không?
                </span>
              ) : (
                <span>
                  Bạn có chắc muốn <strong>kích hoạt</strong> gói này để khách hàng có thể đặt không?
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="rounded-xl border-slate-200" disabled={isTogglingStatus}>
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isTogglingStatus}
              onClick={(e) => {
                e.preventDefault();
                if (ticketToToggle) {
                  handleToggleStatus(ticketToToggle.id, ticketToToggle.currentStatus);
                }
              }}
              className={`rounded-xl text-white ${
                ticketToToggle?.currentStatus ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isTogglingStatus ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang xử lý...
                </span>
              ) : ticketToToggle?.currentStatus ? (
                'Đồng ý ẩn'
              ) : (
                'Đồng ý kích hoạt'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Confirm Price Edit Alert Dialog */}
      <AlertDialog open={!!confirmSaveData} onOpenChange={(open) => !open && setConfirmSaveData(null)}>
        <AlertDialogContent className="rounded-2xl font-sans bg-white max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Xác nhận thay đổi giá gói vé
            </AlertDialogTitle>
            <AlertDialogDescription asChild className="text-slate-600 text-sm mt-2">
              <div>
                <p className="mb-3">
                  Bạn đang điều chỉnh thông tin giá niêm yết của gói <strong>{editData?.name}</strong>:
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1 text-xs text-amber-900 font-medium mb-3">
                  {confirmSaveData?.changes.map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 italic">
                  Giá mới sẽ có hiệu lực ngay lập tức khi khách hàng xem và chọn mua gói vé này trên giao diện booking.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="rounded-xl border-slate-200">Hủy bỏ</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              onClick={async () => {
                if (confirmSaveData) {
                  setIsSaving(true);
                  try {
                    await updateTicketApi(Number(editData.id), confirmSaveData.payload);
                    await onRefresh();
                    toast.success('Thành công', { description: 'Cập nhật gói thành công' });
                    setConfirmSaveData(null);
                    setIsEditOpen(false);
                  } catch (err: any) {
                    toast.error(err.message || 'Lưu thất bại');
                  } finally {
                    setIsSaving(false);
                  }
                }
              }}
              className="rounded-xl text-white bg-amber-600 hover:bg-amber-700 font-medium"
            >
              {isSaving ? 'Đang lưu...' : 'Xác nhận lưu'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
