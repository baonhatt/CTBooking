/**
 * Shared booking invoice helpers — parse multi-package film JSON,
 * decide which lines get voucher badges, and build price breakdown.
 * Source of truth: qr-payment display logic.
 */

export type VoucherScope = 'movie' | 'vr' | 'all' | string;

export type MoviePackageLine = {
  package_id?: number;
  name: string;
  quantity: number;
  price: number;
};

export type VrLineLike = {
  line_total?: number | string | null;
  unit_price?: number | string | null;
  quantity?: number | string | null;
  vr_ticket_package_id?: number | string | null;
  vr_package_id?: number | string | null;
  package_name?: string | null;
  name?: string | null;
};

export type ParseMoviePackagesFallback = {
  quantity?: number;
  price?: number;
  name?: string;
};

export function parseApplicableIds(raw: unknown): number[] {
  if (raw == null || raw === '') return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id));
  } catch {
    return [];
  }
}

export function parseMoviePackages(
  raw: unknown,
  fallback?: ParseMoviePackagesFallback
): MoviePackageLine[] {
  const fallbackName = fallback?.name || (typeof raw === 'string' && raw && !String(raw).startsWith('[') ? String(raw) : 'Vé xem phim');
  const fallbackQty = Number(fallback?.quantity || 1) || 1;
  const fallbackPrice = Number(fallback?.price || 0) || 0;

  if (raw == null || raw === '') {
    return [{ name: fallbackName, quantity: fallbackQty, price: fallbackPrice }];
  }

  if (Array.isArray(raw)) {
    return normalizeMoviePackageArray(raw, fallbackName, fallbackQty, fallbackPrice);
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return normalizeMoviePackageArray(parsed, fallbackName, fallbackQty, fallbackPrice);
        }
      } catch {
        /* fall through */
      }
    }
    return [
      {
        name: trimmed || fallbackName,
        quantity: fallbackQty,
        price: fallbackPrice
      }
    ];
  }

  if (typeof raw === 'object' && raw !== null && 'name' in (raw as object)) {
    return normalizeMoviePackageArray([raw], fallbackName, fallbackQty, fallbackPrice);
  }

  return [{ name: fallbackName, quantity: fallbackQty, price: fallbackPrice }];
}

function normalizeMoviePackageArray(
  arr: any[],
  fallbackName: string,
  fallbackQty: number,
  fallbackPrice: number
): MoviePackageLine[] {
  return arr.map((p) => {
    const quantity = Number(p?.quantity ?? fallbackQty) || 1;
    const price = Number(p?.price ?? fallbackPrice) || 0;
    const packageId = p?.package_id != null ? Number(p.package_id) : undefined;
    return {
      package_id: Number.isFinite(packageId as number) ? packageId : undefined,
      name: String(p?.name || fallbackName),
      quantity,
      price
    };
  });
}

export function moviePackagesTotalQty(packages: MoviePackageLine[]): number {
  return packages.reduce((sum, p) => sum + Number(p.quantity || 1), 0);
}

export function moviePackageLineTotal(pkg: MoviePackageLine): number {
  return Number(pkg.price * pkg.quantity || pkg.price || 0);
}

export function vrLineTotal(it: VrLineLike): number {
  return Number(it.line_total || Number(it.unit_price || 0) * Number(it.quantity || 0) || 0);
}

export function vrPackageId(it: VrLineLike): number | undefined {
  const id = it.vr_ticket_package_id ?? it.vr_package_id;
  if (id == null) return undefined;
  const n = Number(id);
  return Number.isFinite(n) ? n : undefined;
}

export function isLineDiscounted(args: {
  discountAmount: number;
  scope?: VoucherScope | null;
  applicableIds: number[];
  kind: 'movie' | 'vr';
  packageId?: number | null;
}): boolean {
  const { discountAmount, scope, applicableIds, kind, packageId } = args;
  if (!(Number(discountAmount) > 0)) return false;
  if (packageId == null || !Number.isFinite(Number(packageId))) return false;
  const effectiveScope = scope || 'all';
  if (effectiveScope !== 'all' && effectiveScope !== kind) return false;
  const id = Number(packageId);
  return applicableIds.length === 0 || applicableIds.includes(id);
}

export type VrItemForAllocation = {
  vr_package_id: number;
  quantity: number;
  unit_price: number;
  package_name?: string;
  line_total?: number;
  branch_id?: number | null;
};

export type AllocatedVrItem = {
  vr_ticket_package_id: number;
  quantity: number;
  unit_price: number;
  package_name?: string;
  branch_id?: number | null;
  discounted_unit_price: number;
  line_total: number;
  voucher_discount_amount: number;
};

export type MovieItemForAllocation = {
  package_id?: number;
  quantity?: number;
  price?: number;
};

