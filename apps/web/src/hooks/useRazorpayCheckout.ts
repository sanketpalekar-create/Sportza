/**
 * useRazorpayCheckout
 *
 * Opens the Razorpay payment modal and returns a promise that resolves on
 * successful payment or rejects on failure / dismissal.
 *
 * Usage:
 *   const checkout = useRazorpayCheckout();
 *   await checkout({ bookingId: 42, amount: 1200, description: "Court booking" });
 */
import { useCreatePaymentOrder, useVerifyPayment } from "@sportza/api-client";
import { useCallback } from "react";

interface CheckoutParams {
  amount: number;           // in rupees (not paise)
  description?: string;
  bookingId?: number;       // for single booking
  groupId?: string;         // for batch booking
  prefillName?: string;
  prefillEmail?: string;
  prefillContact?: string;
  onSuccess?: (bookingIds: number[]) => void;
  onFailure?: (reason: string) => void;
}

export function useRazorpayCheckout() {
  const createOrder = useCreatePaymentOrder();
  const verifyPayment = useVerifyPayment();

  return useCallback(
    async (params: CheckoutParams) => {
      const {
        amount,
        description = "Sportza Booking",
        bookingId,
        groupId,
        prefillName,
        prefillEmail,
        prefillContact,
        onSuccess,
        onFailure,
      } = params;

      // 1. Create Razorpay order on backend
      let orderData: { razorpayOrderId: string; keyId: string; amount: number };
      try {
        const res = await createOrder.mutateAsync({
          amount,
          ...(bookingId ? { bookingId } : {}),
          ...(groupId ? { groupId } : {}),
        });
        orderData = (res as any).data;
      } catch (err: any) {
        onFailure?.(err?.message ?? "Failed to create payment order");
        return;
      }

      const keyId =
        orderData.keyId ||
        import.meta.env.VITE_RAZORPAY_KEY_ID ||
        "";

      if (!keyId || !window.Razorpay) {
        onFailure?.("Razorpay is not available. Check your configuration.");
        return;
      }

      // 2. Open Razorpay checkout
      return new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: keyId,
          amount: orderData.amount,
          currency: "INR",
          name: "Sportza",
          description,
          order_id: orderData.razorpayOrderId,
          handler: async (response) => {
            // 3. Verify payment signature on backend
            try {
              const verifyRes = await verifyPayment.mutateAsync({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              const ids: number[] = (verifyRes as any)?.data?.bookingIds ?? [];
              onSuccess?.(ids);
              resolve();
            } catch (err: any) {
              onFailure?.(err?.message ?? "Payment verification failed");
              reject(err);
            }
          },
          prefill: {
            name: prefillName,
            email: prefillEmail,
            contact: prefillContact,
          },
          theme: { color: "#3B82F6" },
          modal: {
            ondismiss: () => {
              onFailure?.("Payment cancelled");
              reject(new Error("Payment cancelled"));
            },
          },
        });
        rzp.open();
      });
    },
    [createOrder, verifyPayment]
  );
}
