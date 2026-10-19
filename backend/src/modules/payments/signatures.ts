import { createHmac, timingSafeEqual } from 'node:crypto';

function hexHmacMatches(secret: string, payload: string | Buffer, signature: unknown): boolean {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(payload).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

/** Razorpay Checkout: HMAC-SHA256 of `order_id|payment_id` with the key secret. */
export function checkoutSignatureMatches(
  keySecret: string,
  orderId: string,
  paymentId: string,
  signature: unknown,
): boolean {
  return hexHmacMatches(keySecret, `${orderId}|${paymentId}`, signature);
}

/** Razorpay webhooks: HMAC-SHA256 of the exact raw request body with the webhook secret. */
export function webhookSignatureMatches(
  webhookSecret: string,
  rawBody: Buffer,
  signature: unknown,
): boolean {
  return hexHmacMatches(webhookSecret, rawBody, signature);
}
