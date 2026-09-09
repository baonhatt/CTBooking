'use client';

import { useEffect } from 'react';

export default function ClearStorageOnMount() {
  useEffect(() => {
    try {
      localStorage.removeItem('pendingOrder');
      localStorage.removeItem('lastCheckoutOrder');

    } catch {}
  }, []);

  return null;
}
