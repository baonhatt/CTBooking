export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-\=\[\]{};':"\\|,.<>\/?]{6,}$/;

export const NAV_ITEMS = [
  { label: 'Phim', target: 'films' },
  { label: 'Giá vé', target: 'promotions' },
  { label: 'Công nghệ', target: 'technology' },
  { label: 'Cửa hàng', target: 'store' },
  { label: 'Bài viết', target: 'posts' }
] as any;

export const SECTION_IDS = ['hero', 'films', 'pricing', 'technology', 'promotions', 'store', 'posts'] as const;
