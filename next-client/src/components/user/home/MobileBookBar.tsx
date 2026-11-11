'use client';

import { useEffect, useState } from 'react';
import { Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '@/store/cartStore';
import { scrollToElementId } from '@/lib/scroll';

// The section the button leads to; the films section is used when the branch has no ticket packages
const TARGET_IDS = ['promotions', 'films'];

function findTargetId(): string | undefined {
  return TARGET_IDS.find((id) => document.getElementById(id));
}

// Whether any of the sections with these ids is on the screen right now
function watchSections(ids: string[], onChange: (isVisible: boolean) => void): () => void {
  const visibleIds = new Set<string>();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) visibleIds.add(entry.target.id);
      else visibleIds.delete(entry.target.id);
    });
    onChange(visibleIds.size > 0);
  });
  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (element) observer.observe(element);
  });
  return () => observer.disconnect();
}

/**
 * On a phone, a "Đặt vé ngay" button stays at the bottom of the home page once the top of the page is behind the
 * customer. It hides while the hero (which has the same button) or the ticket section itself is on screen, and while the
 * cart is open. It leaves the right side free for the floating contact buttons.
 */
export default function MobileBookBar() {
  const { isOpen: isCartOpen } = useCart();
  const [isHeroVisible, setIsHeroVisible] = useState(true);
  const [isTargetVisible, setIsTargetVisible] = useState(false);

  useEffect(() => watchSections(['hero'], setIsHeroVisible), []);
  // Only the section the button leads to counts (the films section only when there is no ticket section)
  useEffect(() => {
    const targetId = findTargetId();
    return targetId ? watchSections([targetId], setIsTargetVisible) : undefined;
  }, []);

  const isShown = !isHeroVisible && !isTargetVisible && !isCartOpen;

  const handleClick = () => {
    const targetId = findTargetId();
    if (targetId) scrollToElementId(targetId);
  };

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 right-[5.5rem] z-[40] transition-all duration-300 sm:hidden',
        isShown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
      )}
      aria-hidden={!isShown}
    >
      <button
        type="button"
        tabIndex={isShown ? 0 : -1}
        onClick={handleClick}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 via-blue-600 to-fuchsia-500 text-sm font-bold text-white shadow-[0_8px_28px_rgba(37,99,235,0.45)] active:scale-95"
      >
        <Ticket className="h-4 w-4" />
        Đặt vé ngay
      </button>
    </div>
  );
}
