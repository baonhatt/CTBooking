import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface UseConfirmUnsavedProps {
  isDirty: boolean;
  isSubmitting?: boolean;
  onConfirmClose: () => void;
}

export function useConfirmUnsaved({ isDirty, isSubmitting = false, onConfirmClose }: UseConfirmUnsavedProps) {
  const [showAlert, setShowAlert] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (isSubmitting) return; // Không đóng modal nếu đang lưu
      
      if (isDirty) {
        setShowAlert(true);
      } else {
        onConfirmClose();
      }
    }
  };

  const UnsavedAlert = () => (
    <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
      <AlertDialogContent className="z-[9999] rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-slate-900">Thay đổi chưa được lưu</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-500">
            Bạn đang có những thay đổi dở dang. Nếu thoát bây giờ, các nội dung vừa nhập sẽ bị mất. Bạn có chắc muốn thoát?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel className="rounded-xl" onClick={() => setShowAlert(false)}>
            Tiếp tục chỉnh sửa
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium"
            onClick={() => {
              setShowAlert(false);
              onConfirmClose();
            }}
          >
            Đồng ý thoát
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { handleOpenChange, UnsavedAlert };
}
