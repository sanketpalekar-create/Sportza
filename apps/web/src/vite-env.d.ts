/// <reference types="vite/client" />

// ─── Razorpay global ──────────────────────────────────────────────────────────
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  order_id: string;
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}

declare class Razorpay {
  constructor(options: RazorpayOptions);
  open(): void;
}

declare interface Window {
  Razorpay: typeof Razorpay;
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_RAZORPAY_KEY_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
