import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Lock, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BranchMultiSelect } from '@/components/admin/BranchMultiSelect';
import { normalizeBranchIdsInput, parseBranchIdsFromApi } from '@/lib/branch-ids';
import { createMovieApi, updateMovieApi, getMovieById, getAdminBranchOptions } from '@/lib/api';
import { formatToVNDatetimeLocal, vnDatetimeLocalToUTC } from '@/lib/utils';
import { useIsSuperAdmin, useStaffBranchIds } from '@/hooks/useStaffPermission';

export interface MovieEditModalProps {
  isEditOpen: boolean;
  setIsEditOpen: (open: boolean) => void;
  editData: any;
  setEditData: (data: any) => void;
  branchesProp?: any[];
  onRefresh?: () => Promise<void>;
}

export const MovieEditModal: React.FC<MovieEditModalProps> = ({
  isEditOpen,
  setIsEditOpen,
  editData,
  setEditData,
  branchesProp,
  onRefresh
}) => {
  const isSuperAdmin = useIsSuperAdmin();
  const staffBranchIds = useStaffBranchIds();

  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);

  const availableBranches = React.useMemo(() => {
    if (isSuperAdmin) return branches;
    if (!staffBranchIds || staffBranchIds.length === 0) return branches;
    return branches.filter((b) => staffBranchIds.includes(b.id));
  }, [branches, isSuperAdmin, staffBranchIds]);

  useEffect(() => {
    if (!isEditOpen) {
      setIsDirty(false);
      setFieldErrors({});
    }
  }, [isEditOpen]);

  // Load branches
  useEffect(() => {
    if (isEditOpen && !branchesProp?.length) {
      (async () => {
        try {
          const { items } = await getAdminBranchOptions({ includeInactive: true });
          setBranches(items);
        } catch (error) {
          console.error('Error loading branches:', error);
        }
      })();
    }
  }, [isEditOpen, branchesProp]);

  // Sync branches from prop
  useEffect(() => {
    if (branchesProp && branchesProp.length > 0) {
      setBranches(branchesProp);
    }
  }, [branchesProp]);

  // Load movie specific data
  useEffect(() => {
    const run = async () => {
      if (!isEditOpen || !editData?.id) return;
      const idNum = Number(editData.id);
      if (!idNum || editData.description) return; // already loaded
      try {
        const m = await getMovieById(idNum);
        if (m) {
          setEditData({
            ...editData,
            description: m.description || '',
            posterUrl: editData.posterUrl || m.cover_image || '',
            genresText:
              editData.genresText ??
              (Array.isArray(editData.genres) && editData.genres.length
                ? editData.genres.join(', ')
                : Array.isArray(m.genres)
                  ? m.genres.join(', ')
                  : ''),
            genres:
              Array.isArray(editData.genres) && editData.genres.length
                ? editData.genres
                : Array.isArray(m.genres)
                  ? m.genres
                  : [],
            rating: editData.rating ?? m.rating ?? null,
            duration:
              editData.duration !== undefined && editData.duration !== null
                ? editData.duration
                : (m.duration_min ?? ''),
            release_date: editData.release_date ?? m.release_date ?? null,
            branch_id: editData.branch_id ?? m.branch_id ?? null,
            branch_ids: editData.branch_ids ?? parseBranchIdsFromApi(m.branch_ids ?? m.branch_id),
            is_active: editData.is_active ?? m.is_active ?? true
          });
        }
      } catch {}
    };
    run();
  }, [isEditOpen, editData?.id, setEditData, editData]);

  const validateField = (field: string, value: any) => {
    let error = '';
    if (field === 'title' && !value?.trim()) error = 'Tên phim không được để trống';
    if (field === 'duration' && (!value || Number(value) <= 0)) error = 'Thời lượng phải lớn hơn 0 phút';
    if (field === 'rating' && value && (Number(value) < 0 || Number(value) > 10)) error = 'Đánh giá phải từ 0-10';
    if (field === 'posterFile' && value?.size > 15_000_000) error = 'Ảnh phải nhỏ hơn 15MB';

    setFieldErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      validateField('posterFile', file);
      const url = URL.createObjectURL(file);
      setEditData({ ...editData, posterUrl: url, posterFile: file });
      setIsDirty(true);
    }
  };

  const fileToCompressedDataURL = async (
    file: File,
    opts?: { maxW?: number; maxH?: number; quality?: number; type?: string }
  ) => {
    const maxW = opts?.maxW ?? 1280;
    const maxH = opts?.maxH ?? 1280;
    const quality = opts?.quality ?? 0.75;
    const type = opts?.type ?? 'image/webp';
    const blobUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = blobUrl;
    });
    const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = Math.max(1, Math.round(img.width * ratio));
    const h = Math.max(1, Math.round(img.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL(type, quality);
    URL.revokeObjectURL(blobUrl);
    return dataUrl;
  };

  const handleClose = () => {
    if (isDirty) {
      const confirmed = window.confirm('Bạn có thay đổi chưa lưu. Bạn chắc chắn muốn đóng?');
      if (!confirmed) return;
    }
    setIsEditOpen(false);
    setIsDirty(false);
  };

  return (
    <Dialog open={isEditOpen} onOpenChange={handleClose}>
      <DialogContent className="[&>button]:hidden bg-slate-50 border-0 overflow-hidden flex flex-col max-w-[1200px] h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 bg-white border-b flex-row justify-between items-center shrink-0">
          <DialogTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            {editData?.id ? 'Chỉnh sửa thông tin phim' : 'Khởi tạo phim chiếu rạp mới'}
          </DialogTitle>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <div className="flex flex-col h-full overflow-hidden bg-white">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            <div className="grid grid-cols-12 gap-4 md:gap-6">
              <div className="col-span-12 lg:col-span-4 space-y-4">
                <label
                  htmlFor="poster-input"
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm block cursor-pointer group hover:border-blue-400 transition-all"
                >
                  <span className="text-sm font-medium text-gray-900 mb-2 block">Poster phim</span>
                  <div
                    className={`aspect-[2/3] relative border-2 border-dashed rounded-xl overflow-hidden bg-slate-50 transition-colors ${
                      isDragging ? 'border-blue-500 bg-blue-50' : 'group-hover:border-blue-200'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    {editData?.posterUrl ? (
                      <>
                        <img src={editData.posterUrl} className="w-full h-full object-cover" alt="Xem trước poster" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-xs font-medium bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm">
                            Thay đổi ảnh
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                        <div className="p-3 rounded-full bg-slate-100 mb-2 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                          <Plus size={24} />
                        </div>
                        <span className="text-xs font-medium">Tải ảnh lên</span>
                      </div>
                    )}
                    <input
                      id="poster-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          validateField('posterFile', file);
                          const url = URL.createObjectURL(file);
                          setEditData({ ...editData, posterUrl: url, posterFile: file });
                          setIsDirty(true);
                        }
                      }}
                    />
                    {fieldErrors.posterFile && <p className="text-xs text-red-500 mt-1">{fieldErrors.posterFile}</p>}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-3 text-center italic">
                    Hỗ trợ: JPG, PNG, WEBP (Tối đa 15MB)
                  </p>
                </label>
              </div>

              <div className="col-span-12 lg:col-span-8 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Thông tin cơ bản
                    </span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <div className="grid grid-cols-12 gap-4">
                    {editData?.id ? (
                      <div className="col-span-12 lg:col-span-4">
                        <Label className="text-sm font-medium text-gray-900 mb-2 block">ID hệ thống</Label>
                        <div className="relative group">
                          <Input
                            readOnly
                            value={`#${editData.id}`}
                            className="bg-slate-50/80 border-dashed border-slate-200 font-mono text-blue-600 cursor-not-allowed shadow-none"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
                            <Lock size={12} />
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className={`${editData?.id ? 'col-span-12 lg:col-span-8' : 'col-span-12'}`}>
                      <Label className="text-sm font-medium text-gray-900 mb-2 block">Tên phim</Label>
                      <Input
                        placeholder="Ví dụ: Đào, Phở và Piano"
                        value={editData?.title || ''}
                        onChange={(e) => {
                          setEditData({ ...editData, title: e.target.value });
                          validateField('title', e.target.value);
                          setIsDirty(true);
                        }}
                        className={`h-10 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600/10 outline-none transition-all placeholder:text-gray-400 ${fieldErrors.title ? 'border-red-500' : 'border-gray-300 focus:border-blue-600'}`}
                      />
                      {fieldErrors.title && <p className="text-xs text-red-500 mt-1">{fieldErrors.title}</p>}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nội dung</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label className="text-sm font-medium text-gray-900 block">Mô tả nội dung</Label>
                        <span className="text-xs text-slate-400">{editData?.description?.length || 0} ký tự</span>
                      </div>
                      <textarea
                        value={editData?.description || ''}
                        onChange={(e) => {
                          setEditData({ ...editData, description: e.target.value });
                          setIsDirty(true);
                        }}
                        placeholder="Nhập tóm tắt nội dung phim..."
                        className="w-full min-h-[100px] max-h-[150px] border border-gray-300 rounded-lg px-3 py-2 text-sm leading-relaxed focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none resize-y transition-all placeholder:text-gray-400"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-900 block">
                        Thể loại (Ví dụ: Hành động, Tình cảm)
                      </Label>
                      <Input
                        placeholder="Nhập các thể loại, ngăn cách bằng dấu phẩy"
                        value={editData?.genresText ?? (editData?.genres || []).join(', ')}
                        onChange={(e) => {
                          setEditData({
                            ...editData,
                            genresText: e.target.value,
                            genres: e.target.value
                              .split(/[,;|\n]| {2,}/)
                              .map((x: string) => x.trim())
                              .filter(Boolean)
                          });
                          setIsDirty(true);
                        }}
                        className="h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cài đặt</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-12 lg:col-span-6">
                        <Label className="text-sm font-medium text-gray-900 mb-2 block">Chi nhánh</Label>
                        {availableBranches && availableBranches.length > 0 ? (
                          <BranchMultiSelect
                            branches={availableBranches}
                            allowAll={isSuperAdmin}
                            value={normalizeBranchIdsInput(editData?.branch_ids, editData?.branch_id)}
                            onChange={(branch_ids) => {
                              setEditData({
                                ...editData,
                                branch_ids,
                                branch_id: branch_ids && branch_ids.length === 1 ? branch_ids[0] : null
                              });
                              setIsDirty(true);
                            }}
                          />
                        ) : (
                          <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 font-medium">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                            <span>Đang tải danh sách chi nhánh...</span>
                          </div>
                        )}
                      </div>

                      <div className="col-span-12 lg:col-span-3">
                        <Label className="text-sm font-medium text-gray-900 mb-2 block">Thời lượng (Phút)</Label>
                        <Input
                          type="number"
                          placeholder="120"
                          value={editData?.duration || ''}
                          onChange={(e) => {
                            setEditData({
                              ...editData,
                              duration: e.target.value === '' ? '' : Number(e.target.value)
                            });
                            validateField('duration', e.target.value);
                            setIsDirty(true);
                          }}
                          className={`h-10 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600/10 outline-none transition-all placeholder:text-gray-400 ${fieldErrors.duration ? 'border-red-500' : 'border-gray-300 focus:border-blue-600'}`}
                        />
                        {fieldErrors.duration && <p className="text-xs text-red-500 mt-1">{fieldErrors.duration}</p>}
                      </div>

                      <div className="col-span-12 lg:col-span-3">
                        <Label className="text-sm font-medium text-gray-900 mb-2 block">Đánh giá (0-10)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="8.5"
                          value={editData?.rating ?? ''}
                          onChange={(e) => {
                            setEditData({
                              ...editData,
                              rating: e.target.value ? Number(e.target.value) : undefined
                            });
                            validateField('rating', e.target.value);
                            setIsDirty(true);
                          }}
                          className={`h-10 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600/10 outline-none transition-all placeholder:text-gray-400 ${fieldErrors.rating ? 'border-red-500' : 'border-gray-300 focus:border-blue-600'}`}
                        />
                        {fieldErrors.rating && <p className="text-xs text-red-500 mt-1">{fieldErrors.rating}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-12 lg:col-span-6">
                        <Label className="text-sm font-medium text-gray-900 mb-2 block">Ngày phát hành</Label>
                        <input
                          type="datetime-local"
                          value={
                            editData?.release_date
                              ? formatToVNDatetimeLocal(editData.release_date)
                              : ''
                          }
                          onChange={(e) => {
                            setEditData({
                              ...editData,
                              release_date: e.target.value ? vnDatetimeLocalToUTC(e.target.value) : undefined
                            });
                            setIsDirty(true);
                          }}
                          className="w-full h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t bg-white flex justify-end items-center gap-3 shrink-0">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={isSaving}
              className="h-10 border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              Hủy bỏ
            </Button>
            <Button
              disabled={isSaving}
              className="h-10 bg-blue-600 hover:bg-blue-700 min-w-[140px] rounded-lg shadow-lg shadow-blue-500/20 transition-all active:scale-95"
              onClick={async () => {
                if (!editData.title?.trim()) {
                  toast.error('Lỗi', { description: 'Vui lòng nhập tên phim' });
                  return;
                }
                if (!editData.duration || Number(editData.duration) <= 0) {
                  toast.error('Lỗi', { description: 'Thời lượng phim không hợp lệ' });
                  return;
                }

                try {
                  setIsSaving(true);
                  let coverBase64: string | undefined = undefined;
                  if (editData.posterFile) {
                    const f = editData.posterFile as File;
                    const q = f.size > 15_000_000 ? 0.5 : f.size > 8_000_000 ? 0.6 : 0.75;
                    coverBase64 = await fileToCompressedDataURL(f, {
                      maxW: 1280,
                      maxH: 1280,
                      quality: q,
                      type: 'image/webp'
                    });
                  }

                  let branch_ids = normalizeBranchIdsInput(editData.branch_ids, editData.branch_id);
                  if (!isSuperAdmin) {
                    if (branch_ids === null) {
                      branch_ids = staffBranchIds && staffBranchIds.length > 0
                        ? staffBranchIds
                        : (availableBranches.length > 0 ? [availableBranches[0].id] : []);
                    }
                    if (!Array.isArray(branch_ids) || branch_ids.length === 0) {
                      toast.error('Lỗi', { description: 'Vui lòng chọn ít nhất một chi nhánh thuộc quyền quản lý' });
                      return;
                    }
                  } else {
                    if (Array.isArray(branch_ids) && branch_ids.length === 0) {
                      toast.error('Lỗi', { description: 'Vui lòng chọn ít nhất một chi nhánh hoặc "Tất cả chi nhánh"' });
                      return;
                    }
                  }

                  const payload = {
                    title: editData.title,
                    description: editData.description,
                    cover_image: editData.posterUrl,
                    cover_image_base64: coverBase64,
                    genres: editData.genres,
                    rating: Number(editData.rating) || 0,
                    duration_min: Number(editData.duration),
                    branch_ids,
                    is_active: editData.is_active !== false,
                    release_date: editData.release_date
                  };

                  if (editData.id) {
                    await updateMovieApi(Number(editData.id), payload);
                  } else {
                    await createMovieApi(payload as any);
                  }

                  if (onRefresh) await onRefresh();
                  toast.success('Thành công', {
                    description: editData.id ? 'Đã cập nhật thông tin phim' : 'Đã thêm phim mới'
                  });
                  setIsEditOpen(false);
                  setIsDirty(false);
                } catch (err: any) {
                  toast.error('Lỗi hệ thống', {
                    description: err?.message || 'Không thể lưu dữ liệu'
                  });
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang xử lý</span>
                </div>
              ) : (
                <span>{editData.id ? 'Lưu thay đổi' : 'Tạo phim mới'}</span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
