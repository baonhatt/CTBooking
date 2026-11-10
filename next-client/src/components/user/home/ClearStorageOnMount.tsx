'use client';

import { useEffect } from 'react';

export default function ClearStorageOnMount() {
  useEffect(() => {
    try {
      // Only the unpaid draft goes. The last paid order stays (for a day, the result page checks) so a refresh or a
      // trip to the home page does not lose the ticket code.
      localStorage.removeItem('pendingOrder');
    } catch {}
  }, []);

  return null;
}
