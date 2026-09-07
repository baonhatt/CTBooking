import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Lock, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export interface UserEditModalProps {
  isEditOpen: boolean;
  setIsEditOpen: (open: boolean) => void;
  editData: any;
  setEditData: (data: any) => void;
  setUsers: React.Dispatch<React.SetStateAction<any[]>>;
}

export const UserEditModal: React.FC<UserEditModalProps> = ({
  isEditOpen,
  setIsEditOpen,
  editData,
  setEditData,
  setUsers
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

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
      <DialogContent className="[&>button]:hidden bg-slate-50 border-0 overflow-hidden flex flex-col max-w-2xl p-0">
        <DialogHeader className="px-6 py-4 bg-white border-b flex-row justify-between items-center shrink-0">
          <DialogTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            Chỉnh sửa tài khoản người dùng
          </DialogTitle>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <div className="flex flex-col h-full overflow-hidden bg-white">
          <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin scrollbar-thumb-slate-200">
            {/* THÔNG TIN BẢO MẬT & ID */}
            <div className="bg-slate-50 p-4 border rounded-xl mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">MÃ TÀI KHOẢN (ID)</p>
                <div className="font-mono bg-white px-2 py-1 border rounded inline-block text-slate-700 text-sm">
                  #{editData?.id || '---'}
                </div>
              </div>

              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                <Lock className="w-4 h-4" />
                <p className="text-xs font-medium">Bảo mật: Mật khẩu đã được mã hóa, không thể xem trước.</p>
              </div>
            </div>

            {/* THÔNG TIN CÁ NHÂN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
              <div className="md:col-span-2">
                <Label className="text-sm font-medium text-gray-900 mb-2 block" htmlFor="user-name">
                  Họ và tên
                </Label>
                <Input
                  id="user-name"
                  value={editData?.fullname || ''}
                  onChange={(e) => handleEditChange({ ...editData, fullname: e.target.value })}
                  className="h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-900 mb-2 block" htmlFor="user-email">
                  Email
                </Label>
                <Input
                  id="user-email"
                  type="email"
                  value={editData?.email || ''}
                  onChange={(e) => handleEditChange({ ...editData, email: e.target.value })}
                  className="h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-900 mb-2 block" htmlFor="user-phone">
                  SĐT
                </Label>
                <Input
                  id="user-phone"
                  value={editData?.phone || ''}
                  onChange={(e) => handleEditChange({ ...editData, phone: e.target.value })}
                  className="h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
                />
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
                try {
                  setIsSaving(true);
                  // Original code mock logic:
                  setUsers((prev) => prev.map((u) => (u.id === editData?.id ? { ...u, ...editData } : u)));
                  toast.success('Thành công', {
                    description: 'Cập nhật người dùng thành công'
                  });
                  setIsEditOpen(false);
                  setIsDirty(false);
                } catch (e: any) {
                  toast.error('Lỗi', {
                    description: e?.message || 'Có lỗi xảy ra'
                  });
                } finally {
                  setIsSaving(false);
                }
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
    </Dialog>
  );
};
