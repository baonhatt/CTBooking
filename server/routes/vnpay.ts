import type { RequestHandler } from "express";
import crypto from "crypto";

function sortObject(obj: Record<string, any>) {
  const sorted: Record<string, any> = {};
  const keys = Object.keys(obj).sort();
  for (const k of keys) sorted[k] = obj[k];
  return sorted;
}

const VNP_TMNCODE = process.env.VNPAY_TMN_CODE || "";
const VNP_HASH_SECRET = process.env.VNPAY_HASH_SECRET || "";
const VNP_GATEWAY = process.env.VNPAY_GATEWAY || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
const VNP_RETURN_URL = process.env.VNPAY_RETURN_URL || "http://localhost:8080/";

export const createVnpayPayment: RequestHandler = async (req, res) => {
  try {
    const { amount, orderId, orderInfo, locale = "vn" } = req.body as { amount: number; orderId: string; orderInfo: string; locale?: string };
    if (!amount || !orderId || !orderInfo) {
      return res.status(400).json({ message: "Invalid payload" });
    }
    const tmnCode = VNP_TMNCODE || req.body.tmnCode || "";
    const hashSecret = VNP_HASH_SECRET || req.body.hashSecret || "";
    const returnUrl = VNP_RETURN_URL || req.body.returnUrl || "";
    if (!tmnCode || !hashSecret || !returnUrl) {
      return res.status(400).json({ message: "VNPay configuration missing" });
    }
    const vnp_TxnRef = orderId;
    const vnp_Version = "2.1.0";
    const vnp_Command = "pay";
    const vnp_CreateDate = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const vnp_IpAddr = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    const vnp_Amount = amount * 100;
    const params: Record<string, any> = {
      vnp_Version,
      vnp_Command,
      vnp_TmnCode: tmnCode,
      vnp_Locale: locale,
      vnp_CurrCode: "VND",
      vnp_TxnRef,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: "other",
      vnp_Amount,
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr,
      vnp_CreateDate,
    };
    const sorted = sortObject(params);
    const signData = new URLSearchParams(sorted).toString();
    const hmac = crypto.createHmac("sha512", hashSecret);
    const vnp_SecureHash = hmac.update(signData).digest("hex");
    const query = new URLSearchParams({ ...sorted, vnp_SecureHash }).toString();
    const payUrl = `${VNP_GATEWAY}?${query}`;
    return res.json({ payUrl });
  } catch (err) {
    return res.status(500).json({ message: (err as Error).message });
  }
};

export const vnpayIpn: RequestHandler = async (_req, res) => {
  res.status(200).json({ result: true });
};

