import { PaymentRequest } from '@shared/api';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const MAX_TICKET_PER_ORDER = 10;

/**
 * A quantity sent by the browser. Missing means 1. Anything that is not a whole number of at least 1
 * (text, NaN, decimals, zero, negatives) is refused instead of being quietly turned into a price of NaN.
 */
export function normalizeQuantity(value: unknown): number {
  const quantity = value === undefined || value === null || value === '' ? 1 : Number(value);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new HttpError(400, 'Số lượng không hợp lệ.');
  }
  return quantity;
}

export type BookingValidationResult = {
  /** The branch the order belongs to: the one asked for, or the default branch. Never empty. */
  branchId: number;
  user: {
    id: number | null;
    email: string;
    fullname?: string | null;
    phone?: string | null;
  };
  movies: any[];
  ticketPackage: any;
  unitPrice: number;
  movieTotalPrice: number;
  vrItemsDetails?: Array<{
    vr_package_id: number;
    quantity: number;
    unit_price: number;
    package_name: string;
    line_total: number;
    branch_id?: number | null;
  }>;
  vrTotalPrice: number;
  voucherDetails?: any;
  voucherDiscountAmount: number;
  originalTotalPrice: number;
  totalPrice: number;
  movieItemsDetails?: Array<{ package_id: number; quantity: number; price: number; name: string }>;
};
