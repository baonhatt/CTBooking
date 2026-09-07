import React from 'react';
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

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function ConfirmDeleteDialog({
  isOpen,
  onOpenChange,
  title = 'Xác nhận xóa',
  description,
  confirmText = 'Xóa',
  cancelText = 'Hủy',
  onConfirm,
  isDeleting = false,
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl max-w-md font-sans bg-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-slate-900 text-lg font-bold">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-600 text-sm mt-2 text-left">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel
            disabled={isDeleting}
            className="text-slate-500 hover:bg-slate-100 border-none rounded-xl"
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 min-w-[100px] rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95 text-white"
          >
            {isDeleting ? 'Đang xử lý...' : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
