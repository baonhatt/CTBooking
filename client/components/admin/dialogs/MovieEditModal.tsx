import React, { useState, useEffect } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { activeStatusLabel } from '@/lib/format';
import { BranchMultiSelect } from '@/components/admin/BranchMultiSelect';
import { normalizeBranchIdsInput, parseBranchIdsFromApi } from '@/lib/branch-ids';
import { createMovieApi, updateMovieApi, getMovieById, getAdminBranchOptions } from '@/lib/api';
import { formatToVNDatetimeLocal, vnDatetimeLocalToUTC } from '@/lib/utils';
import { useIsSuperAdmin, useStaffBranchIds } from '@/hooks/useStaffPermission';
import { AdminDialog, AdminDialogFooter } from '@/components/admin/common/AdminDialog';
import { FormField, FormSection } from '@/components/admin/common/FormField';
import { notify } from '@/components/admin/common/notify';
import { ADMIN_INPUT, ADMIN_TEXT } from '@/components/admin/common/adminTokens';

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
      // Load the detail once per opened movie. A blank description is a valid value, so a flag is used instead of
      // testing the description (otherwise a movie without description would be loaded again and again).
      if (!idNum || editData.detailsLoaded || (editData.description && editData.branch_ids !== undefined)) return;
      try {
        const m = await getMovieById(idNum);
        if (m) {
          setEditData({
            ...editData,
            detailsLoaded: true,
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
    // Keyed on the movie id only: editData changes on every keystroke and must not re-trigger the load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditOpen, editData?.id]);

  const validateField = (field: string, value: any) => {
    let error = '';
    if (field === 'title' && !value?.trim()) error = 'Tên phim không được để trống';
    if (field === 'duration' && (!value || Number(value) <= 0)) error = 'Thời lượng phải lớn hơn 0 phút';
    // A blank rating is allowed (shown as "-" in the list)
    if (field === 'rating' && value !== '' && value !== null && value !== undefined) {
      if (Number.isNaN(Number(value)) || Number(value) < 0 || Number(value) > 10) error = 'Đánh giá phải từ 0-10';
    }
    if (field === 'posterFile' && value?.size > 15_000_000) error = 'Ảnh phải nhỏ hơn 15MB';

    setFieldErrors((prev) => ({ ...prev, [field]: error }));
    return error;
  };

  // Check every required field at Save and show each problem under its field
  const validateAllFields = () => {
    const errors = [
      validateField('title', editData?.title),
      validateField('duration', editData?.duration),
      validateField('rating', editData?.rating),
      validateField('posterFile', editData?.posterFile)
    ];
    return errors.every((error) => !error);
  };

  // Save stays blocked while the poster is too big (the poster is compressed and uploaded when Save is pressed)
  const hasPosterError = Boolean(fieldErrors.posterFile);

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

  // Called by AdminDialog after the user agreed to drop unsaved changes (or there were none)
  const handleClose = () => {
    setIsEditOpen(false);
    setIsDirty(false);
  };

  const handleSubmit = async () => {
    if (!validateAllFields()) {
      notify.error('Vui lòng kiểm tra các ô báo lỗi');
      return;
    }

    try {
      setIsSaving(true);
      let coverBase64: string | undefined = undefined;
      if (editData.posterFile) {
        const posterFile = editData.posterFile as File;
        const quality = posterFile.size > 15_000_000 ? 0.5 : posterFile.size > 8_000_000 ? 0.6 : 0.75;
        coverBase64 = await fileToCompressedDataURL(posterFile, {
          maxW: 1280,
          maxH: 1280,
          quality,
          type: 'image/webp'
        });
      }

      let branch_ids = normalizeBranchIdsInput(editData.branch_ids, editData.branch_id);
      if (!isSuperAdmin) {
        if (branch_ids === null) {
          branch_ids =
            staffBranchIds && staffBranchIds.length > 0
              ? staffBranchIds
              : availableBranches.length > 0
                ? [availableBranches[0].id]
                : [];
        }
        if (!Array.isArray(branch_ids) || branch_ids.length === 0) {
          notify.error('Vui lòng chọn ít nhất một chi nhánh thuộc quyền quản lý');
          return;
        }
      } else {
        if (Array.isArray(branch_ids) && branch_ids.length === 0) {
          notify.error('Vui lòng chọn ít nhất một chi nhánh hoặc "Tất cả chi nhánh"');
          return;
        }
      }

      const payload = {
        title: editData.title,
        description: editData.description,
        cover_image: editData.posterUrl,
        cover_image_base64: coverBase64,
        genres: editData.genres,
        // Blank rating is saved as empty, not as 0
        rating: (editData.rating === null || editData.rating === undefined || editData.rating === ''
          ? null
          : Number(editData.rating)) as any,
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
      if (editData.id) notify.saved('phim');
      else notify.created('phim');
      setIsEditOpen(false);
      setIsDirty(false);
    } catch (err: any) {
      notify.error(err, 'Không thể lưu dữ liệu');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminDialog
      open={isEditOpen}
      onClose={handleClose}
      mode="form"
      size="xl"
      dirty={isDirty}
      busy={isSaving}
      title={editData?.id ? 'Chỉnh sửa thông tin phim' : 'Khởi tạo phim chiếu rạp mới'}
      footer={
        <AdminDialogFooter
          onCancel={() => handleClose()}
          onSubmit={handleSubmit}
          submitText={editData?.id ? ADMIN_TEXT.save : ADMIN_TEXT.create}
          busy={isSaving}
          submitDisabled={hasPosterError}
        />
      }
    >
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 space-y-4 lg:col-span-4">
          <label
            htmlFor="poster-input"
            className="group block cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-blue-400"
          >
            <span className="mb-2 block text-sm font-medium text-slate-700">Poster phim</span>
            <div
              className={`relative aspect-[2/3] overflow-hidden rounded-xl border-2 border-dashed bg-slate-50 transition-colors ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'group-hover:border-blue-200'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {editData?.posterUrl ? (
                <>
                  <img src={editData.posterUrl} className="h-full w-full object-cover" alt="Xem trước poster" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                      Thay đổi ảnh
                    </span>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                  <div className="mb-2 rounded-full bg-slate-100 p-3 transition-colors group-hover:bg-blue-50 group-hover:text-blue-500">
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
            </div>
            {fieldErrors.posterFile && <p className="mt-2 text-xs font-medium text-red-600">{fieldErrors.posterFile}</p>}
            <p className="mt-3 text-center text-[11px] italic text-slate-400">Hỗ trợ: JPG, PNG, WEBP (Tối đa 15MB)</p>
          </label>
        </div>

        <div className="col-span-12 space-y-6 lg:col-span-8">
          <FormSection title="Thông tin cơ bản">
            <FormField label="Tên phim" required error={fieldErrors.title}>
              <Input
                placeholder="Ví dụ: Đào, Phở và Piano"
                value={editData?.title || ''}
                onChange={(e) => {
                  setEditData({ ...editData, title: e.target.value });
                  validateField('title', e.target.value);
                  setIsDirty(true);
                }}
                className={`${ADMIN_INPUT} ${fieldErrors.title ? 'border-red-500' : ''}`}
              />
            </FormField>
          </FormSection>

          <FormSection title="Nội dung">
            <div className="space-y-4">
              <FormField label="Mô tả nội dung" helper={`${editData?.description?.length || 0} ký tự`}>
                <textarea
                  value={editData?.description || ''}
                  onChange={(e) => {
                    setEditData({ ...editData, description: e.target.value });
                    setIsDirty(true);
                  }}
                  placeholder="Nhập tóm tắt nội dung phim..."
                  className="max-h-[150px] min-h-[100px] w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm leading-relaxed outline-none transition-all placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                />
              </FormField>

              <FormField label="Thể loại (Ví dụ: Hành động, Tình cảm)">
                <Input
                  placeholder="Nhập các thể loại, ngăn cách bằng dấu phẩy"
                  value={editData?.genresText ?? (editData?.genres || []).join(', ')}
                  onChange={(e) => {
                    setEditData({
                      ...editData,
                      genresText: e.target.value,
                      genres: e.target.value
                        .split(/[,;|\n]| {2,}/)
                        .map((genre: string) => genre.trim())
                        .filter(Boolean)
                    });
                    setIsDirty(true);
                  }}
                  className={ADMIN_INPUT}
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Cài đặt">
            <div className="space-y-4">
              <div className="grid grid-cols-12 gap-4">
                <FormField label="Chi nhánh" required className="col-span-12 lg:col-span-6">
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
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span>Đang tải danh sách chi nhánh...</span>
                    </div>
                  )}
                </FormField>

                <FormField label="Thời lượng (Phút)" required error={fieldErrors.duration} className="col-span-12 lg:col-span-3">
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
                    className={`${ADMIN_INPUT} ${fieldErrors.duration ? 'border-red-500' : ''}`}
                  />
                </FormField>

                <FormField label="Đánh giá (0-10)" error={fieldErrors.rating} className="col-span-12 lg:col-span-3">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="8.5"
                    value={editData?.rating ?? ''}
                    onChange={(e) => {
                      // Blank stays blank (null), it must not turn into 0
                      setEditData({
                        ...editData,
                        rating: e.target.value === '' ? null : Number(e.target.value)
                      });
                      validateField('rating', e.target.value);
                      setIsDirty(true);
                    }}
                    className={`${ADMIN_INPUT} ${fieldErrors.rating ? 'border-red-500' : ''}`}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-12 gap-4">
                <FormField label="Ngày phát hành" className="col-span-12 lg:col-span-6">
                  <input
                    type="datetime-local"
                    value={editData?.release_date ? formatToVNDatetimeLocal(editData.release_date) : ''}
                    onChange={(e) => {
                      setEditData({
                        ...editData,
                        release_date: e.target.value ? vnDatetimeLocalToUTC(e.target.value) : undefined
                      });
                      setIsDirty(true);
                    }}
                    className="h-10 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition-all focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                </FormField>

                <FormField label="Trạng thái" className="col-span-12 lg:col-span-6">
                  <div className="flex h-10 items-center gap-3">
                    <Switch
                      checked={editData?.is_active !== false}
                      aria-label="Trạng thái phim"
                      onCheckedChange={(checked) => {
                        setEditData({ ...editData, is_active: checked });
                        setIsDirty(true);
                      }}
                    />
                    <span className="text-sm text-slate-600">{activeStatusLabel(editData?.is_active !== false)}</span>
                  </div>
                </FormField>
              </div>
            </div>
          </FormSection>
        </div>
      </div>
    </AdminDialog>
  );
};
