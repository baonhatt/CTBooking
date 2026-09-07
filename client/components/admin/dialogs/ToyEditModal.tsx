import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { createToyApi, updateToyApi } from '@/lib/api';

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
  setToys,
  onRefresh
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [originalToyPrice, setOriginalToyPrice] = useState<number | null>(null);
  const [confirmSaveData, setConfirmSaveData] = useState<{ changes: string[]; onConfirm: () => Promise<void> } | null>(null);

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
            {editData?.id ? 'Chỉnh sửa vật phẩm' : 'Thêm vật phẩm mới'}
          </DialogTitle>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <div className="flex flex-col h-full overflow-hidden bg-white">
          <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin scrollbar-thumb-slate-200 grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
            <div>
              <Label className="text-sm font-medium text-gray-900 mb-2 block" htmlFor="toy-name">
                Tên đồ chơi
              </Label>
              <Input
                id="toy-name"
                value={editData?.name || ''}
                onChange={(e) => handleEditChange({ ...editData, name: e.target.value })}
                className="h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-900 mb-2 block" htmlFor="toy-category">
                Danh mục
              </Label>
              <Input
                id="toy-category"
                value={editData?.category || ''}
                onChange={(e) => handleEditChange({ ...editData, category: e.target.value })}
                className="h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 col-span-1 md:col-span-2">
              <div>
                <Label className="text-sm font-medium text-gray-900 mb-2 block" htmlFor="toy-price">
                  Giá
                </Label>
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
                  className="h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-900 mb-2 block" htmlFor="toy-stock">
                  Tồn kho
                </Label>
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
                  className="h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
                />
              </div>
            </div>
            <div className="col-span-1 md:col-span-2">
              <Label className="text-sm font-medium text-gray-900 mb-2 block" htmlFor="toy-status">
                Trạng thái
              </Label>
              <select
                id="toy-status"
                value={editData?.status || 'active'}
                onChange={(e) => handleEditChange({ ...editData, status: e.target.value })}
                className="w-full h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
              >
                <option value="active">Hoạt động</option>
                <option value="inactive">Đã ẩn</option>
              </select>
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
                const executeSaveToy = async () => {
                  try {
                    setIsSaving(true);
                    let imageBase64: string | undefined = undefined;
                    if (editData.imageFile) {
                      const file = editData.imageFile as File;
                      imageBase64 = await new Promise<string>((resolve) => {
                        const r = new FileReader();
                        r.onload = () => resolve(String(r.result));
                        r.readAsDataURL(file);
                      });
                    }
                    if (!editData.id || editData.id === 0) {
                      await createToyApi({
                        name: editData.name,
                        category: editData.category,
                        price: Number(editData.price || 0),
                        stock: Number(editData.stock || 0),
                        status: editData.status,
                        image_url: editData.image_url,
                        image_base64: imageBase64
                      });
                    } else {
                      await updateToyApi(Number(editData.id), {
                        name: editData.name,
                        category: editData.category,
                        price: Number(editData.price || 0),
                        stock: Number(editData.stock || 0),
                        status: editData.status,
                        image_url: editData.image_url,
                        image_base64: imageBase64
                      });
                    }
                    if (onRefresh) await onRefresh();
                    toast.success('Thành công', {
                      description: editData.id ? 'Cập nhật đồ chơi thành công' : 'Thêm đồ chơi mới thành công'
                    });
                    setConfirmSaveData(null);
                    setIsDirty(false);
                    setIsEditOpen(false);
                  } catch (err: any) {
                    toast.error(err.message || 'Lưu thất bại');
                  } finally {
                    setIsSaving(false);
                  }
                };

                const newPrice = Number(editData.price || 0);
                if (editData.id && originalToyPrice !== null && originalToyPrice !== newPrice) {
                  const changes = [
                    `Giá sản phẩm: ${originalToyPrice.toLocaleString('vi-VN')}đ → ${newPrice.toLocaleString('vi-VN')}đ`
                  ];
                  setConfirmSaveData({ changes, onConfirm: executeSaveToy });
                  return;
                }

                await executeSaveToy();
              }}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...
                </span>
              ) : (
                'Lưu'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={!!confirmSaveData} onOpenChange={(open) => !open && setConfirmSaveData(null)}>
        <AlertDialogContent className="rounded-2xl font-sans bg-white max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Xác nhận thay đổi giá sản phẩm
            </AlertDialogTitle>
            <AlertDialogDescription asChild className="text-slate-600 text-sm mt-2">
              <div>
                <p className="mb-3">
                  Bạn đang thay đổi thông tin giá niêm yết của sản phẩm/bắp nước <strong>{editData?.name}</strong>:
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
                  Giá mới sẽ có hiệu lực ngay lập tức.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="rounded-xl border-slate-200">Hủy bỏ</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              onClick={() => confirmSaveData && confirmSaveData.onConfirm()}
              className="rounded-xl text-white bg-amber-600 hover:bg-amber-700 font-medium"
            >
              {isSaving ? 'Đang lưu...' : 'Xác nhận lưu'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