export function allocateVoucherDiscountToVrItems(args: {
  vrItems: VrItemForAllocation[];
  movieItems?: MovieItemForAllocation[];
  voucherScope?: VoucherScope | null;
  applicablePackageIds?: number[];
  voucherDiscountAmount: number;
}): AllocatedVrItem[] {
  const { vrItems, movieItems = [], voucherScope, applicablePackageIds = [], voucherDiscountAmount } = args;
  const scope = (voucherScope || 'all') as VoucherScope;
  const applicableIds = applicablePackageIds || [];
  const discountTotal = Math.max(0, Number(voucherDiscountAmount || 0));

  const fallback: AllocatedVrItem[] = vrItems.map((item) => {
    const rawTotal = Math.round(Number(item.unit_price || 0) * Number(item.quantity || 1));
    return {
      vr_ticket_package_id: item.vr_package_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      package_name: item.package_name,
      branch_id: item.branch_id ?? null,
      discounted_unit_price: item.unit_price,
      line_total: rawTotal,
      voucher_discount_amount: 0
    };
  });

  if (discountTotal <= 0 || vrItems.length === 0 || scope === 'movie') {
    return fallback;
  }

  const isVrEligible = (pkgId: number) => applicableIds.length === 0 || applicableIds.includes(Number(pkgId));
  const isMovieEligible = (pkgId?: number) => pkgId != null && (applicableIds.length === 0 || applicableIds.includes(Number(pkgId)));

  let vrEligibleSubtotal = 0;
  for (const it of vrItems) {
    if (isVrEligible(it.vr_package_id)) {
      vrEligibleSubtotal += Math.round(Number(it.unit_price || 0) * Number(it.quantity || 1));
    }
  }

  if (vrEligibleSubtotal <= 0) {
    return fallback;
  }

  let movieEligibleSubtotal = 0;
  if (scope === 'all') {
    for (const m of movieItems) {
      if (isMovieEligible(m.package_id)) {
        movieEligibleSubtotal += Math.round(Number(m.price || 0) * Number(m.quantity || 1));
      }
    }
  }

  const combinedEligibleSubtotal = vrEligibleSubtotal + movieEligibleSubtotal;
  if (combinedEligibleSubtotal <= 0) {
    return fallback;
  }

  let vrPortionDiscount = discountTotal;
  if (scope === 'all') {
    vrPortionDiscount = Math.min(
      vrEligibleSubtotal,
      Math.round((vrEligibleSubtotal / combinedEligibleSubtotal) * discountTotal)
    );
  } else {
    vrPortionDiscount = Math.min(vrEligibleSubtotal, discountTotal);
  }

  const eligibleIndices: number[] = [];
  vrItems.forEach((it, idx) => {
    if (isVrEligible(it.vr_package_id)) eligibleIndices.push(idx);
  });

  let allocatedVrDiscount = 0;
  const itemDiscounts: number[] = new Array(vrItems.length).fill(0);

  eligibleIndices.forEach((itemIdx, pos) => {
    const it = vrItems[itemIdx];
    const rawLineTotal = Math.round(Number(it.unit_price || 0) * Number(it.quantity || 1));
    const isLast = pos === eligibleIndices.length - 1;

    let itemDisc = 0;
    if (isLast) {
      itemDisc = Math.max(0, vrPortionDiscount - allocatedVrDiscount);
    } else {
      itemDisc = Math.round((rawLineTotal / vrEligibleSubtotal) * vrPortionDiscount);
    }
    itemDisc = Math.min(itemDisc, rawLineTotal);
    itemDiscounts[itemIdx] = itemDisc;
    allocatedVrDiscount += itemDisc;
  });

  return vrItems.map((item, idx) => {
    const rawTotal = Math.round(Number(item.unit_price || 0) * Number(item.quantity || 1));
    const disc = itemDiscounts[idx] || 0;
    const finalLineTotal = Math.max(0, rawTotal - disc);
    const qty = Math.max(1, Number(item.quantity || 1));
    const discUnitPrice = Math.round((finalLineTotal / qty) * 100) / 100;

    return {
      vr_ticket_package_id: item.vr_package_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      package_name: item.package_name,
      branch_id: item.branch_id ?? null,
      discounted_unit_price: discUnitPrice,
      line_total: finalLineTotal,
      voucher_discount_amount: disc
    };
  });
}

export function voucherScopeLabel(scope?: VoucherScope | null): string {
  if (scope === 'vr') return 'Giảm giá (gói VR)';
  if (scope === 'movie') return 'Giảm giá (gói Phim)';
  return 'Giảm giá (toàn đơn)';
}

export function buildPriceBreakdown(args: {
  originalTotal: number;
  vrItems?: VrLineLike[] | null;
  discountAmount?: number;
  scope?: VoucherScope | null;
}): {
  movieSubtotal: number;
  vrSubtotal: number;
  discountAmount: number;
  voucherLabel: string;
  scope: VoucherScope;
} {
  const vrItems = args.vrItems || [];
  const vrSubtotal = vrItems.reduce((sum, it) => sum + vrLineTotal(it), 0);
  const originalTotal = Number(args.originalTotal || 0);
  const movieSubtotal = Math.max(0, originalTotal - vrSubtotal);
  const scope = (args.scope || 'all') as VoucherScope;
  const discountAmount = Number(args.discountAmount || 0);

  return {
    movieSubtotal,
    vrSubtotal,
    discountAmount,
    voucherLabel: voucherScopeLabel(scope),
    scope
  };
}

export function hasVrContent(bookingType?: string | null, vrItems?: unknown[] | null): boolean {
  return (
    bookingType === 'vr' ||
    bookingType === 'combo_vr' ||
    (Array.isArray(vrItems) && vrItems.length > 0)
  );
}

export function bookingTypeBadge(bookingType?: string | null, vrItems?: unknown[] | null): 'Phim' | 'VR' | 'Combo' {
  const hasVr = Array.isArray(vrItems) && vrItems.length > 0;
  if (bookingType === 'combo_vr') return 'Combo';
  if (bookingType === 'vr') return 'VR';
  if (hasVr && (bookingType === 'movie' || !bookingType)) return 'Combo';
  if (hasVr) return 'VR';
  return 'Phim';
}
