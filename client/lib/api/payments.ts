import { request } from "./http";

export async function createMomoPaymentApi(body: {
  partnerCode: string;
  partnerName: string;
  storeId: string;
  requestId: string;
  amount: number;
  orderId: string;
  orderInfo: string;
  redirectUrl: string;
  ipnUrl: string;
  lang?: any;
  extraData?: any;
  requestType: string;
  signature: string;
}) {
  return request<{ payUrl: string }>("/api/momo/create-payment", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createVnpayPaymentApi(body: {
  amount: number;
  orderId: string;
  orderInfo: string;
  locale?: string;
  tmnCode?: string;
  hashSecret?: string;
  returnUrl?: string;
}) {
  return request<{ payUrl: string }>("/api/vnpay/create-payment", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

