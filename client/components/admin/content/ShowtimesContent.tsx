import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  Clock,
  Copy,
  MapPin,
  Plus,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminDialog, AdminDialogFooter } from '@/components/admin/common/AdminDialog';
import { ConfirmDialog } from '@/components/admin/common/ConfirmDialog';
import { RowActionButton, RowActions } from '@/components/admin/common/RowActionButton';
import { StatusBadge } from '@/components/admin/common/StatusBadge';
import { PageHeader } from '@/components/admin/common/PageHeader';
import { EmptyState, InlineLoading } from '@/components/admin/common/EmptyState';
import { notify } from '@/components/admin/common/notify';
import { ADMIN_BTN_OUTLINE, ADMIN_BTN_PRIMARY, ADMIN_CARD, ADMIN_INPUT, ADMIN_TEXT } from '@/components/admin/common/adminTokens';
import { useStaffPermissions, useIsSuperAdmin } from '@/hooks/useStaffPermission';
import { getMoviesAdmin } from '@/lib/api/movies';
import {
  copyShowtimesApi,
  createShowtimeApi,
  deleteShowtimeApi,
  updateShowtimeApi,
  type ShowtimeItem
} from '@/lib/api/showtimes';
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
        notify.success('Đã cập nhật suất chiếu');
      } else {
        await createShowtimeApi({ branch_id: editorBranch.id, ...form });
        notify.success('Đã thêm suất chiếu');
      }
      await onRefreshBranch(editorBranch.id);
      const end = form.end_time;
      setEditing(null);
      setFormErrors({});
      setForm({ movie_id: 0, start_time: end, end_time: '' });
    } catch (err: any) {
      notify.error(err, 'Lưu suất chiếu thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !editorBranch) return;
    setIsSaving(true);
    try {
      await deleteShowtimeApi(deleteTarget.id);
      notify.success('Đã xóa suất chiếu');
      setDeleteTarget(null);
      await onRefreshBranch(editorBranch.id);
    } catch (err: any) {
      notify.error(err, 'Xóa suất chiếu thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  // The button opens a confirmation first: copying replaces the schedule of this branch
  const askCopyConfirmation = () => {
    if (!editorBranch || !copyFromBranchId) {
      notify.error('Chọn chi nhánh nguồn');
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
      notify.success(
        `Đã sao chép ${r.copied ?? 0} suất chiếu`,
        r.skipped ? `Bỏ qua ${r.skipped} suất vì phim không chiếu ở chi nhánh này` : undefined
      );
      setCopyFromBranchId('');
      await onRefreshBranch(editorBranch.id);
    } catch (err: any) {
      notify.error(err, 'Sao chép lịch chiếu thất bại');
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
                <StatusBadge status="inactive" className="shrink-0" />
              )}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 truncate" title={branch.address || undefined}>
              {branch.address || branch.code || 'Chi nhánh'}
            </div>
          </div>
          <div className="shrink-0 text-right">
            {hasLoadFailed ? (
              <StatusBadge tone="danger">Lỗi tải</StatusBadge>
            ) : slots.length > 0 ? (
              <>
                <div className="text-sm font-bold tabular-nums text-blue-700">
                  {opensAt} – {closesAt}
                </div>
                <div className="text-[11px] text-slate-400">{slots.length} suất</div>
              </>
            ) : (
              <StatusBadge tone="warning">Chưa có lịch</StatusBadge>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
        </button>
        {hasLoadFailed && (
          <Button variant="outline" onClick={() => onRefreshBranch(branch.id)} className={`${ADMIN_BTN_OUTLINE} mr-4 shrink-0`}>
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
        <InlineLoading text="Đang tải danh sách chi nhánh và lịch chiếu..." />
      );
    }
    if (branchesStatus === 'error') {
      return (
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6 text-red-400" />}
          title="Không tải được danh sách chi nhánh"
          description="Kiểm tra kết nối rồi thử lại."
          action={
            <Button variant="outline" onClick={onRetryBranches} className={`${ADMIN_BTN_OUTLINE} mt-2`}>
              <RefreshCw className="mr-1 h-4 w-4" />
              Thử lại
            </Button>
          }
        />
      );
    }
    if (branches.length === 0) {
      return (
        <EmptyState
          icon={<MapPin className="h-6 w-6" />}
          title="Chưa có chi nhánh nào để đặt lịch chiếu"
          description="Tài khoản này chưa được gán chi nhánh. Liên hệ quản trị viên để được phân quyền chi nhánh."
        />
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
      <PageHeader
        title="Lịch chiếu"
        description="Chọn chi nhánh để đặt lịch mẫu lặp mỗi ngày. Mỗi suất một phim, không gắn với đặt vé."
        actions={
          <Button variant="outline" onClick={onRefresh} aria-label="Làm mới lịch chiếu" title={ADMIN_TEXT.refresh} className={ADMIN_BTN_OUTLINE}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {ADMIN_TEXT.refresh}
          </Button>
        }
      />

      <div className={`${ADMIN_CARD} overflow-hidden`}>{renderBranchList()}</div>

      <AdminDialog
        open={!!editorBranch}
        onClose={closeEditor}
        mode="form"
        dirty={isDirty}
        busy={isSaving}
        size="lg"
        icon={<CalendarClock className="h-5 w-5" />}
        title={`Lịch chiếu · ${editorBranch?.name ?? ''}`}
        subtitle="Thêm lần lượt các suất trong ngày. Suất mới sẽ tự điền giờ bắt đầu bằng giờ kết thúc suất trước."
        footer={<AdminDialogFooter onCancel={closeEditor} cancelText={ADMIN_TEXT.close} busy={isSaving} />}
      >
        <div className="space-y-4">
            {/* Staff who can edit but not create still need the form while editing a slot */}
            {(hasPermission('showtimes', 'create') || (editing && hasPermission('showtimes', 'edit'))) && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
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
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
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
                      className={ADMIN_INPUT}
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
                      className={ADMIN_INPUT}
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
                    className={ADMIN_BTN_PRIMARY}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {isSaving ? 'Đang lưu...' : editing ? 'Cập nhật suất' : 'Thêm suất'}
                  </Button>
                  {!editing && items.length > 0 && (
                    <Button variant="outline" onClick={() => resetForm(true)} className={ADMIN_BTN_OUTLINE}>
                      Điền giờ suất tiếp
                    </Button>
                  )}
                </div>
              </div>
            )}

            {hasPermission('showtimes', 'create') && hasPermission('showtimes', 'delete') && branches.length > 1 && (
              <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <Label htmlFor="fmi_showtime_copy_from">Sao chép lịch từ chi nhánh khác</Label>
                  <select
                    id="fmi_showtime_copy_from"
                    value={copyFromBranchId}
                    onChange={(e) => setCopyFromBranchId(e.target.value ? Number(e.target.value) : '')}
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
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
                  className={ADMIN_BTN_OUTLINE}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Sao chép vào {editorBranch?.name}
                </Button>
              </div>
            )}

            <div className={`${ADMIN_CARD} overflow-hidden`}>
              {editorBranch && failedBranchIds.includes(editorBranch.id) ? (
                <EmptyState
                  icon={<AlertTriangle className="h-6 w-6 text-red-400" />}
                  title="Không tải được lịch chiếu của chi nhánh này"
                  description="Danh sách bên dưới có thể chưa đầy đủ."
                  action={
                    <Button variant="outline" onClick={() => onRefreshBranch(editorBranch.id)} className={`${ADMIN_BTN_OUTLINE} mt-2`}>
                      <RefreshCw className="mr-1 h-4 w-4" />
                      Thử lại
                    </Button>
                  }
                />
              ) : items.length === 0 ? (
                <EmptyState
                  icon={<CalendarClock className="h-6 w-6" />}
                  title="Chưa có suất chiếu"
                  description="Thêm suất phía trên, hoặc sao chép lịch từ chi nhánh khác."
                />
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
                            {slot.movie_title || 'Phim không xác định'}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {minutesBetween(slot.start_time, slot.end_time)} phút
                            {slot.movie_deleted ? ' · phim đã xóa' : ''}
                          </div>
                        </div>
                        <RowActions>
                          {hasPermission('showtimes', 'edit') && (
                            <RowActionButton
                              action="edit"
                              label={`Sửa suất ${slot.start_time} – ${slot.end_time}`}
                              onClick={() => openEdit(slot)}
                            />
                          )}
                          {hasPermission('showtimes', 'delete') && (
                            <RowActionButton
                              action="delete"
                              label={`Xóa suất ${slot.start_time} – ${slot.end_time}`}
                              onClick={() => setDeleteTarget(slot)}
                            />
                          )}
                        </RowActions>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
        </div>
      </AdminDialog>

      <ConfirmDialog
        open={isCopyConfirmOpen}
        onOpenChange={setIsCopyConfirmOpen}
        variant="danger"
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
        busy={isSaving}
        confirmText="Xóa và sao chép"
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        variant="danger"
        title="Xóa suất chiếu"
        description={
          <>
            Xóa suất {deleteTarget?.start_time} – {deleteTarget?.end_time}
            {deleteTarget?.movie_title ? ` (${deleteTarget.movie_title})` : ''}? Không thể hoàn tác.
          </>
        }
        onConfirm={handleDelete}
        busy={isSaving}
        confirmText="Xóa suất"
      />
    </div>
  );
}
