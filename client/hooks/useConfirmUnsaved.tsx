import React, { useState } from 'react';
import { ConfirmDialog } from '@/components/admin/common/ConfirmDialog';

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
    <ConfirmDialog
      open={showAlert}
      onOpenChange={setShowAlert}
      variant="warning"
      title="Thay đổi chưa được lưu"
      description="Bạn đang có thay đổi chưa lưu. Nếu thoát bây giờ, nội dung vừa nhập sẽ bị mất."
      cancelText="Tiếp tục chỉnh sửa"
      confirmText="Thoát, bỏ thay đổi"
      onConfirm={() => {
        setShowAlert(false);
        onConfirmClose();
      }}
    />
  );

  return { handleOpenChange, UnsavedAlert };
}
