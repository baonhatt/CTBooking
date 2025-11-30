import type { RequestHandler } from "express";
import crypto from "crypto";

type CreatePaymentBody = {
  amount: number;
  orderId: string;
  orderInfo: string;
  redirectUrl: string;
  ipnUrl: string;
  requestType?: string;
  extraData?: string;
  lang?: string;
};

const MOMO_ENDPOINT = process.env.MOMO_ENDPOINT || "https://test-payment.momo.vn/v2/gateway/api/create";
const ENV_PARTNER_CODE = process.env.MOMO_PARTNER_CODE || "";
const ENV_ACCESS_KEY = process.env.MOMO_ACCESS_KEY || "";
const ENV_SECRET_KEY = process.env.MOMO_SECRET_KEY || "";

export const createMomoPayment: RequestHandler = async (req, res) => {
  try {
    const {
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      requestType = "captureWallet",
      extraData = "",
      lang = "vi",
      requestId: requestIdFromBody,
      // optional dev-only credentials in body
      partnerCode: partnerCodeBody,
      accessKey: accessKeyBody,
      secretKey: secretKeyBody,
    } = req.body as CreatePaymentBody & { requestId?: string; partnerCode?: string; accessKey?: string; secretKey?: string };

    const partnerCode = ENV_PARTNER_CODE || partnerCodeBody || "";
    const accessKey = ENV_ACCESS_KEY || accessKeyBody || "";
    const secretKey = ENV_SECRET_KEY || secretKeyBody || "";

    if (!partnerCode || !accessKey || !secretKey) {
      return res.status(400).json({ message: "MOMO configuration missing" });
    }

    if (!amount || !orderId || !orderInfo || !redirectUrl || !ipnUrl) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    const requestId = requestIdFromBody || Date.now().toString();

    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    const signature = crypto.createHmac("sha256", secretKey).update(rawSignature).digest("hex");

    const payload = {
      partnerCode,
      accessKey,
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      extraData,
      requestType,
      signature,
      lang,
    };

    const momoRes = await fetch(MOMO_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await momoRes.json().catch(() => ({}));

    if (!momoRes.ok) {
      return res.status(momoRes.status).json({ message: data?.message || "MOMO error", data });
    }

    return res.json({ payUrl: data?.payUrl || data?.deeplink || data?.deeplinkWeb || "" , data });
  } catch (err) {
    return res.status(500).json({ message: (err as Error).message });
  }
};

export const momoIpn: RequestHandler = async (req, res) => {
  try {
    res.status(200).json({ result: true });
  } catch {
    res.status(500).json({ result: false });
  }
};
