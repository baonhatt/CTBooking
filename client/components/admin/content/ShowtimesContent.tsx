import React, { useEffect, useMemo, useState } from 'react';
import {
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

interface Props {
  branches: any[];
  schedules: Record<number, ShowtimeItem[]>;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onRefreshBranch: (branchId: number) => Promise<void>;
}

export default function ShowtimesContent({ branches, schedules, isLoading, onRefresh, onRefreshBranch }: Props) {
  const permissions = useStaffPermissions();
  const isSuperAdmin = useIsSuperAdmin();
  const hasPermission = (module: string, action: string) => {
    if (isSuperAdmin) return true;
    return permissions.some((p) => p.module === module && p.action === action);
  };

  const [editorBranch, setEditorBranch] = useState<any | null>(null);
  const [movies, setMovies] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState<ShowtimeItem | null>(null);
  const [form, setForm] = useState({ movie_id: 0, start_time: '', end_time: '' });
  const [copyFromBranchId, setCopyFromBranchId] = useState<number | ''>('');
  const [deleteTarget, setDeleteTarget] = useState<ShowtimeItem | null>(null);

  const items = editorBranch ? schedules[editorBranch.id] || [] : [];
  const lastSlot = items[items.length - 1];
  const selectedMovie = useMemo(() => movies.find((m) => m.id === form.movie_id), [movies, form.movie_id]);

  useEffect(() => {
    if (!editorBranch?.id) {
      setMovies([]);
      return;
    }
    (async () => {
      try {
        const { items: movieItems } = await getMoviesAdmin({
          page: 1,
          pageSize: 200,
          status: 'active',
          branch_id: editorBranch.id
        });
        setMovies(movieItems || []);
      } catch {
        setMovies([]);
      }
    })();
  }, [editorBranch?.id]);

  const applyEndFromDuration = (start: string, durationMin?: number) => {
    if (!start || !durationMin || durationMin <= 0) return '';
    return addMinutesToTime(start, durationMin) || '';
  };

  const resetForm = (next = false) => {
    const start =
      next && lastSlot?.end_time ? lastSlot.end_time : items.length === 0 ? '10:00' : lastSlot?.end_time || '10:00';
    setEditing(null);
    setForm({ movie_id: 0, start_time: start, end_time: '' });
  };

  const openEditor = (branch: any) => {
    setEditorBranch(branch);
    setEditing(null);
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
  };

  const handleMovieChange = (movieId: number) => {
    const movie = movies.find((m) => m.id === movieId);
    setForm((prev) => ({
      ...prev,
      movie_id: movieId,
      end_time: applyEndFromDuration(prev.start_time, movie?.duration_min)
    }));
  };

  const handleStartChange = (start: string) => {
    const movie = movies.find((m) => m.id === form.movie_id);
    setForm((prev) => ({
      ...prev,
      start_time: start,
      end_time: applyEndFromDuration(start, movie?.duration_min) || prev.end_time
    }));
  };

  const handleSave = async () => {
    if (!editorBranch) return;
    if (!form.movie_id || !form.start_time || !form.end_time) {
      toast.error('Chọn phim, giờ bắt đầu và giờ kết thúc');
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

  const handleCopy = async () => {
    if (!editorBranch || !copyFromBranchId) {
      toast.error('Chọn chi nhánh nguồn');
      return;
    }
    setIsSaving(true);
    try {
      const r = await copyShowtimesApi({
        from_branch_id: Number(copyFromBranchId),
        to_branch_id: editorBranch.id
      });
      toast.success(`Đã sao chép ${r.copied ?? 0} suất chiếu`);
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
          className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0 h-10 w-10"
          title="Làm mới"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Card className="border border-gray-200 rounded-xl shadow-sm bg-white">
        <CardContent className="p-0">
          {isLoading || branches.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-500 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="font-medium text-sm">Đang tải danh sách chi nhánh & lịch chiếu...</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {branches.map((branch) => {
                const slots = schedules[branch.id] || [];
                const opensAt = slots[0]?.start_time;
                const closesAt = slots[slots.length - 1]?.end_time;
                return (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => openEditor(branch)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50/90 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 truncate">{branch.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {branch.address || branch.code || 'Chi nhánh'}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {slots.length > 0 ? (
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
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editorBranch} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="[&>button]:hidden sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
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
              onClick={closeEditor}
              className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400"
            >
              <X className="w-5 h-5" />
            </Button>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            {hasPermission('showtimes', 'create') && (
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
                    <Label>Phim</Label>
                    <select
                      value={form.movie_id || ''}
                      onChange={(e) => handleMovieChange(Number(e.target.value))}
                      className="w-full bg-white border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-10"
                    >
                      <option value="">Chọn phim</option>
                      {movies.map((movie) => (
                        <option key={movie.id} value={movie.id}>
                          {movie.title}
                          {movie.duration_min ? ` (${movie.duration_min} phút)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Giờ bắt đầu</Label>
                    <Input
                      type="time"
                      value={form.start_time}
                      onChange={(e) => handleStartChange(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Giờ kết thúc</Label>
                    <Input
                      type="time"
                      value={form.end_time}
                      onChange={(e) => setForm((prev) => ({ ...prev, end_time: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                </div>
                {movies.length === 0 && (
                  <p className="text-xs text-amber-600">Chi nhánh này chưa có phim đang chiếu.</p>
                )}
                <p className="text-xs text-slate-400">
                  Giờ kết thúc tự điền theo thời lượng phim
                  {selectedMovie?.duration_min ? ` (${selectedMovie.duration_min} phút)` : ''}, vẫn sửa được.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
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

            {hasPermission('showtimes', 'create') && branches.length > 1 && (
              <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 p-3">
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <Label>Sao chép lịch từ chi nhánh khác</Label>
                  <select
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
                          {(schedules[branch.id] || []).length ? ` (${schedules[branch.id].length} suất)` : ''}
                        </option>
                      ))}
                  </select>
                </div>
                <Button
                  variant="outline"
                  onClick={handleCopy}
                  disabled={isSaving || !copyFromBranchId}
                  className="h-10 rounded-lg"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Sao chép vào {editorBranch?.name}
                </Button>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              {items.length === 0 ? (
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
                    return (
                      <div key={slot.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-[118px] shrink-0 font-black tabular-nums text-blue-700">
                          {slot.start_time} – {slot.end_time}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-800 truncate">
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

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="[&>button]:hidden z-[60]">
          <DialogHeader className="flex flex-row items-center gap-3 space-y-0 pb-4 border-b">
            <DialogTitle className="text-lg font-bold text-slate-800">Xóa suất chiếu</DialogTitle>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteTarget(null)}
              className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400"
            >
              <X className="w-5 h-5" />
            </Button>
          </DialogHeader>
          <p className="py-4 text-sm text-slate-600">
            Xóa suất {deleteTarget?.start_time} – {deleteTarget?.end_time}
            {deleteTarget?.movie_title ? ` (${deleteTarget.movie_title})` : ''}? Không thể hoàn tác.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="text-slate-500">
              Hủy
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isSaving}
              className="bg-red-600 hover:bg-red-700 min-w-[120px] rounded-xl"
            >
              {isSaving ? 'Đang xóa...' : 'Xóa suất'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
