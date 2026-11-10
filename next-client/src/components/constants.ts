export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-\=\[\]{};':"\\|,.<>\/?]{6,}$/;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shown under every "new password" field before the customer types
export const PASSWORD_RULE_TEXT = 'Ít nhất 6 ký tự, gồm cả chữ và số';

// Login, register, OTP and forgot-password dialogs: a bottom sheet on a phone (it scrolls when the keyboard takes
// room), the usual centered dialog from the sm breakpoint up
export const AUTH_DIALOG_CLASS =
  'max-sm:top-auto max-sm:bottom-0 max-sm:translate-y-0 max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:max-h-[92dvh] max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]';

export const NAV_ITEMS = [
  { label: 'Phim', target: 'films' },
  { label: 'Giá vé', target: 'promotions' },
  { label: 'Trải nghiệm VR', target: 'vr' },
  { label: 'Lịch chiếu', target: 'schedule' },
  { label: 'Công nghệ', target: 'technology' },
  { label: 'Tin tức', target: 'posts' },
] as any;

export const SECTION_IDS = ['hero', 'films', 'promotions', 'vr', 'schedule', 'technology', 'store'] as const;
