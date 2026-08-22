export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-\=\[\]{};':"\\|,.<>\/?]{6,}$/;

export const NAV_ITEMS = [
  { label: 'Phim', target: 'films' },
  { label: 'Lịch chiếu', target: 'schedule' },
  { label: 'Trải nghiệm VR', target: 'vr' },
  { label: 'Giá vé', target: 'promotions' },
  { label: 'Công nghệ', target: 'technology' },
  { label: 'Tin tức', target: 'posts' }
] as any;

export const SECTION_IDS = ['hero', 'films', 'vr', 'promotions', 'technology', 'store'] as const;
