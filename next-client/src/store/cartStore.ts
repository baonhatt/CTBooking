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
const DRAWER_LISTENERS = new Set<(isOpen: boolean) => void>();

let memoryItemsCache: CartItem[] | null = null;
let isCartDrawerOpen = false;
let lastDrawerActionTime = 0;
const DRAWER_COOLDOWN_MS = 250;

function notifyListeners() {
  LISTENERS.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('Error in cart listener', e);
    }
  });
}

function notifyDrawerListeners(isOpen: boolean) {
  DRAWER_LISTENERS.forEach((listener) => {
    try {
      listener(isOpen);
    } catch (e) {
      console.error('Error in drawer listener', e);
    }
  });
}

function getStoredItems(): CartItem[] {
  if (memoryItemsCache !== null) {
    return memoryItemsCache;
  }
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      memoryItemsCache = [];
      return [];
    }
    const parsed = JSON.parse(raw);
    memoryItemsCache = Array.isArray(parsed) ? parsed : [];
    return memoryItemsCache;
  } catch (e) {
    console.error('Error reading cart from localStorage', e);
    memoryItemsCache = [];
    return [];
  }
}

function saveStoredItems(items: CartItem[]) {
  memoryItemsCache = items;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('cinesphere-cart-updated'));
    notifyListeners();
  } catch (e) {
    console.error('Error saving cart to localStorage', e);
  }
}

export const cartStore = {
  getItems(): CartItem[] {
    return getStoredItems();
  },

  getIsOpen(): boolean {
    return isCartDrawerOpen;
  },

  openCart() {
    const now = Date.now();
    if (now - lastDrawerActionTime < DRAWER_COOLDOWN_MS && isCartDrawerOpen) return;
    lastDrawerActionTime = now;
    if (!isCartDrawerOpen) {
      isCartDrawerOpen = true;
      notifyDrawerListeners(true);
    }
  },

  closeCart() {
    const now = Date.now();
    if (now - lastDrawerActionTime < DRAWER_COOLDOWN_MS && !isCartDrawerOpen) return;
    lastDrawerActionTime = now;
    if (isCartDrawerOpen) {
      isCartDrawerOpen = false;
      notifyDrawerListeners(false);
    }
  },

  toggleCart() {
    const now = Date.now();
    if (now - lastDrawerActionTime < DRAWER_COOLDOWN_MS) return;
    lastDrawerActionTime = now;
    isCartDrawerOpen = !isCartDrawerOpen;
    notifyDrawerListeners(isCartDrawerOpen);
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
        if (e.key === STORAGE_KEY) {
          memoryItemsCache = null;
          listener();
        }
      };
      const handleCustom = () => {
        listener();
      };
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
  },

  subscribeDrawer(listener: (isOpen: boolean) => void) {
    DRAWER_LISTENERS.add(listener);
    return () => {
      DRAWER_LISTENERS.delete(listener);
    };
  }
};

import { useState, useEffect } from 'react';

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setItems(cartStore.getItems());
    setIsOpen(cartStore.getIsOpen());

    const unsubscribeItems = cartStore.subscribe(() => {
      setItems(cartStore.getItems());
    });

    const unsubscribeDrawer = cartStore.subscribeDrawer((open) => {
      setIsOpen(open);
    });

    return () => {
      unsubscribeItems();
      unsubscribeDrawer();
    };
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
    isMounted,
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
