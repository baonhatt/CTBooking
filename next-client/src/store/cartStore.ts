'use client';

export interface CartItem {
  id: string; // Unique cart item ID (e.g. `movie_${packageId}` or `vr_${packageId}`)
  packageId: number;
  type: 'movie' | 'vr';
  name: string;
  price: number;
  quantity: number;
  selected: boolean;
  cover_image?: string;
  duration_min?: number;
  vr_genre?: string;
  movies?: any[];
  features?: string[];
  branchId?: number;
}

const STORAGE_KEY = 'cinesphere_cart_items';
const LISTENERS = new Set<() => void>();

function notifyListeners() {
  LISTENERS.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('Error in cart listener', e);
    }
  });
}

function getStoredItems(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading cart from localStorage', e);
    return [];
  }
}

function saveStoredItems(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('cinesphere-cart-updated'));
    notifyListeners();
  } catch (e) {
    console.error('Error saving cart to localStorage', e);
  }
}

let isCartDrawerOpen = false;

export const cartStore = {
  getItems(): CartItem[] {
    return getStoredItems();
  },

  getIsOpen(): boolean {
    return isCartDrawerOpen;
  },

  openCart() {
    isCartDrawerOpen = true;
    notifyListeners();
  },

  closeCart() {
    isCartDrawerOpen = false;
    notifyListeners();
  },

  toggleCart() {
    isCartDrawerOpen = !isCartDrawerOpen;
    notifyListeners();
  },

  addItem(item: Omit<CartItem, 'id' | 'selected'> & { selected?: boolean }) {
    const items = getStoredItems();
    const id = `${item.type}_${item.packageId}`;
    const existingIndex = items.findIndex((i) => i.id === id);

    let updated: CartItem[];
    if (existingIndex >= 0) {
      updated = items.map((i, idx) =>
        idx === existingIndex
          ? {
              ...i,
              quantity: Math.min(20, i.quantity + (item.quantity || 1)),
              selected: true, // auto select when added/updated
              price: item.price ?? i.price,
              name: item.name ?? i.name,
              cover_image: item.cover_image ?? i.cover_image,
              movies: item.movies ?? i.movies
            }
          : i
      );
    } else {
      updated = [
        ...items,
        {
          ...item,
          id,
          quantity: item.quantity || 1,
          selected: item.selected ?? true
        }
      ];
    }

    saveStoredItems(updated);
    return updated;
  },

  updateQuantity(id: string, quantity: number) {
    const items = getStoredItems();
    let updated: CartItem[];
    if (quantity <= 0) {
      updated = items.filter((i) => i.id !== id);
    } else {
      updated = items.map((i) => (i.id === id ? { ...i, quantity: Math.min(20, Math.max(1, quantity)) } : i));
    }
    saveStoredItems(updated);
    return updated;
  },

  removeItem(id: string) {
    const items = getStoredItems();
    const updated = items.filter((i) => i.id !== id);
    saveStoredItems(updated);
    return updated;
  },

  toggleSelect(id: string) {
    const items = getStoredItems();
    const updated = items.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i));
    saveStoredItems(updated);
    return updated;
  },

  selectAll(selected: boolean) {
    const items = getStoredItems();
    const updated = items.map((i) => ({ ...i, selected }));
    saveStoredItems(updated);
    return updated;
  },

  getSelectedItems(): CartItem[] {
    return getStoredItems().filter((i) => i.selected);
  },

  clearSelected() {
    const items = getStoredItems();
    const updated = items.filter((i) => !i.selected);
    saveStoredItems(updated);
    return updated;
  },

  clearAll() {
    saveStoredItems([]);
  },

  subscribe(listener: () => void) {
    LISTENERS.add(listener);
    if (typeof window !== 'undefined') {
      const handleStorage = (e: StorageEvent) => {
        if (e.key === STORAGE_KEY) listener();
      };
      const handleCustom = () => listener();
      window.addEventListener('storage', handleStorage);
      window.addEventListener('cinesphere-cart-updated', handleCustom);

      return () => {
        LISTENERS.delete(listener);
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener('cinesphere-cart-updated', handleCustom);
      };
    }
    return () => {
      LISTENERS.delete(listener);
    };
  }
};

import { useState, useEffect } from 'react';

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setItems(cartStore.getItems());
    setIsOpen(cartStore.getIsOpen());

    const unsubscribe = cartStore.subscribe(() => {
      setItems(cartStore.getItems());
      setIsOpen(cartStore.getIsOpen());
    });

    return unsubscribe;
  }, []);

  const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const selectedItems = items.filter((item) => item.selected);
  const selectedCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const selectedSubtotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const isAllSelected = items.length > 0 && items.every((item) => item.selected);

  const movieItems = selectedItems.filter((item) => item.type === 'movie');
  const vrItems = selectedItems.filter((item) => item.type === 'vr');
  const movieSubtotal = movieItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const vrSubtotal = vrItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return {
    items,
    isOpen,
    totalItemsCount,
    selectedItems,
    selectedCount,
    selectedSubtotal,
    isAllSelected,
    movieItems,
    vrItems,
    movieSubtotal,
    vrSubtotal,
    openCart: cartStore.openCart,
    closeCart: cartStore.closeCart,
    toggleCart: cartStore.toggleCart,
    addItem: cartStore.addItem,
    updateQuantity: cartStore.updateQuantity,
    removeItem: cartStore.removeItem,
    toggleSelect: cartStore.toggleSelect,
    selectAll: cartStore.selectAll,
    clearSelected: cartStore.clearSelected,
    clearAll: cartStore.clearAll
  };
}
