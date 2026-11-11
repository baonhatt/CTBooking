import React, { useState } from 'react';
import {
  Banknote,
  Check,
  Clock,
  FileText,
  History,
  Loader2,
  RefreshCw,
  Pencil,
  Trash2,
  Info,
  Ticket as TicketIcon,
  X,
  Plus,
  Gamepad2,
  Film,
  Upload,
  Users,
  Sparkles,
  SortDesc,
  SortAsc
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { BranchMultiSelect } from '@/components/admin/BranchMultiSelect';
import { BranchIdsBadge } from '@/components/admin/BranchIdsBadge';
import { BranchTag, branch_ids_of_item } from '@/components/admin/BranchTag';
import { BranchGroupHeader, group_items_by_branch } from '@/components/admin/BranchGroups';
import { normalizeBranchIdsInput, parseBranchIdsFromApi } from '@/lib/branch-ids';
import { useNavigate } from 'react-router-dom';
import { createTicketApi, updateTicketApi, getAdminBranchOptions, toggleTicketStatusApi, getTicketById } from '@/lib/api';
import { uploadDirectToCloudinary } from '@/lib/api/uploads';
import { getMoviesAdmin } from '@/lib/api/movies';
import { useStaffPermissions, useIsSuperAdmin } from '@/hooks/useStaffPermission';
import { useStaffStore } from '@/store/staffStore';
import { AdminDialog, AdminDialogFooter } from '@/components/admin/common/AdminDialog';
import { ConfirmDialog } from '@/components/admin/common/ConfirmDialog';
import { RowActionButton, RowActions } from '@/components/admin/common/RowActionButton';
import { StatusBadge } from '@/components/admin/common/StatusBadge';
import { PageHeader } from '@/components/admin/common/PageHeader';
import { AdminPagination } from '@/components/admin/common/AdminPagination';
import { EmptyState, TableSkeleton } from '@/components/admin/common/EmptyState';
import { FormField, FormSection } from '@/components/admin/common/FormField';
import { notify } from '@/components/admin/common/notify';
import {
  ADMIN_INPUT,
  ADMIN_BTN_OUTLINE,
  ADMIN_BTN_PRIMARY,
  ADMIN_CARD,
  ADMIN_TABLE_HEAD,
  ADMIN_TEXT,
  ADMIN_TH
} from '@/components/admin/common/adminTokens';
import { EMPTY_VALUE, formatVnDateTime, formatVnd } from '@/lib/format';

// Empty input -> no value (so "blank" is not saved as 0)
function parse_optional_number(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

// Optional number as number or null, so "" / undefined / null all compare equal
function optional_number_or_null(value: unknown): number | null {
  const parsed = parse_optional_number(value);
  return parsed === undefined ? null : parsed;
}

// Id list as a sorted copy (order does not matter); null stays null so "all branches" differs from "none"
function sorted_id_list(ids: unknown): number[] | null {
  if (!Array.isArray(ids)) return null;
  return ids.map((id) => Number(id)).sort((a, b) => a - b);
}

// Every editable field of the ticket form in a fixed shape, so two states can be compared by content
function ticket_form_snapshot(form: any): string {
  const source = form || {};
  const features_text = Array.isArray(source.features) ? source.features.join(', ') : source.features || '';
  return JSON.stringify({
    name: source.name || '',
    code: source.code || '',
    type: source.type || 'movie',
    price: optional_number_or_null(source.price),
    description: source.description || '',
    features: features_text,
    min_group_size: optional_number_or_null(source.min_group_size),
    max_group_size: optional_number_or_null(source.max_group_size),
    duration_min: optional_number_or_null(source.duration_min),
    vr_genre: source.vr_genre || '',
    cover_image: source.cover_image || '',
    min_players: optional_number_or_null(source.min_players),
    max_players: optional_number_or_null(source.max_players),
    combo: sorted_id_list(source.combo) || [],
    branch_ids: sorted_id_list(normalizeBranchIdsInput(source.branch_ids, source.branch_id)),
    display_order: Number(source.display_order ?? 0),
    is_member_only: !!source.is_member_only,
    is_active: source.is_active !== undefined ? !!source.is_active : true
  });
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

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [movies, setMovies] = useState<any[]>([]);
  const [branchOptions, setBranchOptions] = useState<any[]>([]);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  // Asks before the edit form is cancelled while it has unsaved changes
  const [askDiscardEdit, setAskDiscardEdit] = useState(false);
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
  // The form as it was when the dialog opened; null while the dialog is closed
  const [initialFormSnapshot, setInitialFormSnapshot] = useState<string | null>(null);
  // Branch choice for which the combo was last auto-ticked (a new package re-ticks when the branch choice changes)
  const autoTickKeyRef = React.useRef<string | null>(null);

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
      className={`${ADMIN_TH} py-3`}
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

  // Dirty = any editable field differs from the snapshot taken when the form opened (null until then)
  const isDirty = React.useMemo(() => {
    if (!isEditOpen || !editData || initialFormSnapshot === null) return false;
    return ticket_form_snapshot(editData) !== initialFormSnapshot;
  }, [isEditOpen, editData, initialFormSnapshot]);

  // Called by AdminDialog after the unsaved-changes prompt (if any) was accepted
  const close_edit_dialog = () => {
    setAskDiscardEdit(false);
    setIsEditOpen(false);
    setEditData({});
  };

  // The footer "Hủy" button: ask first when the form has unsaved changes
  const request_close_edit = () => {
    if (isDirty) {
      setAskDiscardEdit(true);
      return;
    }
    close_edit_dialog();
  };

  // When the form opens: load branches, remember the combo it started with and name its movies
  React.useEffect(() => {
    autoTickKeyRef.current = null;
    if (!isEditOpen) {
      setMovieSearch('');
      setTicketErrors({});
      setInitialFormSnapshot(null);
      return;
    }
    // The form data is already complete when the dialog opens (the page sets it before opening)
    setInitialFormSnapshot(ticket_form_snapshot(editData));
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
          .catch(() => notify.error('Không tải được danh sách phim'));
      },
      searchText ? 300 : 0
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditOpen, movieSearch]);

  // A movie can join the combo when the package is global, the movie is global, or they share a branch
  const isMovieEligible = (movie: any) => {
    // Same reading as the branch picker and the save: no branch set at all means "all branches" (null), not an empty list
    const packageBranchesRaw = normalizeBranchIdsInput(editData?.branch_ids, editData?.branch_id);
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

  // New package only: tick every movie the branch rule allows, once the movies are loaded and again whenever the
  // branch choice changes. Edit and clone keep the combo they already have.
  const autoTickBranchKey = JSON.stringify(sorted_id_list(normalizeBranchIdsInput(editData?.branch_ids, editData?.branch_id)) ?? 'all');
  React.useEffect(() => {
    if (!isEditOpen || !editData?.auto_select_combo || editData.type === 'vr') return;
    if (initialFormSnapshot === null || movieSearch.trim() || movies.length === 0) return;
    if (autoTickKeyRef.current === autoTickBranchKey) return;
    autoTickKeyRef.current = autoTickBranchKey;
    const form_untouched = ticket_form_snapshot(editData) === initialFormSnapshot;
    const next_form = { ...editData, combo: filteredMovies.map((movie) => Number(movie.id)) };
    setEditData(next_form);
    // Ticking by itself must not make an untouched form look edited (no "unsaved changes" prompt on close)
    if (form_untouched) setInitialFormSnapshot(ticket_form_snapshot(next_form));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditOpen, editData?.auto_select_combo, editData?.type, autoTickBranchKey, movies, movieSearch, initialFormSnapshot]);

  // The branch tag in the movie list only helps when the package spans more than one branch
  const showMovieBranchTag = (() => {
    const packageBranches = normalizeBranchIdsInput(editData?.branch_ids, editData?.branch_id);
    return packageBranches === null || packageBranches.length > 1;
  })();

  // Several branches at once: list the movies branch by branch (a movie shared by several branches keeps a tag)
  const movieGroups = group_items_by_branch(
    filteredMovies,
    (movie: any) => branch_ids_of_item(movie.branch_ids, movie.branch_id),
    branchOptions.length > 0 ? branchOptions : branches
  );
  const toggleMovieGroup = (items: any[]) => {
    const groupIds: number[] = items.map((movie: any) => movie.id);
    const current: number[] = editData.combo || [];
    const wholeGroupTicked = groupIds.every((id) => current.includes(id));
    setEditData({
      ...editData,
      combo: wholeGroupTicked ? current.filter((id) => !groupIds.includes(id)) : [...current, ...groupIds.filter((id) => !current.includes(id))]
    });
  };
  const renderMovieRow = (movie: any, showTag: boolean) => (
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
                            {showTag && (
                              <BranchTag branch_ids={movie.branch_ids} branch_id={movie.branch_id} branches={branchOptions.length > 0 ? branchOptions : branches} />
                            )}
                          </div>
  );

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

  // The popup closes only after the API call succeeded
  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      setIsTogglingStatus(true);
      await toggleTicketStatusApi(id);
      notify.success(currentStatus ? 'Đã ẩn gói vé' : 'Đã kích hoạt gói vé');
      setToggleDialogOpen(false);
      // Reload the list
      await onRefresh();
    } catch (err: any) {
      notify.error(err, 'Lỗi khi thay đổi trạng thái');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Validate, then save (a price change on an existing package asks for confirmation first)
  const handleSubmitTicket = async () => {
    if (isUploadingImage) return;
    if (!validateTicketForm()) {
      notify.error('Vui lòng kiểm tra các ô báo lỗi');
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
          if (editData?.id) notify.saved('gói vé');
                      else notify.created('gói vé');
          setConfirmSaveData(null);
          setIsEditOpen(false);
        } catch (err: any) {
          notify.error(err, 'Lưu thất bại');
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
      notify.error(err, 'Lưu thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  // Open the detail dialog and load what the list does not carry (creator, editor, combo titles)
  const open_detail = (ticket: TicketPackage) => {
    setSelectedTicket(ticket);
    setIsDetailDialogOpen(true);
    setDetailLoadError(false);
    // The API returns the package itself (older code expected it inside "item").
    getTicketById(ticket.id)
      .then((res: any) => {
        const detail = res?.item ?? res;
        if (!detail) return;
        setSelectedTicket((current) =>
          current && current.id === ticket.id
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
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <PageHeader
        title="Quản lý gói vé & trải nghiệm VR"
        description={`Đang hiển thị ${data.length} gói dịch vụ`}
      />

      {/* TOOLBAR */}
      <div className={`${ADMIN_CARD} flex flex-col items-start justify-between gap-4 p-4 xl:flex-row xl:items-center`}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Type Filter Pills */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1">
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
              <Film className="w-3.5 h-3.5" /> Vé phim
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

          <div className="flex h-10 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
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
            className="h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="updated_at">Mới cập nhật</option>
            <option value="name">Tên gói</option>
            <option value="price">Giá</option>
            <option value="type">Phân loại</option>
            <option value="display_order">Thứ tự hiển thị</option>
          </select>

          <Button
            variant="outline"
            onClick={() => setSortDir?.(sortDir === 'asc' ? 'desc' : 'asc')}
            className={`${ADMIN_BTN_OUTLINE} w-10 shrink-0 px-0`}
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
              className="h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
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
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>Đang tải chi nhánh...</span>
            </div>
          )}
          {hasPermission('tickets', 'view_deleted') && (
            <Button
              variant="outline"
              onClick={() => navigate('/deleted/tickets')}
              className={`${ADMIN_BTN_OUTLINE} flex items-center gap-2`}
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Xem đã xóa</span>
            </Button>
          )}
          {hasPermission('tickets', 'create') && (
            <Button onClick={onCreate} className={`${ADMIN_BTN_PRIMARY} gap-2`}>
              <Plus className="w-4 h-4" /> Thêm mới
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onRefresh}
            className={`${ADMIN_BTN_OUTLINE} w-10 shrink-0 px-0`}
            title={ADMIN_TEXT.refresh}
            aria-label="Làm mới danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* TICKET TABLE */}
      <div className={`${ADMIN_CARD} overflow-hidden`}>
        <Table className="[&_td]:px-3 [&_th]:px-3">
          <TableHeader className={ADMIN_TABLE_HEAD}>
            <TableRow className="border-none hover:bg-transparent">
              {renderSortableHead('Tên gói / Dịch vụ', 'name')}
              {renderSortableHead('Phân loại', 'type')}
              {renderSortableHead('Giá niêm yết', 'price')}
              {renderSortableHead('Thứ tự', 'display_order')}
              <TableHead
                className={`${ADMIN_TH} hidden py-3 2xl:table-cell`}
                aria-sort={sortKey === 'updated_at' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <button
                  type="button"
                  onClick={() => toggleSort('updated_at')}
                  className="inline-flex items-center gap-1 uppercase hover:text-slate-900"
                  title="Sắp xếp theo cập nhật"
                >
                  Cập nhật
                  {sortKey === 'updated_at' &&
                    (sortDir === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
              </TableHead>
              <TableHead className={`${ADMIN_TH} min-w-[120px] py-3`}>Chi nhánh</TableHead>
              <TableHead className={`${ADMIN_TH} py-3 text-center`}>Trạng thái</TableHead>
              <TableHead className={`${ADMIN_TH} py-3 pr-4 text-right`}>{ADMIN_TEXT.actionColumn}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="p-0">
                  <TableSkeleton rows={5} />
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="p-0">
                  <EmptyState title="Không tìm thấy gói vé phù hợp" />
                </TableCell>
              </TableRow>
            ) : (
              data.map((t) => {
                const isVR = t.type === 'vr';
                const can_modify = canModifyTicket(t);
                const no_permission_text = 'Không có quyền (khác chi nhánh / dùng chung)';
                return (
                  <TableRow key={t.id} className="group h-[52px] border-b border-slate-200 transition-colors hover:bg-slate-50">
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        {isVR ? (
                          t.cover_image ? (
                            <img
                              src={t.cover_image}
                              alt={t.name}
                              className="h-10 w-10 shrink-0 rounded-lg border border-purple-200 object-cover shadow-sm"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-purple-200 bg-purple-50 text-purple-600 shadow-sm">
                              <Gamepad2 className="h-5 w-5" />
                            </div>
                          )
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
                            <Film className="h-5 w-5" />
                          </div>
                        )}
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="max-w-[200px] truncate font-bold text-slate-900 2xl:max-w-[260px]" title={t.name}>
                            {t.name}
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] text-slate-400">Mã: {t.code || EMPTY_VALUE}</span>
                            {isVR && t.vr_genre && (
                              <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[11px] font-medium text-purple-600">
                                {t.vr_genre}
                              </span>
                            )}
                            {t.is_member_only && (
                              <span className="rounded bg-amber-50 px-1.5 text-[11px] font-medium text-amber-700">
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
                          className="flex w-fit items-center gap-1 whitespace-nowrap border-purple-200 bg-purple-50 text-[11px] font-bold text-purple-700"
                        >
                          <Gamepad2 className="h-3 w-3 text-purple-600" />
                          Gói VR {t.duration_min ? `• ${t.duration_min}p` : ''}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="flex w-fit items-center gap-1 whitespace-nowrap border-blue-200 bg-blue-50 text-[11px] font-bold text-blue-700"
                        >
                          <Film className="h-3 w-3 text-blue-600" />
                          Vé phim {t.combo && t.combo.length > 0 ? `• ${t.combo.length} phim` : ''}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-black text-slate-700">{formatVnd(t.price)}</TableCell>
                    <TableCell className="text-xs text-slate-600">{t.display_order ?? EMPTY_VALUE}</TableCell>
                    <TableCell className="hidden 2xl:table-cell">
                      <div className="flex flex-col text-[11px]">
                        <span className="flex items-center gap-1 font-bold text-slate-600">
                          <History size={10} className="text-slate-400" />
                          {formatVnDateTime(t.updated_at)}
                        </span>
                        <span className="cursor-help italic text-slate-400" title={formatVnDateTime(t.updated_at)}>
                          {t.updated_at ? formatDistanceToNow(new Date(t.updated_at), { addSuffix: true, locale: vi }) : ''}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <BranchIdsBadge branch_ids={t.branch_ids} branch_id={t.branch_id} branches={branches || []} />
                    </TableCell>
                    <TableCell className="text-center">
                      {hasPermission('tickets', 'toggle_status') && can_modify ? (
                        <Switch
                          checked={t.is_active}
                          aria-label={`Đổi trạng thái gói ${t.name}`}
                          className="cursor-pointer border-2 border-transparent opacity-100 shadow-none transition-all data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-gray-300"
                          onClick={(e) => {
                            e.preventDefault();
                            setTicketToToggle({ id: t.id, currentStatus: !!t.is_active });
                            setToggleDialogOpen(true);
                          }}
                        />
                      ) : (
                        <span title={!can_modify ? no_permission_text : undefined}>
                          <StatusBadge status={t.is_active ? 'active' : 'inactive'} />
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="pr-4">
                      <RowActions>
                        <RowActionButton action="view" label={`Xem chi tiết gói ${t.name}`} onClick={() => open_detail(t)} />
                        {onClone && hasPermission('tickets', 'create') && (
                          <RowActionButton action="copy" label={`Nhân bản gói ${t.name}`} onClick={() => onClone({ ...t })} />
                        )}
                        {hasPermission('tickets', 'edit') && (
                          <RowActionButton
                            action="edit"
                            label={can_modify ? `Chỉnh sửa gói ${t.name}` : no_permission_text}
                            disabled={!can_modify}
                            onClick={() => can_modify && onEdit(t)}
                          />
                        )}
                        {onDelete && hasPermission('tickets', 'delete') && (
                          <RowActionButton
                            action="delete"
                            label={can_modify ? `Xóa gói ${t.name}` : no_permission_text}
                            disabled={!can_modify}
                            onClick={() => can_modify && onDelete(t)}
                          />
                        )}
                      </RowActions>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <div className="border-t border-slate-200 px-4">
          <AdminPagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>

      {/* CREATE / EDIT DIALOG */}
      <AdminDialog
        open={isEditOpen}
        onClose={close_edit_dialog}
        mode="form"
        size="xl"
        dirty={isDirty}
        busy={isSaving}
        icon={editData?.type === 'vr' ? <Gamepad2 className="h-5 w-5" /> : <TicketIcon className="h-5 w-5" />}
        title={
          editData?.id
            ? editData?.type === 'vr'
              ? 'Chỉnh sửa gói trải nghiệm VR'
              : 'Chỉnh sửa gói vé phim'
            : editData?.type === 'vr'
              ? 'Thêm gói trải nghiệm VR mới'
              : 'Thêm gói vé phim mới'
        }
        subtitle={
          editData?.type === 'vr'
            ? 'Cấu hình gói dịch vụ thực tế ảo VR dành cho khách hàng'
            : 'Cấu hình combo vé xem phim cho các cụm rạp'
        }
        footer={
          <AdminDialogFooter
            onCancel={request_close_edit}
            onSubmit={handleSubmitTicket}
            submitText={isUploadingImage ? 'Đang tải ảnh lên...' : editData?.id ? ADMIN_TEXT.save : ADMIN_TEXT.create}
            busy={isSaving}
            submitDisabled={isUploadingImage}
          />
        }
      >
        {/* TYPE SELECTOR TABS (create / clone only) - the package type cannot change after creation */}
        {editData?.id ? (
          <div className="mb-4 max-w-md rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              {editData?.type === 'vr' ? (
                <Gamepad2 className="h-4 w-4 text-purple-600" />
              ) : (
                <Film className="h-4 w-4 text-blue-600" />
              )}
              Loại gói: {editData?.type === 'vr' ? 'Trải nghiệm VR' : 'Vé xem phim'}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Không thể đổi loại gói sau khi tạo. Muốn dùng loại khác, hãy tạo gói mới.
            </p>
          </div>
        ) : (
          <div className="mb-4 flex max-w-md gap-2 rounded-xl bg-slate-200/70 p-1">
            <button
              type="button"
              onClick={() => setEditData({ ...editData, type: 'movie' })}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                editData?.type !== 'vr'
                  ? 'bg-white text-blue-700 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Film className="w-4 h-4" /> Vé xem phim
            </button>
            <button
              type="button"
              onClick={() => setEditData({ ...editData, type: 'vr' })}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                editData?.type === 'vr' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Gamepad2 className="w-4 h-4" /> Trải nghiệm VR
            </button>
          </div>
        )}

        <div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Cột trái: Thông tin cơ bản & Giá */}
              <div className="space-y-4">
                <FormSection
                  title="Thông tin cơ bản"
                  icon={<Info size={14} className={editData?.type === 'vr' ? 'text-purple-500' : 'text-blue-500'} />}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Tên gói" htmlFor="fmi_ticket_name" required error={ticketErrors.name}>
                      <Input
                        id="fmi_ticket_name"
                        placeholder={editData?.type === 'vr' ? 'Vd: VR Escape Room Phiêu lưu' : 'Vd: Vé đôi VIP'}
                        value={editData?.name || ''}
                        onChange={(e) => {
                          setEditData({ ...editData, name: e.target.value });
                          clearTicketError('name');
                        }}
                        className={`${ADMIN_INPUT} ${ticketErrors.name ? 'border-red-500' : ''}`}
                      />
                    </FormField>
                    <FormField label="Mã gói" htmlFor="fmi_ticket_code">
                      <div className="flex gap-1.5">
                        <Input
                          id="fmi_ticket_code"
                          placeholder="Vd: VR01"
                          value={editData?.code || ''}
                          onChange={(e) => setEditData({ ...editData, code: e.target.value })}
                          disabled={!isCodeEditable}
                          className={`${ADMIN_INPUT} flex-1 ${!isCodeEditable ? 'bg-gray-100 text-gray-600' : ''}`}
                        />
                        {editData?.id === 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setIsCodeEditable && setIsCodeEditable(!isCodeEditable)}
                            className="h-10 rounded-xl w-10 shrink-0"
                            title={isCodeEditable ? 'Khóa mã' : 'Sửa mã'}
                            aria-label={isCodeEditable ? 'Khóa mã gói' : 'Sửa mã gói'}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </FormField>
                  </div>

                  <FormField label="Giá niêm yết (VNĐ)" htmlFor="fmi_ticket_price" required error={ticketErrors.price}>
                    <Input
                      id="fmi_ticket_price"
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
                      className={`${ADMIN_INPUT} font-semibold text-slate-800 ${ticketErrors.price ? 'border-red-500' : ''}`}
                    />
                  </FormField>

                  {editData?.type === 'vr' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Thời lượng (phút)" htmlFor="fmi_ticket_duration_min" error={ticketErrors.duration_min}>
                        <Input
                          id="fmi_ticket_duration_min"
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
                          className={`${ADMIN_INPUT} ${ticketErrors.duration_min ? 'border-red-500' : ''}`}
                        />
                      </FormField>
                      <FormField label="Thể loại VR" htmlFor="fmi_ticket_vr_genre">
                        <Input
                          id="fmi_ticket_vr_genre"
                          placeholder="Vd: Phiêu lưu, Kinh dị"
                          value={editData?.vr_genre || ''}
                          onChange={(e) => setEditData({ ...editData, vr_genre: e.target.value })}
                          className={ADMIN_INPUT}
                        />
                      </FormField>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Nhóm tối thiểu (người)" htmlFor="fmi_ticket_min_group_size" error={ticketErrors.min_group_size}>
                        <Input
                          id="fmi_ticket_min_group_size"
                          type="number"
                          min={1}
                          placeholder="Vd: 2"
                          value={editData?.min_group_size ?? ''}
                          onChange={(e) => {
                            setEditData({ ...editData, min_group_size: parse_optional_number(e.target.value) });
                            clearTicketError('min_group_size');
                          }}
                          className={`${ADMIN_INPUT} ${ticketErrors.min_group_size ? 'border-red-500' : ''}`}
                        />
                      </FormField>
                      <FormField label="Nhóm tối đa (người)" htmlFor="fmi_ticket_max_group_size" error={ticketErrors.max_group_size}>
                        <Input
                          id="fmi_ticket_max_group_size"
                          type="number"
                          min={1}
                          placeholder="Vd: 6"
                          value={editData?.max_group_size ?? ''}
                          onChange={(e) => {
                            setEditData({ ...editData, max_group_size: parse_optional_number(e.target.value) });
                            clearTicketError('max_group_size');
                          }}
                          className={`${ADMIN_INPUT} ${ticketErrors.max_group_size ? 'border-red-500' : ''}`}
                        />
                      </FormField>
                    </div>
                  )}

                  <FormField label="Mô tả tóm tắt" htmlFor="fmi_ticket_description">
                    <textarea
                      id="fmi_ticket_description"
                      placeholder={
                        editData?.type === 'vr'
                          ? 'Mô tả không gian và kịch bản trải nghiệm VR...'
                          : 'Vé dành cho khách xem phim...'
                      }
                      value={editData?.description || ''}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      className="w-full h-20 border border-gray-300 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white"
                    />
                  </FormField>

                  <FormField label="Tính năng nổi bật (ngăn cách bằng dấu phẩy)" htmlFor="fmi_ticket_features">
                    <Input
                      id="fmi_ticket_features"
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
                      className={ADMIN_INPUT}
                    />
                  </FormField>
                </FormSection>
              </div>

              {/* Cột phải: Media / Combo & Cấu hình rạp */}
              <div className="space-y-4">
                {editData?.type === 'vr' ? (
                  /* VR MEDIA & PLAYERS */
                  <FormSection
                    title="Hình ảnh & người chơi VR"
                    icon={<Gamepad2 size={15} className="text-purple-600" />}
                    className="space-y-4 border-purple-100 bg-purple-50/20"
                  >

                    {/* Cover Image Upload & URL */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-gray-700 block">Ảnh bìa trải nghiệm VR</Label>
                      <div className="flex gap-2 items-center">
                        <Input
                          placeholder="URL ảnh hoặc tải lên..."
                          value={editData?.cover_image || ''}
                          onChange={(e) => setEditData({ ...editData, cover_image: e.target.value })}
                          className="h-10 rounded-xl text-xs flex-1 bg-white"
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
                                notify.success('Đã tải ảnh lên');
                              } catch (err: any) {
                                notify.error(err, 'Tải ảnh thất bại');
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
                            className="h-10 rounded-xl px-3 border-purple-200 text-purple-700 hover:bg-purple-50 flex items-center gap-1.5"
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
                      <FormField label="Người chơi tối thiểu" htmlFor="fmi_ticket_min_players" error={ticketErrors.min_players}>
                        <Input
                          id="fmi_ticket_min_players"
                          type="number"
                          placeholder="1"
                          value={editData?.min_players ?? ''}
                          onChange={(e) => {
                            setEditData({ ...editData, min_players: parse_optional_number(e.target.value) });
                            clearTicketError('min_players');
                          }}
                          className={`${ADMIN_INPUT} bg-white ${ticketErrors.min_players ? 'border-red-500' : ''}`}
                        />
                      </FormField>
                      <FormField label="Người chơi tối đa" htmlFor="fmi_ticket_max_players" error={ticketErrors.max_players}>
                        <Input
                          id="fmi_ticket_max_players"
                          type="number"
                          placeholder="4"
                          value={editData?.max_players ?? ''}
                          onChange={(e) => {
                            setEditData({ ...editData, max_players: parse_optional_number(e.target.value) });
                            clearTicketError('max_players');
                          }}
                          className={`${ADMIN_INPUT} bg-white ${ticketErrors.max_players ? 'border-red-500' : ''}`}
                        />
                      </FormField>
                    </div>
                  </FormSection>
                ) : (
                  /* MOVIE COMBO SELECT */
                  <FormSection
                    title={`Combo phim (đã chọn ${keepComboIds(editData?.combo || []).length})`}
                    icon={<Film size={14} className="text-blue-500" />}
                    className="space-y-4"
                  >
                    <Input
                      placeholder="Tìm phim theo tên..."
                      value={movieSearch}
                      onChange={(e) => setMovieSearch(e.target.value)}
                      aria-label="Tìm phim cho combo"
                      className="h-9 text-xs"
                    />
                    {filteredMovies.length > 0 && (
                      <div className="flex justify-start">
                        <div className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 transition-colors hover:bg-slate-50">
                          <Checkbox
                            id="check-all-movies"
                            checked={filteredMovies.length > 0 && filteredMovies.every((m) => (editData.combo || []).includes(m.id))}
                            onCheckedChange={(checked) => {
                              const existingCombo = editData.combo || [];
                              const visibleMovieIds = filteredMovies.map((m) => m.id);
                              if (checked) {
                                const toAdd = visibleMovieIds.filter((id) => !existingCombo.includes(id));
                                setEditData({ ...editData, combo: [...existingCombo, ...toAdd] });
                              } else {
                                setEditData({
                                  ...editData,
                                  combo: existingCombo.filter((id: number) => !visibleMovieIds.includes(id))
                                });
                              }
                            }}
                          />
                          <label
                            htmlFor="check-all-movies"
                            className="cursor-pointer text-[11px] font-bold uppercase text-slate-500"
                          >
                            Chọn tất cả kết quả
                          </label>
                        </div>
                      </div>
                    )}
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
                        showMovieBranchTag
                          ? movieGroups.map((group) => (
                              <div key={group.key}>
                                <BranchGroupHeader
                                  label={group.label}
                                  count={group.items.length}
                                  all_selected={group.items.every((movie: any) => (editData.combo || []).includes(movie.id))}
                                  on_toggle={() => toggleMovieGroup(group.items)}
                                />
                                {group.items.map((movie: any) => renderMovieRow(movie, group.key === 'multi'))}
                              </div>
                            ))
                          : filteredMovies.map((movie: any) => renderMovieRow(movie, false))
                      )}
                    </div>
                    {movieTotal > movies.length && (
                      <p className="text-[11px] text-slate-400">
                        Đang hiện {movies.length}/{movieTotal} phim. Gõ tên phim để tìm thêm.
                      </p>
                    )}
                  </FormSection>
                )}

                {/* CHI NHÁNH & HIỂN THỊ */}
                <FormSection
                  title="Chi nhánh & cài đặt hiển thị"
                  icon={<Info size={14} className="text-blue-500" />}
                  className="space-y-3"
                >
                  <FormField label="Chi nhánh áp dụng" required error={ticketErrors.branch_ids}>
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
                  </FormField>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <FormField label="Thứ tự hiển thị" htmlFor="fmi_ticket_display_order" error={ticketErrors.display_order}>
                      <Input
                        id="fmi_ticket_display_order"
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
                        className={`${ADMIN_INPUT} ${ticketErrors.display_order ? 'border-red-500' : ''}`}
                      />
                    </FormField>
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
                </FormSection>
              </div>
            </div>
        </div>
      </AdminDialog>

      {/* UNSAVED CHANGES (footer Hủy button) */}
      <ConfirmDialog
        open={askDiscardEdit}
        onOpenChange={setAskDiscardEdit}
        variant="warning"
        title="Thay đổi chưa được lưu"
        description="Bạn đang có thay đổi chưa lưu. Nếu thoát bây giờ, nội dung vừa nhập sẽ bị mất."
        confirmText="Thoát, bỏ thay đổi"
        cancelText="Tiếp tục chỉnh sửa"
        onConfirm={close_edit_dialog}
      />

      {/* DETAIL DIALOG */}
      <AdminDialog
        open={isDetailDialogOpen}
        onClose={() => setIsDetailDialogOpen(false)}
        mode="view"
        size="lg"
        icon={selectedTicket?.type === 'vr' ? <Gamepad2 className="h-5 w-5" /> : <TicketIcon className="h-5 w-5" />}
        title={selectedTicket?.type === 'vr' ? 'Chi tiết gói trải nghiệm VR' : 'Chi tiết gói vé phim'}
        subtitle={`Mã: ${selectedTicket?.code || EMPTY_VALUE}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)} className={ADMIN_BTN_OUTLINE}>
              {ADMIN_TEXT.close}
            </Button>
            {selectedTicket && hasPermission('tickets', 'edit') && canModifyTicket(selectedTicket) && (
              <Button
                onClick={() => {
                  setIsDetailDialogOpen(false);
                  onEdit(selectedTicket);
                }}
                className={`${ADMIN_BTN_PRIMARY} gap-2`}
              >
                <Pencil className="h-4 w-4" /> {ADMIN_TEXT.edit}
              </Button>
            )}
          </>
        }
      >
          {selectedTicket && (
            <div className="space-y-4">
              {detailLoadError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  Không tải được người tạo, người sửa và danh sách phim của gói. Đóng và mở lại để thử lại.
                </div>
              )}
              {/* Cover image (VR hero card; movie packages show the cover when one was set) */}
              {selectedTicket.cover_image && (
                <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-purple-200 shadow-sm group">
                  <img
                    src={selectedTicket.cover_image}
                    alt={selectedTicket.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-5">
                    <div className="text-white">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="flex items-center gap-1 border-none bg-purple-600 text-xs font-bold text-white">
                          {selectedTicket.type === 'vr' ? (
                            <>
                              <Gamepad2 className="h-3 w-3" /> TRẢI NGHIỆM VR
                            </>
                          ) : (
                            <>
                              <Film className="h-3 w-3" /> VÉ PHIM
                            </>
                          )}
                        </Badge>
                        {selectedTicket.vr_genre && (
                          <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
                            {selectedTicket.vr_genre}
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl font-black">{selectedTicket.name}</h2>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Basic Info */}
                <div className={ADMIN_CARD}>
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
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Vé phim</Badge>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold uppercase text-gray-400 block">Trạng thái</Label>
                        <div>
                          <StatusBadge status={selectedTicket.is_active ? 'active' : 'inactive'} />
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
                </div>

                {/* Pricing & Stats */}
                <div className={ADMIN_CARD}>
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-2">
                      <Banknote className="w-3.5 h-3.5 text-emerald-500" />
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
                </div>

                {/* Description */}
                <div className={`${ADMIN_CARD} md:col-span-2`}>
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      Mô tả chi tiết
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="text-xs leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 text-slate-700">
                      {selectedTicket.description || EMPTY_VALUE}
                    </div>
                  </CardContent>
                </div>

                {/* Movies of the combo */}
                {selectedTicket.type !== 'vr' && (
                  <div className={`${ADMIN_CARD} md:col-span-2`}>
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
                  </div>
                )}

                {/* Features & Audit */}
                <div className={`${ADMIN_CARD} md:col-span-2`}>
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
                            className="bg-slate-50 text-slate-700 border-slate-200 text-xs flex items-center w-fit"
                          >
                            <Check className="mr-1 h-3 w-3 text-emerald-600" />
                            {feature}
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
                </div>
              </div>
            </div>
          )}
      </AdminDialog>

      {/* TOGGLE STATUS CONFIRM */}
      <ConfirmDialog
        open={toggleDialogOpen}
        onOpenChange={setToggleDialogOpen}
        variant={ticketToToggle?.currentStatus ? 'warning' : 'info'}
        title="Xác nhận thay đổi trạng thái"
        description={
          ticketToToggle?.currentStatus ? (
            <span>
              Bạn có chắc muốn <strong>ẩn</strong> gói này khỏi danh sách công khai không?
            </span>
          ) : (
            <span>
              Bạn có chắc muốn <strong>kích hoạt</strong> gói này để khách hàng có thể đặt không?
            </span>
          )
        }
        confirmText={ticketToToggle?.currentStatus ? 'Đồng ý ẩn' : 'Đồng ý kích hoạt'}
        busy={isTogglingStatus}
        onConfirm={() => {
          if (ticketToToggle) handleToggleStatus(ticketToToggle.id, ticketToToggle.currentStatus);
        }}
      />

      {/* CONFIRM PRICE CHANGE */}
      <ConfirmDialog
        open={!!confirmSaveData}
        onOpenChange={(open) => !open && setConfirmSaveData(null)}
        variant="warning"
        title="Xác nhận thay đổi giá gói vé"
        description={
          <span className="block space-y-3">
            <span className="block">
              Bạn đang điều chỉnh thông tin giá niêm yết của gói <strong>{editData?.name}</strong>:
            </span>
            <span className="block space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
              {confirmSaveData?.changes.map((change) => (
                <span key={change} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>{change}</span>
                </span>
              ))}
            </span>
            <span className="block text-xs italic text-slate-500">
              Giá mới sẽ có hiệu lực ngay lập tức khi khách hàng xem và chọn mua gói vé này trên giao diện booking.
            </span>
          </span>
        }
        confirmText="Xác nhận lưu"
        busy={isSaving}
        onConfirm={async () => {
          if (!confirmSaveData) return;
          setIsSaving(true);
          try {
            await updateTicketApi(Number(editData.id), confirmSaveData.payload);
            await onRefresh();
            notify.saved('gói vé');
            setConfirmSaveData(null);
            setIsEditOpen(false);
          } catch (err: any) {
            notify.error(err, 'Lưu thất bại');
          } finally {
            setIsSaving(false);
          }
        }}
      />
    </div>
  );
}
