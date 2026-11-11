import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { createToyApi, updateToyApi } from '@/lib/api';
import { AdminDialog, AdminDialogFooter } from '@/components/admin/common/AdminDialog';
import { ConfirmDialog } from '@/components/admin/common/ConfirmDialog';
import { FormField } from '@/components/admin/common/FormField';
import { notify } from '@/components/admin/common/notify';
import { ADMIN_INPUT, ADMIN_TEXT } from '@/components/admin/common/adminTokens';

export interface ToyEditModalProps {
  isEditOpen: boolean;
  setIsEditOpen: (open: boolean) => void;
  editData: any;
  setEditData: (data: any) => void;
  setToys: React.Dispatch<React.SetStateAction<any[]>>;
  onRefresh?: () => Promise<void>;
}

export const ToyEditModal: React.FC<ToyEditModalProps> = ({
  isEditOpen,
  setIsEditOpen,
  editData,
  setEditData,
  onRefresh
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [originalToyPrice, setOriginalToyPrice] = useState<number | null>(null);
  const [priceChanges, setPriceChanges] = useState<string[] | null>(null);

  useEffect(() => {
    if (isEditOpen && editData?.id) {
      setOriginalToyPrice(Number(editData.price || 0));
    } else {
      setOriginalToyPrice(null);
    }
  }, [isEditOpen, editData?.id]);

  useEffect(() => {
    if (!isEditOpen) {
      setIsDirty(false);
    }
  }, [isEditOpen]);

  const handleEditChange = (newData: any) => {
    setEditData(newData);
    setIsDirty(true);
  };

  // Called by AdminDialog after the user agreed to drop unsaved changes (or there were none)
  const handleClose = () => {
    setIsEditOpen(false);
    setIsDirty(false);
  };

  const executeSaveToy = async () => {
    try {
      setIsSaving(true);
      let imageBase64: string | undefined = undefined;
      if (editData.imageFile) {
        const file = editData.imageFile as File;
        imageBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(file);
        });
      }
      const payload = {
        name: editData.name,
        category: editData.category,
        price: Number(editData.price || 0),
        stock: Number(editData.stock || 0),
        status: editData.status,
        image_url: editData.image_url,
        image_base64: imageBase64
      };
      if (!editData.id || editData.id === 0) {
        await createToyApi(payload);
      } else {
        await updateToyApi(Number(editData.id), payload);
      }
      if (onRefresh) await onRefresh();
      if (editData.id) notify.saved('đồ chơi');
      else notify.created('đồ chơi');
      setPriceChanges(null);
      setIsDirty(false);
      setIsEditOpen(false);
    } catch (err: any) {
      notify.error(err, 'Lưu thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    const newPrice = Number(editData.price || 0);
    if (editData.id && originalToyPrice !== null && originalToyPrice !== newPrice) {
      setPriceChanges([
        `Giá sản phẩm: ${originalToyPrice.toLocaleString('vi-VN')}đ → ${newPrice.toLocaleString('vi-VN')}đ`
      ]);
      return;
    }
    await executeSaveToy();
  };

  return (
    <>
      <AdminDialog
        open={isEditOpen}
        onClose={handleClose}
        mode="form"
        size="md"
        dirty={isDirty}
        busy={isSaving}
        title={editData?.id ? 'Chỉnh sửa vật phẩm' : 'Thêm vật phẩm mới'}
        footer={
          <AdminDialogFooter
            onCancel={() => handleClose()}
            onSubmit={handleSubmit}
            submitText={editData?.id ? ADMIN_TEXT.save : ADMIN_TEXT.create}
            busy={isSaving}
          />
        }
      >
        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2">
          <FormField label="Tên đồ chơi" htmlFor="toy-name">
            <Input
              id="toy-name"
              value={editData?.name || ''}
              onChange={(e) => handleEditChange({ ...editData, name: e.target.value })}
              className={ADMIN_INPUT}
            />
          </FormField>
          <FormField label="Danh mục" htmlFor="toy-category">
            <Input
              id="toy-category"
              value={editData?.category || ''}
              onChange={(e) => handleEditChange({ ...editData, category: e.target.value })}
              className={ADMIN_INPUT}
            />
          </FormField>
          <FormField label="Giá" htmlFor="toy-price">
            <Input
              id="toy-price"
              type="number"
              min="0"
              step="1"
              value={editData?.price !== undefined && editData?.price !== null ? editData.price : ''}
              onChange={(e) => {
                const val = e.target.value;
                handleEditChange({ ...editData, price: val === '' ? '' : Number(val) });
              }}
              className={ADMIN_INPUT}
            />
          </FormField>
          <FormField label="Tồn kho" htmlFor="toy-stock">
            <Input
              id="toy-stock"
              type="number"
              min="0"
              step="1"
              value={editData?.stock !== undefined && editData?.stock !== null ? editData.stock : ''}
              onChange={(e) => {
                const val = e.target.value;
                handleEditChange({ ...editData, stock: val === '' ? '' : Number(val) });
              }}
              className={ADMIN_INPUT}
            />
          </FormField>
          <FormField label="Trạng thái" htmlFor="toy-status" className="md:col-span-2">
            <select
              id="toy-status"
              value={editData?.status || 'active'}
              onChange={(e) => handleEditChange({ ...editData, status: e.target.value })}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-all focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="active">{ADMIN_TEXT.active}</option>
              <option value="inactive">{ADMIN_TEXT.inactive}</option>
            </select>
          </FormField>
        </div>
      </AdminDialog>

      <ConfirmDialog
        open={!!priceChanges}
        onOpenChange={(open) => !open && !isSaving && setPriceChanges(null)}
        variant="warning"
        title="Xác nhận thay đổi giá sản phẩm"
        description={
          <span className="block">
            <span className="mb-3 block">
              Bạn đang thay đổi giá niêm yết của sản phẩm/bắp nước <strong>{editData?.name}</strong>:
            </span>
            <span className="mb-3 block space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
              {priceChanges?.map((change) => (
                <span key={change} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>{change}</span>
                </span>
              ))}
            </span>
            <span className="block text-xs italic text-slate-500">Giá mới sẽ có hiệu lực ngay lập tức.</span>
          </span>
        }
        confirmText="Xác nhận lưu"
        busy={isSaving}
        onConfirm={executeSaveToy}
      />
    </>
  );
};
