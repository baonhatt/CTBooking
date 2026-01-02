// import crypto from "crypto";

async function hmacSHA256(key: string, data: string) {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(key);
        const msgData = encoder.encode(data);
        const cryptoKey = await crypto.subtle.importKey(
                "raw",
                keyData,
                { name: "HMAC", hash: "SHA-256" },
                false,
                ["sign"]
        );
        const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
        return Array.from(new Uint8Array(signature))
                .map(b => b.toString(16).padStart(2, "0"))
                .join("");
}

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

const MOMO_ENDPOINT =
        process.env.VITE_MOMO_ENDPOINT ||
        "https://test-payment.momo.vn/v2/gateway/api/create";
const ENV_PARTNER_CODE = process.env.VITE_MOMO_PARTNER_CODE || "";
const ENV_ACCESS_KEY = process.env.VITE_MOMO_ACCESS_KEY || "";
const ENV_SECRET_KEY = process.env.VITE_MOMO_SECRET_KEY || "";

export async function createMomoPaymentImpl(payload: CreatePaymentBody & { requestId?: string; partnerCode?: string; accessKey?: string; secretKey?: string; endpoint?: string }) {
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
                partnerCode: partnerCodeBody,
                accessKey: accessKeyBody,
                secretKey: secretKeyBody,
                endpoint: endpointBody,
        } = payload;
        const partnerCode = partnerCodeBody || ENV_PARTNER_CODE || "";
        const accessKey = accessKeyBody || ENV_ACCESS_KEY || "";
        const secretKey = secretKeyBody || ENV_SECRET_KEY || "";
        const endpoint = endpointBody || MOMO_ENDPOINT || "";
        if (!partnerCode || !accessKey || !secretKey) {
                return { status: 500, message: "MOMO configuration missing" };
        }
        if (!amount || !orderId || !orderInfo || !redirectUrl || !ipnUrl) {
                return { status: 400, message: "Invalid payload" };
        }
        const requestId = requestIdFromBody || Date.now().toString();
        const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
        // const signature = crypto.createHmac("sha256", secretKey).update(rawSignature).digest("hex");
        const signature = await hmacSHA256(secretKey, rawSignature);
        const body = {
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
        const momoRes = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await momoRes.json().catch(() => ({}));
        if (!momoRes.ok) {
                return { status: momoRes.status || 400, message: data?.message || "MOMO error", data };
        }
        return { status: 200, payUrl: data?.payUrl || data?.deeplink || data?.deeplinkWeb || "", data };
}

export async function momoIpnImpl() {
        return { result: true };
}


