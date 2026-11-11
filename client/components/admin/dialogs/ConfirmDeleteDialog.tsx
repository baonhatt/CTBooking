import React from 'react';
import { ConfirmDialog } from '@/components/admin/common/ConfirmDialog';

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  isDeleting?: boolean;
  // Disables the confirm button (for example when the server would refuse the delete anyway)
  confirmDisabled?: boolean;
}

// Kept for existing callers; it is now a thin wrapper over the shared ConfirmDialog (danger variant).
export function ConfirmDeleteDialog({ isOpen, isDeleting = false, ...rest }: ConfirmDeleteDialogProps) {
  return (
    <ConfirmDialog
      open={isOpen}
      variant="danger"
      busy={isDeleting}
      onOpenChange={rest.onOpenChange}
      title={rest.title}
      description={rest.description}
      confirmText={rest.confirmText}
      cancelText={rest.cancelText}
      onConfirm={rest.onConfirm}
      confirmDisabled={rest.confirmDisabled}
    />
  );
}
