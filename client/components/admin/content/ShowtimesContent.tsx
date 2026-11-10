import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  Clock,
  Copy,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/admin/dialogs/ConfirmDeleteDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useStaffPermissions, useIsSuperAdmin } from '@/hooks/useStaffPermission';
import { getMoviesAdmin } from '@/lib/api/movies';
import {
  copyShowtimesApi,
  createShowtimeApi,
  deleteShowtimeApi,
  updateShowtimeApi,
  type ShowtimeItem
} from '@/lib/api/showtimes';
import { useConfirmUnsaved } from '@/hooks/useConfirmUnsaved';
import { formatVnDateTime } from '@/lib/format';

// loading: waiting for the branch list; ready: loaded (the list may be empty); error: the branch list failed to load
export type BranchesStatus = 'loading' | 'ready' | 'error';

type MoviesStatus = 'loading' | 'ready' | 'error';

type FormField = 'movie_id' | 'start_time' | 'end_time';

const FORM_FIELD_IDS: Record<FormField, string> = {
  movie_id: 'fmi_showtime_movie',
  start_time: 'fmi_showtime_start',
  end_time: 'fmi_showtime_end'
};

function addMinutesToTime(value: string, minutes: number): string | null {
  if (!/^\d{2}:\d{2}$/.test(value) || !Number.isFinite(minutes)) return null;
  const [hours, mins] = value.split(':').map(Number);
  const total = hours * 60 + mins + Math.round(minutes);
  if (total < 0 || total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

// Minutes since midnight, for comparing two times of the same day
function toMinutes(value: string): number {
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
}

// FieldError: red text under a form field
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-red-600">
      {message}
    </p>
  );
}

