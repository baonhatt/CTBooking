import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Form, Input, Select, Button } from 'antd';
import { toast } from 'sonner';
import { createMovieApi, createToyApi, updateMovieApi, updateToyApi } from '@/lib/api';

interface AdminEditModalProps {
  editType: 'user' | 'movie' | 'toy' | null;
  editData: any;
  setIsEditOpen: (open: boolean) => void;
  isEditOpen: boolean;
  setEditData: (data: any) => void;
  setUsers: (users: any[]) => void;
  moviesLocal: any[];
  toLocalDateTimeString: (date: Date) => string;
  pageSize: number;
  currentPage: number;
  setMoviesLocal: (movies: any[]) => void;
  setMovieStatus: (status: any) => void;
  setToys: (toys: any[]) => void;
  onRefresh: () => void;
  onViewDetails?: (id: number) => void;
}

export default function AdminEditModal({
  editType,
  editData,
  setIsEditOpen,
  isEditOpen,
  setEditData,
  setUsers,
  moviesLocal,
  toLocalDateTimeString,
  pageSize,
  currentPage,
  setMoviesLocal,
  setMovieStatus,
  setToys,
  onRefresh
}: AdminEditModalProps) {
  const [form] = Form.useForm();
  const [isSaving, setIsSaving] = useState(false);
  const [coverImagePreviewUrl, setCoverImagePreviewUrl] = useState<string>('');
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);

  const modalOpen = useMemo(() => isEditOpen && !!editType, [editType, isEditOpen]);
  const modalTitle = useMemo(() => {
    if (editType === 'movie') return editData?.id ? 'Chỉnh sửa phim' : 'Thêm phim';
    if (editType === 'toy') return editData?.id ? 'Chỉnh sửa đồ chơi' : 'Thêm đồ chơi';
    return 'Edit User';
  }, [editData?.id, editType]);

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Không thể đọc file'));
      reader.readAsDataURL(file);
    });

  useEffect(() => {
    if (!modalOpen) return;

    if (editType === 'movie') {
      const releaseDateValue = editData?.release_date
        ? String(toLocalDateTimeString(new Date(editData.release_date)) || '').slice(0, 10)
        : '';
      form.setFieldsValue({
        title: editData?.title || '',
        description: editData?.description || '',
        cover_image: editData?.posterUrl || editData?.cover_image || '',
        cover_image_base64: '',
        detail_images: Array.isArray(editData?.detail_images)
          ? editData.detail_images.join('\n')
          : Array.isArray(editData?.detailImages)
            ? editData.detailImages.join('\n')
            : '',
        genres: Array.isArray(editData?.genres) ? editData.genres.join(', ') : editData?.genres || '',
        rating: editData?.rating ?? '',
        duration_min: editData?.duration_min ?? editData?.duration ?? '',
        release_date: releaseDateValue,
        is_active: editData?.is_active ?? true
      });
      setCoverImagePreviewUrl(editData?.posterUrl || editData?.cover_image || '');
      return;
    }

    if (editType === 'toy') {
      form.setFieldsValue({
        name: editData?.name || '',
        category: editData?.category || '',
        price: editData?.price ?? 0,
        stock: editData?.stock ?? 0,
        status: editData?.status || 'active',
        image_url: editData?.image_url || ''
      });
      return;
    }

    form.setFieldsValue(editData || {});
  }, [editData, editType, form, modalOpen, toLocalDateTimeString]);

  const handleCancel = () => {
    setIsEditOpen(false);
    setEditData(null);
    form.resetFields();
    setCoverImagePreviewUrl('');
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setIsSaving(true);

      if (editType === 'movie') {
        const parsedGenres = String(values.genres || '')
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
        const parsedDetailImages = String(values.detail_images || '')
          .split(/\r?\n|,/)
          .map((s: string) => s.trim())
          .filter(Boolean);
        const idNum = Number(editData?.id);
        const coverImageBase64 = String(values.cover_image_base64 || '').trim();
        const payload = {
          title: values.title,
          description: values.description || undefined,
          cover_image: coverImageBase64 ? undefined : values.cover_image || undefined,
          cover_image_base64: coverImageBase64 || undefined,
          detail_images: parsedDetailImages.length ? parsedDetailImages : undefined,
          genres: parsedGenres,
          rating: values.rating === '' ? undefined : Number(values.rating),
          duration_min: values.duration_min === '' ? undefined : Number(values.duration_min),
          is_active: values.is_active,
          release_date: values.release_date || undefined
        };
        if (Number.isFinite(idNum) && idNum > 0) {
          await updateMovieApi(idNum, payload);
        } else {
          await createMovieApi(payload as any);
        }
        toast.success('Thành công', { description: 'Đã lưu phim' });
      } else if (editType === 'toy') {
        const idNum = Number(editData?.id);
        const payload = {
          name: values.name,
          category: values.category || undefined,
          price: Number(values.price || 0),
          stock: Number(values.stock || 0),
          status: values.status,
          image_url: values.image_url || undefined
        };
        if (Number.isFinite(idNum) && idNum > 0) {
          await updateToyApi(idNum, payload);
        } else {
          await createToyApi(payload as any);
        }
        toast.success('Thành công', { description: 'Đã lưu đồ chơi' });
      } else {
        console.log('Update user:', values);
        toast.success('Thành công', { description: 'Đã lưu người dùng' });
      }

      await Promise.resolve(onRefresh());
      handleCancel();
    } catch (error) {
      if ((error as any)?.errorFields) return;
      console.error('Save failed:', error);
      toast.error('Lỗi', { description: (error as any)?.message || 'Không thể lưu dữ liệu' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      title={modalTitle}
      open={modalOpen}
      onCancel={handleCancel}
      onOk={handleOk}
      width={editType === 'movie' ? 980 : 600}
      confirmLoading={isSaving}
      footer={
        editType === 'movie' ? (
          <div className="w-full flex items-center justify-between gap-4">
            <div className="text-[11px] text-slate-400 italic">
              * Lưu ý: Mọi thay đổi sẽ ảnh hưởng trực tiếp đến lịch chiếu hiện tại
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleCancel} disabled={isSaving} className="rounded-xl">
                Hủy bỏ
              </Button>
              <Button
                type="primary"
                onClick={handleOk}
                loading={isSaving}
                className="rounded-xl bg-blue-600 hover:bg-blue-700"
              >
                {editData?.id ? 'Cập nhật' : 'Tạo phim mới'}
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      <Form form={form} layout="vertical">
        {editType === 'movie' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">
                  Poster phim
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => coverFileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') coverFileInputRef.current?.click();
                  }}
                  className="relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden cursor-pointer select-none"
                >
                  <div className="h-[240px] flex flex-col items-center justify-center gap-3 text-slate-400">
                    {coverImagePreviewUrl ? (
                      <img src={coverImagePreviewUrl} alt="poster" className="h-full w-full object-cover" />
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 text-2xl">
                          +
                        </div>
                        <div className="text-xs font-semibold">Tải ảnh lên</div>
                      </>
                    )}
                  </div>

                </div>

                <input
                  ref={coverFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const base64 = await fileToBase64(file);
                      form.setFieldValue('cover_image_base64', base64);
                      setCoverImagePreviewUrl(URL.createObjectURL(file));
                    } catch (err: any) {
                      toast.error('Lỗi', { description: err?.message || 'Không thể đọc file ảnh' });
                    }
                  }}
                />

                <div className="text-[10px] text-slate-400 italic mt-3">
                  Hỗ trợ: JPG, PNG, WEBP (Tối đa 15MB)
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <Form.Item name="cover_image_base64" hidden>
                  <Input />
                </Form.Item>

                <Form.Item
                  label={<span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Tên phim</span>}
                  name="title"
                  rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
                >
                  <Input className="h-11 rounded-xl" placeholder="Ví dụ: Đào, Phở và Piano" />
                </Form.Item>

                <Form.Item
                  label={<span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Mô tả nội dung</span>}
                  name="description"
                >
                  <Input.TextArea className="rounded-xl" rows={4} placeholder="Nhập tóm tắt nội dung phim..." />
                </Form.Item>

                <Form.Item
                  label={<span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Thể loại (ví dụ: hành động, tình cảm)</span>}
                  name="genres"
                >
                  <Input className="h-11 rounded-xl" placeholder="Nhập các thể loại, ngăn cách bằng dấu phẩy" />
                </Form.Item>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Form.Item
                    label={<span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Thời lượng (phút)</span>}
                    name="duration_min"
                    rules={[{ required: true, message: 'Nhập thời lượng' }]}
                  >
                    <Input type="number" className="h-11 rounded-xl" placeholder="120" />
                  </Form.Item>

                  <Form.Item
                    label={<span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Đánh giá (0-10)</span>}
                    name="rating"
                  >
                    <Input type="number" step="0.1" className="h-11 rounded-xl" placeholder="8.5" />
                  </Form.Item>

                  <Form.Item
                    label={<span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ngày phát hành</span>}
                    name="release_date"
                  >
                    <Input type="date" className="h-11 rounded-xl" />
                  </Form.Item>

                  <Form.Item
                    label={<span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trạng thái</span>}
                    name="is_active"
                  >
                    <Select popupMatchSelectWidth className="[&_.ant-select-selector]:!h-11 [&_.ant-select-selector]:!rounded-xl [&_.ant-select-selector]:!px-3 [&_.ant-select-selection-item]:!leading-[44px]">
                      <Select.Option value={true}>Đang chiếu</Select.Option>
                      <Select.Option value={false}>Đã ẩn</Select.Option>
                    </Select>
                  </Form.Item>
                </div>

                <Form.Item
                  label={<span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Poster URL (tuỳ chọn)</span>}
                  name="cover_image"
                >
                  <Input className="h-11 rounded-xl" placeholder="https://..." />
                </Form.Item>

                <Form.Item
                  label={<span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Ảnh chi tiết (tuỳ chọn)</span>}
                  name="detail_images"
                >
                  <Input.TextArea className="rounded-xl" rows={3} placeholder="Mỗi dòng 1 URL hoặc phân cách bằng dấu phẩy" />
                </Form.Item>
              </div>
            </div>
          </>
        ) : editType === 'toy' ? (
          <>
            <Form.Item label="Tên" name="name" rules={[{ required: true, message: 'Vui lòng nhập tên' }]}>
              <Input />
            </Form.Item>
            <div className="grid grid-cols-2 gap-3">
              <Form.Item label="Phân loại" name="category">
                <Input />
              </Form.Item>
              <Form.Item label="Giá" name="price">
                <Input type="number" />
              </Form.Item>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Form.Item label="Tồn kho" name="stock">
                <Input type="number" />
              </Form.Item>
              <Form.Item label="Trạng thái" name="status">
                <Select>
                  <Select.Option value="active">Hoạt động</Select.Option>
                  <Select.Option value="inactive">Đã ẩn</Select.Option>
                </Select>
              </Form.Item>
            </div>
            <Form.Item label="Ảnh (URL)" name="image_url">
              <Input placeholder="https://..." />
            </Form.Item>
          </>
        ) : (
          <>
            <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Please enter name' }]}>
              <Input />
            </Form.Item>

            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Please enter email' },
                { type: 'email', message: 'Invalid email format' }
              ]}
            >
              <Input />
            </Form.Item>

            <Form.Item label="Role" name="role" rules={[{ required: true, message: 'Please select role' }]}>
              <Select>
                <Select.Option value="user">User</Select.Option>
                <Select.Option value="admin">Admin</Select.Option>
                <Select.Option value="viewer">Viewer</Select.Option>
              </Select>
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
}
