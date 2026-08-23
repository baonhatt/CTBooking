export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-\=\[\]{};':"\\|,.<>\/?]{6,}$/;

export const NAV_ITEMS = [
  { label: 'Phim', target: 'films' },
  { label: 'Giá vé', target: 'promotions' },
<<<<<<< HEAD
  { label: 'Công nghệ', target: 'technology' },
=======
  { label: 'Công nghệ', target: 'technology' }
>>>>>>> preview
] as any;

export const SECTION_IDS = ['hero', 'films', 'pricing', 'technology', 'promotions', 'posts'] as const;
