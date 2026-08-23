// import crypto from "crypto";
import { formatDateForDb } from '../../../server/lib/date-utils';

async function hmacSHA512(key: string, data: string) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const msgData = encoder.encode(data);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function sortObject(obj: Record<string, any>) {
  const sorted: Record<string, any> = {};
  const keys = Object.keys(obj).sort();
  for (const k of keys) sorted[k] = obj[k];
  return sorted;
}

function formatVnpayDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

const VNP_TMNCODE = process.env.VITE_VNPAY_TMN_CODE || '';
const VNP_HASH_SECRET = process.env.VITE_VNPAY_HASH_SECRET || '';
const VNP_GATEWAY = process.env.VITE_VNPAY_GATEWAY || '';
const VNP_RETURN_URL = '';

<<<<<<< HEAD
export async function createVnpayPaymentImpl(
  payload: {
    amount: number;
    orderId: string;
    orderInfo: string;
    locale?: string;
    tmnCode?: string;
    hashSecret?: string;
    returnUrl?: string;
    ip?: string;
    gateway?: string;
  }
) {
=======
export async function createVnpayPaymentImpl(payload: {
  amount: number;
  orderId: string;
  orderInfo: string;
  locale?: string;
  tmnCode?: string;
  hashSecret?: string;
  returnUrl?: string;
  ip?: string;
  gateway?: string;
}) {
>>>>>>> preview
  const { amount, orderId, orderInfo, locale = 'vn' } = payload;
  if (!amount || !orderId || !orderInfo) {
    return { status: 400, message: 'Invalid payload' };
  }
  const tmnCode = payload.tmnCode || VNP_TMNCODE || '';
  const hashSecret = payload.hashSecret || VNP_HASH_SECRET || '';
  const returnUrl = payload.returnUrl || VNP_RETURN_URL || '';
  const gateway = payload.gateway || VNP_GATEWAY || '';
  if (!tmnCode || !hashSecret || !returnUrl || !gateway) {
    return { status: 500, message: 'VNPay configuration missing' };
  }
  const vnp_TxnRef = orderId;
  const vnp_Version = '2.1.0';
  const vnp_Command = 'pay';
  const vnp_CreateDate = new Date();
  const vnp_IpAddr = payload.ip || '127.0.0.1';
  const vnp_Amount = amount * 100;
  const params: Record<string, any> = {
    vnp_Version,
    vnp_Command,
    vnp_TmnCode: tmnCode,
    vnp_Locale: locale,
    vnp_CurrCode: 'VND',
    vnp_TxnRef,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: 'other',
    vnp_Amount,
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr,
    vnp_CreateDate: formatVnpayDate(vnp_CreateDate)
  };
  const sorted = sortObject(params);
  const signData = new URLSearchParams(sorted).toString();
  // const hmac = crypto.createHmac("sha512", hashSecret);
  // const vnp_SecureHash = hmac.update(signData).digest("hex");
  const vnp_SecureHash = await hmacSHA512(hashSecret, signData);
  const query = new URLSearchParams({ ...sorted, vnp_SecureHash }).toString();
  const payUrl = `${gateway}?${query}`;
  return { status: 200, payUrl };
}

export async function vnpayIpnImpl() {
  return { result: true };
}
