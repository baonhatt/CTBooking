import { API_BASE_URL, request } from './http';

// Thêm vào file api.ts hoặc tạo file riêng vietqr.ts

/**
 * Tạo QR Code thanh toán VietQR
 */
export interface CreateVietQRParams {
  accountNo: string;
  accountName: string;
  bankBin: string; // Mã ngân hàng (VD: 970436 cho Vietcombank)
  amount: number;
  description: string;
  template?: 'compact' | 'compact2' | 'print' | 'qr_only';
}

export const createVietQRCode = (params: CreateVietQRParams): string => {
  const { accountNo, accountName, bankBin, amount, description, template = 'compact2' } = params;

  // VietQR API URL
  const baseUrl = 'https://img.vietqr.io/image';
  const qrUrl = `${baseUrl}/${bankBin}-${accountNo}-${template}.png?amount=${amount}&addInfo=${encodeURIComponent(
    description
  )}&accountName=${encodeURIComponent(accountName)}`;

  return qrUrl;
};

/**
 * Kiểm tra trạng thái thanh toán qua backend
 */
export interface CheckPaymentStatusParams {
  bookingId: string;
  orderId: string;
}

export interface CheckPaymentStatusResponse {
  status: 'pending' | 'success' | 'failed';
  message?: string;
  transactionId?: string;
  paidAt?: string;
}

export const checkVietQRPaymentStatus = async (
  params: CheckPaymentStatusParams
): Promise<CheckPaymentStatusResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/payments/check-vietqr-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error('Không thể kiểm tra trạng thái thanh toán');
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking payment status:', error);
    throw error;
  }
};

/**
 * Xác nhận thanh toán thủ công (sau khi user nhấn "Tôi đã chuyển khoản")
 */
export interface ConfirmPaymentParams {
  bookingId: string;
  orderId: string;
  amount: number;
  bankTransactionId?: string; // Mã giao dịch từ ngân hàng (nếu có)
}

export const confirmVietQRPayment = async (params: ConfirmPaymentParams): Promise<CheckPaymentStatusResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/payments/confirm-vietqr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error('Không thể xác nhận thanh toán');
    }

    return await response.json();
  } catch (error) {
    console.error('Error confirming payment:', error);
    throw error;
  }
};

/**
 * Hủy thanh toán VietQR
 */
export const cancelVietQRPayment = async (bookingId: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/payments/cancel-vietqr/${bookingId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('authToken')}`
      }
    });

    if (!response.ok) {
      throw new Error('Không thể hủy thanh toán');
    }
  } catch (error) {
    console.error('Error canceling payment:', error);
    throw error;
  }
};

/**
 * Webhook handler để nhận thông báo từ ngân hàng (Backend only)
 * Frontend không cần implement, chỉ là reference
 */
export interface VietQRWebhookPayload {
  bookingId: string;
  orderId: string;
  amount: number;
  transactionId: string;
  bankCode: string;
  transactionDate: string;
  description: string;
  status: 'success' | 'failed';
}

// ============ USAGE EXAMPLE ============

/*
// 1. Tạo QR Code khi user chọn thanh toán VietQR
const qrCodeUrl = createVietQRCode({
  accountNo: "1234567890",
  accountName: "CONG TY CINESPHERE",
  bankBin: "970436", // Vietcombank
  amount: 150000,
  description: "CS172543883901",
  template: "compact2",
});

// 2. Kiểm tra trạng thái thanh toán (polling mỗi 5s)
const checkStatus = async () => {
  const status = await checkVietQRPaymentStatus({
    bookingId: "BOOKING123",
    orderId: "ORDER123456",
  });
  
  if (status.status === "success") {
    // Chuyển sang màn hình thành công
    navigate("/payment-success");
  }
};

// 3. Xác nhận thanh toán thủ công
const handleConfirmPayment = async () => {
  try {
    const result = await confirmVietQRPayment({
      bookingId: "BOOKING123",
      orderId: "ORDER123456",
      amount: 150000,
    });
    
    if (result.status === "success") {
      toast({ title: "Xác nhận thành công" });
    } else {
      toast({ title: "Đang chờ xác nhận từ ngân hàng" });
    }
  } catch (error) {
    toast({ title: "Lỗi", description: "Không thể xác nhận thanh toán" });
  }
};

// 4. Hủy thanh toán
const handleCancel = async () => {
  await cancelVietQRPayment("BOOKING123");
  navigate("/booking");
};
*/

// ============ BANK CODES REFERENCE ============

export const VIETNAM_BANKS = {
  VCB: { code: '970436', name: 'Vietcombank' },
  TCB: { code: '970407', name: 'Techcombank' },
  MB: { code: '970422', name: 'MBBank' },
  VIB: { code: '970441', name: 'VIB' },
  ACB: { code: '970416', name: 'ACB' },
  VPB: { code: '970432', name: 'VPBank' },
  TPB: { code: '970423', name: 'TPBank' },
  STB: { code: '970403', name: 'Sacombank' },
  HDB: { code: '970437', name: 'HDBank' },
  BIDV: { code: '970418', name: 'BIDV' },
  AGRI: { code: '970405', name: 'Agribank' },
  OCB: { code: '970448', name: 'OCB' },
  MSB: { code: '970426', name: 'MSB' },
  CAKE: { code: '546034', name: 'CAKE by VPBank' },
  UBANK: { code: '546035', name: 'Ubank by VPBank' },
  TIMO: { code: '963388', name: 'Timo by Ban Viet Bank' },
  VNMART: { code: '970457', name: 'VietinBank' },
  VIETBANK: { code: '970433', name: 'VietBank' },
  SHB: { code: '970443', name: 'SHB' },
  EIB: { code: '970431', name: 'Eximbank' },
  MSB_MOMO: { code: '970426', name: 'MSB (MoMo)' }
} as const;

export type BankCode = keyof typeof VIETNAM_BANKS;