interface Props {
  branches: any[];
  branchesStatus: BranchesStatus;
  schedules: Record<number, ShowtimeItem[]>;
  failedBranchIds: number[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onRetryBranches: () => Promise<void>;
  onRefreshBranch: (branchId: number) => Promise<void>;
}

export default function ShowtimesContent({
  branches,
  branchesStatus,
  schedules,
  failedBranchIds,
  isLoading,
  onRefresh,
  onRetryBranches,
  onRefreshBranch
}: Props) {
  const permissions = useStaffPermissions();
  const isSuperAdmin = useIsSuperAdmin();
  const hasPermission = (module: string, action: string) => {
    if (isSuperAdmin) return true;
    return permissions.some((p) => p.module === module && p.action === action);
  };

  const [editorBranch, setEditorBranch] = useState<any | null>(null);
  const [movies, setMovies] = useState<any[]>([]);
  const [moviesStatus, setMoviesStatus] = useState<MoviesStatus>('loading');
  const [moviesReloadKey, setMoviesReloadKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState<ShowtimeItem | null>(null);
  const [form, setForm] = useState({ movie_id: 0, start_time: '', end_time: '' });
  const [formErrors, setFormErrors] = useState<Partial<Record<FormField, string>>>({});
  const [copyFromBranchId, setCopyFromBranchId] = useState<number | ''>('');
  const [isCopyConfirmOpen, setIsCopyConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ShowtimeItem | null>(null);

  const items = editorBranch ? schedules[editorBranch.id] || [] : [];
  const lastSlot = items[items.length - 1];

  useEffect(() => {
    if (!editorBranch?.id) {
      setMovies([]);
      return;
    }
    let cancelled = false;
    setMoviesStatus('loading');
    (async () => {
      try {
        const { items: movieItems } = await getMoviesAdmin({
          page: 1,
          pageSize: 200,
          status: 'active',
          branch_id: editorBranch.id
        });
        if (cancelled) return;
        setMovies(movieItems || []);
        setMoviesStatus('ready');
      } catch {
        if (cancelled) return;
        setMovies([]);
        setMoviesStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editorBranch?.id, moviesReloadKey]);

  // The movie options: active movies of the branch, plus the movie of the slot being edited when it is not among them
  // (a movie that was hidden or is beyond the first 200), so the select never shows empty for an existing slot.
  const movieOptions = useMemo(() => {
    const options: Array<{ id: number; title: string; duration_min?: number; label_note?: string }> = movies.map((movie) => ({
      id: movie.id,
      title: movie.title,
      duration_min: movie.duration_min
    }));
    if (form.movie_id && !options.some((option) => option.id === form.movie_id)) {
      const slotOfMovie = items.find((slot) => slot.movie_id === form.movie_id);
      options.push({
        id: form.movie_id,
        title: slotOfMovie?.movie_title || 'Phim của suất này',
        duration_min: slotOfMovie?.movie_duration_min,
        label_note: slotOfMovie?.movie_deleted ? 'phim đã xóa' : 'không còn trong danh sách đang chiếu'
      });
    }
    return options;
  }, [movies, form.movie_id, items]);

  const selectedMovie = useMemo(() => movieOptions.find((m) => m.id === form.movie_id), [movieOptions, form.movie_id]);

  const applyEndFromDuration = (start: string, durationMin?: number) => {
    if (!start || !durationMin || durationMin <= 0) return '';
    return addMinutesToTime(start, durationMin) || '';
  };

  const resetForm = (next = false) => {
    const start =
      next && lastSlot?.end_time ? lastSlot.end_time : items.length === 0 ? '10:00' : lastSlot?.end_time || '10:00';
    setEditing(null);
    setFormErrors({});
    setForm({ movie_id: 0, start_time: start, end_time: '' });
  };

  const openEditor = (branch: any) => {
    setEditorBranch(branch);
    setEditing(null);
    setFormErrors({});
    setCopyFromBranchId('');
    const slots = schedules[branch.id] || [];
    const last = slots[slots.length - 1];
    setForm({ movie_id: 0, start_time: last?.end_time || '10:00', end_time: '' });
  };

  const closeEditor = () => {
    setEditorBranch(null);
    setEditing(null);
    setDeleteTarget(null);
    setCopyFromBranchId('');
    setFormErrors({});
  };

  const isDirty = useMemo(() => {
    if (!editorBranch) return false;
    if (editing) {
      return (
        form.movie_id !== editing.movie_id ||
        form.start_time !== editing.start_time ||
        form.end_time !== editing.end_time
      );
    }
    return form.movie_id !== 0 || form.end_time !== '';
  }, [editorBranch, editing, form]);

  const { handleOpenChange: handleEditorOpenChange, UnsavedAlert: EditorAlert } = useConfirmUnsaved({
    isDirty,
    isSubmitting: isSaving,
    onConfirmClose: closeEditor
  });

  const clearFormError = (field: FormField) => {
    setFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleMovieChange = (movieId: number) => {
    const movie = movieOptions.find((m) => m.id === movieId);
    clearFormError('movie_id');
    setForm((prev) => ({
      ...prev,
      movie_id: movieId,
      end_time: applyEndFromDuration(prev.start_time, movie?.duration_min)
    }));
  };

  const handleStartChange = (start: string) => {
    clearFormError('start_time');
    setForm((prev) => ({
      ...prev,
      start_time: start,
      end_time: applyEndFromDuration(start, selectedMovie?.duration_min) || prev.end_time
    }));
  };

  // What is wrong with the slot being typed, before it is sent: a time that ends before it starts, a slot that runs
  // past midnight (the schedule is one day only) and a clash with another slot of the same branch.
  const slotProblem = useMemo(() => {
    if (!form.start_time) return null;
    const duration = selectedMovie?.duration_min;
    if (!form.end_time && duration && addMinutesToTime(form.start_time, duration) === null) {
      return {
        blocking: false,
        message: `Phim dài ${duration} phút, bắt đầu ${form.start_time} sẽ kết thúc sau nửa đêm. Lịch chỉ gồm các suất trong cùng một ngày: chọn giờ bắt đầu sớm hơn hoặc nhập giờ kết thúc thủ công (tối đa 23:59).`
      };
    }
    if (!form.end_time) return null;
    if (toMinutes(form.end_time) <= toMinutes(form.start_time)) {
      return { blocking: true, message: 'Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày (không hỗ trợ suất qua nửa đêm).' };
    }
    const clash = items.find(
      (slot) =>
        slot.id !== editing?.id &&
        toMinutes(slot.start_time) < toMinutes(form.end_time) &&
        toMinutes(slot.end_time) > toMinutes(form.start_time)
    );
    if (clash) {
      return {
        blocking: true,
        message: `Trùng giờ với suất ${clash.start_time} – ${clash.end_time}${clash.movie_title ? ` (${clash.movie_title})` : ''}.`
      };
    }
    return null;
  }, [form.start_time, form.end_time, selectedMovie, items, editing]);

  // Shows the errors under their fields and puts the cursor on the first one
  const showFormErrors = (errors: Partial<Record<FormField, string>>) => {
    setFormErrors(errors);
    const firstField = (['movie_id', 'start_time', 'end_time'] as FormField[]).find((field) => errors[field]);
    if (firstField) document.getElementById(FORM_FIELD_IDS[firstField])?.focus();
  };

  const handleSave = async () => {
    if (!editorBranch) return;
    const errors: Partial<Record<FormField, string>> = {};
    if (!form.movie_id) errors.movie_id = 'Chọn phim';
    if (!form.start_time) errors.start_time = 'Nhập giờ bắt đầu';
    if (!form.end_time) errors.end_time = 'Nhập giờ kết thúc';
    if (Object.keys(errors).length > 0) {
      showFormErrors(errors);
      return;
    }
    setIsSaving(true);
    try {
      if (editing) {
        await updateShowtimeApi(editing.id, form);
        toast.success('Đã cập nhật suất chiếu');
      } else {
        await createShowtimeApi({ branch_id: editorBranch.id, ...form });
        toast.success('Đã thêm suất chiếu');
      }
      await onRefreshBranch(editorBranch.id);
      const end = form.end_time;
      setEditing(null);
      setFormErrors({});
      setForm({ movie_id: 0, start_time: end, end_time: '' });
    } catch (err: any) {
      toast.error(err.message || 'Lưu suất chiếu thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !editorBranch) return;
    setIsSaving(true);
    try {
      await deleteShowtimeApi(deleteTarget.id);
      toast.success('Đã xóa suất chiếu');
      setDeleteTarget(null);
      await onRefreshBranch(editorBranch.id);
    } catch (err: any) {
      toast.error(err.message || 'Xóa suất chiếu thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  // The button opens a confirmation first: copying replaces the schedule of this branch
  const askCopyConfirmation = () => {
    if (!editorBranch || !copyFromBranchId) {
      toast.error('Chọn chi nhánh nguồn');
      return;
    }
    setIsCopyConfirmOpen(true);
  };

  const handleCopy = async () => {
    if (!editorBranch || !copyFromBranchId || isSaving) return;
    setIsCopyConfirmOpen(false);
    setIsSaving(true);
    try {
      const r = await copyShowtimesApi({
        from_branch_id: Number(copyFromBranchId),
        to_branch_id: editorBranch.id
      });
      toast.success(`Đã sao chép ${r.copied ?? 0} suất chiếu` + (r.skipped ? `, bỏ qua ${r.skipped} suất vì phim không chiếu ở chi nhánh này` : ''));
      setCopyFromBranchId('');
      await onRefreshBranch(editorBranch.id);
    } catch (err: any) {
      toast.error(err.message || 'Sao chép lịch chiếu thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (slot: ShowtimeItem) => {
    setEditing(slot);
    setFormErrors({});
    setForm({
      movie_id: slot.movie_id,
      start_time: slot.start_time,
      end_time: slot.end_time
    });
  };

  const timeline = useMemo(() => {
    const rows: Array<{ type: 'slot'; slot: ShowtimeItem } | { type: 'gap'; minutes: number; key: string }> = [];
    items.forEach((slot, index) => {
      if (index > 0) {
        const gap = minutesBetween(items[index - 1].end_time, slot.start_time);
        if (gap > 0) {
          rows.push({ type: 'gap', minutes: gap, key: `gap-${items[index - 1].id}` });
        }
      }
      rows.push({ type: 'slot', slot });
    });
    return rows;
  }, [items]);

  // BRANCH LIST
  const renderBranchRow = (branch: any) => {
    const slots = schedules[branch.id] || [];
    const hasLoadFailed = failedBranchIds.includes(branch.id);
    const opensAt = slots[0]?.start_time;
    const closesAt = slots[slots.length - 1]?.end_time;
    return (
      <div key={branch.id} className="flex items-center hover:bg-slate-50/90 transition-colors">
        <button
          type="button"
          onClick={() => openEditor(branch)}
          aria-label={`Mở lịch chiếu chi nhánh ${branch.name}`}
          className="flex-1 min-w-0 flex items-center gap-4 px-5 py-4 text-left"
        >
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-800 truncate flex items-center gap-2">
              <span className="truncate" title={branch.name}>
                {branch.name}
              </span>
              {branch.is_active === false && (
                <span className="shrink-0 text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
                  Ngừng hoạt động
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 truncate" title={branch.address || undefined}>
              {branch.address || branch.code || 'Chi nhánh'}
            </div>
          </div>
          <div className="shrink-0 text-right">
            {hasLoadFailed ? (
              <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-full px-2.5 py-1">
                Lỗi tải
              </span>
            ) : slots.length > 0 ? (
              <>
                <div className="text-sm font-bold tabular-nums text-blue-700">
                  {opensAt} – {closesAt}
                </div>
                <div className="text-[11px] text-slate-400">{slots.length} suất</div>
              </>
            ) : (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-1">
                Chưa có lịch
              </span>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
        </button>
        {hasLoadFailed && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRefreshBranch(branch.id)}
            className="mr-4 shrink-0 rounded-lg text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Thử lại
          </Button>
        )}
      </div>
    );
  };

  const renderBranchList = () => {
    if (branchesStatus === 'loading' || (branchesStatus === 'ready' && isLoading && Object.keys(schedules).length === 0)) {
      return (
        <div className="flex items-center justify-center py-16 text-slate-500 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="font-medium text-sm">Đang tải danh sách chi nhánh & lịch chiếu...</span>
        </div>
      );
    }
    if (branchesStatus === 'error') {
      return (
        <div className="flex flex-col items-center justify-center py-14 text-center px-6">
          <AlertTriangle className="w-9 h-9 text-red-400 mb-2" />
          <p className="font-semibold text-slate-700">Không tải được danh sách chi nhánh</p>
          <p className="text-sm text-slate-400 mt-1">Kiểm tra kết nối rồi thử lại.</p>
          <Button variant="outline" onClick={onRetryBranches} className="mt-4 rounded-lg">
            <RefreshCw className="w-4 h-4 mr-1" />
            Thử lại
          </Button>
        </div>
      );
    }
    if (branches.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-14 text-center px-6">
          <MapPin className="w-9 h-9 text-slate-300 mb-2" />
          <p className="font-semibold text-slate-700">Chưa có chi nhánh nào để đặt lịch chiếu</p>
          <p className="text-sm text-slate-400 mt-1">
            Tài khoản này chưa được gán chi nhánh. Liên hệ quản trị viên để được phân quyền chi nhánh.
          </p>
        </div>
      );
    }
    return <div className="divide-y divide-slate-100">{branches.map(renderBranchRow)}</div>;
  };

  // The note under the movie select: loading, load failure or no movie
  const renderMoviesNote = () => {
    if (moviesStatus === 'loading') return <p className="text-xs text-slate-400">Đang tải danh sách phim...</p>;
    if (moviesStatus === 'error') {
      return (
        <p className="text-xs text-red-600">
          Không tải được danh sách phim.{' '}
          <button type="button" onClick={() => setMoviesReloadKey((key) => key + 1)} className="underline">
            Thử lại
          </button>
        </p>
      );
    }
    if (movies.length === 0) return <p className="text-xs text-amber-600">Chi nhánh này chưa có phim đang chiếu.</p>;
    return null;
  };

  const copySourceSlots = copyFromBranchId ? schedules[Number(copyFromBranchId)] || [] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Lịch chiếu</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Chọn chi nhánh để đặt lịch mẫu lặp mỗi ngày. Mỗi suất một phim, không gắn với đặt vé.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          aria-label="Làm mới lịch chiếu"
          className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0 h-10 w-10"
          title="Làm mới"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Card className="border border-gray-200 rounded-xl shadow-sm bg-white">
        <CardContent className="p-0">{renderBranchList()}</CardContent>
      </Card>

      <EditorAlert />
      <Dialog open={!!editorBranch} onOpenChange={handleEditorOpenChange}>
        <DialogContent className="[&>button]:hidden sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-white rounded-2xl">
          <DialogHeader className="flex flex-row items-center gap-3 space-y-0 pb-4 border-b shrink-0">
            <div>
              <DialogTitle className="text-lg font-bold text-slate-800">Lịch chiếu · {editorBranch?.name}</DialogTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                Thêm lần lượt các suất trong ngày. Suất mới sẽ tự điền giờ bắt đầu bằng giờ kết thúc suất trước.
              </p>
            </div>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEditorOpenChange(false)}
              aria-label="Đóng"
              className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400"
            >
              <X className="w-5 h-5" />
            </Button>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            {/* Staff who can edit but not create still need the form while editing a slot */}
            {(hasPermission('showtimes', 'create') || (editing && hasPermission('showtimes', 'edit'))) && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-700">{editing ? 'Sửa suất' : 'Thêm suất'}</p>
                  {editing && (
                    <button
                      type="button"
                      onClick={() => resetForm(true)}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Hủy sửa
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor={FORM_FIELD_IDS.movie_id}>
                      Phim <span className="text-red-500">*</span>
                    </Label>
                    <select
                      id={FORM_FIELD_IDS.movie_id}
                      aria-required="true"
                      aria-invalid={!!formErrors.movie_id}
                      value={form.movie_id || ''}
                      onChange={(e) => handleMovieChange(Number(e.target.value))}
                      className="w-full bg-white border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-10"
                    >
                      <option value="">Chọn phim</option>
                      {movieOptions.map((movie) => (
                        <option key={movie.id} value={movie.id}>
                          {movie.title}
                          {movie.duration_min ? ` (${movie.duration_min} phút)` : ''}
                          {movie.label_note ? ` - ${movie.label_note}` : ''}
                        </option>
                      ))}
                    </select>
                    <FieldError message={formErrors.movie_id} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={FORM_FIELD_IDS.start_time}>
                      Giờ bắt đầu <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id={FORM_FIELD_IDS.start_time}
                      type="time"
                      aria-required="true"
                      aria-invalid={!!formErrors.start_time}
                      value={form.start_time}
                      onChange={(e) => handleStartChange(e.target.value)}
                      className="h-10"
                    />
                    <FieldError message={formErrors.start_time} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={FORM_FIELD_IDS.end_time}>
                      Giờ kết thúc <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id={FORM_FIELD_IDS.end_time}
                      type="time"
                      aria-required="true"
                      aria-invalid={!!formErrors.end_time}
                      value={form.end_time}
                      onChange={(e) => {
                        clearFormError('end_time');
                        setForm((prev) => ({ ...prev, end_time: e.target.value }));
                      }}
                      className="h-10"
                    />
                    <FieldError message={formErrors.end_time} />
                  </div>
                </div>
                {renderMoviesNote()}
                <p className="text-xs text-slate-400">
                  Giờ kết thúc tự điền theo thời lượng phim
                  {selectedMovie?.duration_min ? ` (${selectedMovie.duration_min} phút)` : ''}, vẫn sửa được.
                </p>
                {slotProblem && (
                  <p
                    role="alert"
                    className={`flex items-start gap-1.5 text-xs rounded-lg border px-3 py-2 ${
                      slotProblem.blocking
                        ? 'text-red-700 bg-red-50 border-red-100'
                        : 'text-amber-700 bg-amber-50 border-amber-100'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {slotProblem.message}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || !!slotProblem?.blocking}
                    className="bg-blue-600 hover:bg-blue-700 rounded-lg h-10 px-4"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {isSaving ? 'Đang lưu...' : editing ? 'Cập nhật suất' : 'Thêm suất'}
                  </Button>
                  {!editing && items.length > 0 && (
                    <Button variant="outline" onClick={() => resetForm(true)} className="rounded-lg h-10">
                      Điền giờ suất tiếp
                    </Button>
                  )}
                </div>
              </div>
            )}

            {hasPermission('showtimes', 'create') && hasPermission('showtimes', 'delete') && branches.length > 1 && (
              <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 p-3">
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <Label htmlFor="fmi_showtime_copy_from">Sao chép lịch từ chi nhánh khác</Label>
                  <select
                    id="fmi_showtime_copy_from"
                    value={copyFromBranchId}
                    onChange={(e) => setCopyFromBranchId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-white border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-10"
                  >
                    <option value="">Chọn chi nhánh nguồn</option>
                    {branches
                      .filter((b) => b.id !== editorBranch?.id)
                      .map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                          {branch.is_active === false ? ' (ngừng hoạt động)' : ''}
                          {(schedules[branch.id] || []).length ? ` (${schedules[branch.id].length} suất)` : ''}
                        </option>
                      ))}
                  </select>
                </div>
                <Button
                  variant="outline"
                  onClick={askCopyConfirmation}
                  disabled={isSaving || !copyFromBranchId}
                  className="h-10 rounded-lg"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Sao chép vào {editorBranch?.name}
                </Button>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              {editorBranch && failedBranchIds.includes(editorBranch.id) ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                  <AlertTriangle className="w-9 h-9 text-red-400 mb-2" />
                  <p className="font-semibold text-slate-700">Không tải được lịch chiếu của chi nhánh này</p>
                  <p className="text-sm text-slate-400 mt-1">Danh sách bên dưới có thể chưa đầy đủ.</p>
                  <Button variant="outline" onClick={() => onRefreshBranch(editorBranch.id)} className="mt-4 rounded-lg">
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Thử lại
                  </Button>
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                  <CalendarClock className="w-9 h-9 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">Chưa có suất chiếu</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Thêm suất phía trên, hoặc sao chép lịch từ chi nhánh khác.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  <div className="px-4 py-2 bg-slate-50 text-xs text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {items[0].start_time} – {items[items.length - 1].end_time} · {items.length} suất
                  </div>
                  {timeline.map((row) => {
                    if (row.type === 'gap') {
                      return (
                        <div
                          key={row.key}
                          className="px-4 py-1.5 text-[11px] font-medium text-amber-600 bg-amber-50/70"
                        >
                          Trống {row.minutes} phút
                        </div>
                      );
                    }
                    const slot = row.slot;
                    const updatedTip = slot.updated_at ? `Cập nhật lần cuối: ${formatVnDateTime(slot.updated_at)}` : undefined;
                    return (
                      <div key={slot.id} className="flex items-center gap-3 px-4 py-3" title={updatedTip}>
                        <div className="w-[118px] shrink-0 font-black tabular-nums text-blue-700">
                          {slot.start_time} – {slot.end_time}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-800 truncate" title={slot.movie_title || undefined}>
                            {slot.movie_title || `Phim #${slot.movie_id}`}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {minutesBetween(slot.start_time, slot.end_time)} phút
                            {slot.movie_deleted ? ' · phim đã xóa' : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {hasPermission('showtimes', 'edit') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500"
                              title="Sửa"
                              aria-label={`Sửa suất ${slot.start_time} – ${slot.end_time}`}
                              onClick={() => openEdit(slot)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          {hasPermission('showtimes', 'delete') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-rose-500"
                              title="Xóa"
                              aria-label={`Xóa suất ${slot.start_time} – ${slot.end_time}`}
                              onClick={() => setDeleteTarget(slot)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        isOpen={isCopyConfirmOpen}
        onOpenChange={setIsCopyConfirmOpen}
        title="Sao chép lịch chiếu"
        description={
          <>
            <span className="block">
              Lịch hiện tại của {editorBranch?.name} ({items.length} suất) sẽ bị XÓA và thay bằng lịch của chi nhánh nguồn
              ({copySourceSlots.length} suất). Không thể hoàn tác.
            </span>
            {items.length > 0 && (
              <span className="block mt-2 max-h-40 overflow-y-auto rounded-lg border border-red-100 bg-red-50/60 px-3 py-2 text-xs text-red-800">
                {items.map((slot) => (
                  <span key={slot.id} className="block truncate">
                    {slot.start_time} – {slot.end_time}
                    {slot.movie_title ? ` · ${slot.movie_title}` : ''}
                  </span>
                ))}
              </span>
            )}
            <span className="block mt-2">Tiếp tục?</span>
          </>
        }
        onConfirm={handleCopy}
        isDeleting={isSaving}
        confirmText="Xóa và sao chép"
      />

      <ConfirmDeleteDialog
        isOpen={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        description={
          <>
            Xóa suất {deleteTarget?.start_time} – {deleteTarget?.end_time}
            {deleteTarget?.movie_title ? ` (${deleteTarget.movie_title})` : ''}? Không thể hoàn tác.
          </>
        }
        onConfirm={handleDelete}
        isDeleting={isSaving}
        confirmText="Xóa suất"
      />
    </div>
  );
}
