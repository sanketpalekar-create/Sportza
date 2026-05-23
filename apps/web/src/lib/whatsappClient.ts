/**
 * Client-side WhatsApp bridge: opens wa.me with a prefilled message.
 * Server-side WhatsApp Business API is not required; the coach or parent taps through on their device.
 */
export function buildWhatsAppLink(phoneDigits: string, message: string): string {
  const digits = phoneDigits.replace(/\D/g, "");
  const n = digits.startsWith("91") && digits.length > 10 ? digits : digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

export function openWhatsAppLink(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}
