import { toast } from 'sonner';

// One place for every admin toast so wording and layout stay the same.
// Success: short title (what happened). Error: "Lỗi" + reason in the description.

export const notify = {
  success(title: string, description?: string) {
    toast.success(title, description ? { description } : undefined);
  },
  error(error: unknown, fallback = 'Đã có lỗi xảy ra, vui lòng thử lại') {
    const reason = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
    toast.error('Lỗi', { description: reason || fallback });
  },
  warning(title: string, description?: string) {
    toast.warning(title, description ? { description } : undefined);
  },
  info(title: string, description?: string) {
    toast.info(title, description ? { description } : undefined);
  },
  // Standard sentences: notify.saved('chi nhánh') -> "Đã lưu chi nhánh"
  saved: (name: string) => toast.success(`Đã lưu ${name}`),
  created: (name: string) => toast.success(`Đã tạo ${name}`),
  deleted: (name: string) => toast.success(`Đã xóa ${name}`),
  restored: (name: string) => toast.success(`Đã khôi phục ${name}`),
  copied: (name: string) => toast.success(`Đã sao chép ${name}`),
};
