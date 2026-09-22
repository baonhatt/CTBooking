import { PaymentRequest } from '@shared/api';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const MAX_TICKET_PER_ORDER = 10;

export type BookingValidationResult = {
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
