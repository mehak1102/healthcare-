import type { Checkout, PaymentConfirmation } from './api';

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void; confirm_close?: boolean };
}

interface RazorpayInstance {
  open(): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export class CheckoutDismissedError extends Error {
  constructor() {
    super('Payment window closed before the payment finished.');
    this.name = 'CheckoutDismissedError';
  }
}

let loading: Promise<void> | null = null;

/** Loads Razorpay's hosted Checkout script once. Card and UPI details are entered on Razorpay's side. */
function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(
        new Error('We could not load the payment window. Check your connection and try again.'),
      );
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Opens Razorpay Checkout for an order created by our server. Resolves with what Razorpay hands
 * back; the server still verifies it before anything counts as paid.
 */
export async function payWithRazorpay(
  checkout: Checkout,
  details: { description: string; name?: string; email?: string },
): Promise<PaymentConfirmation> {
  await loadCheckout();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error('The payment window is not available right now.');
  return new Promise<PaymentConfirmation>((resolve, reject) => {
    const instance = new Razorpay({
      key: checkout.keyId,
      amount: checkout.amountPaise,
      currency: checkout.currency,
      order_id: checkout.orderId,
      name: 'Sukoon Health',
      description: details.description,
      prefill: { name: details.name, email: details.email },
      theme: { color: '#a84b3c' },
      handler: (response) =>
        resolve({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        }),
      modal: { ondismiss: () => reject(new CheckoutDismissedError()), confirm_close: true },
    });
    instance.open();
  });
}
