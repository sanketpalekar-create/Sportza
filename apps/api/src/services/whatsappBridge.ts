/**
 * Builds WhatsApp deep links for trainer reminders (no server-side WhatsApp API — opens the app with a prefilled message).
 */

function enc(s: string): string {
  return encodeURIComponent(s).replace(/%20/g, " ");
}

export function whatsappUrlForPhone(phoneDigits: string, message: string): string {
  const digits = phoneDigits.replace(/\D/g, "");
  const n = digits.startsWith("91") && digits.length > 10 ? digits : digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${n}?text=${enc(message)}`;
}

export function paymentReminderMessage(opts: {
  batchName: string;
  monthLabel: string;
  amountHint?: string;
  payLink?: string;
}): string {
  const lines = [
    `Hi — friendly reminder: your ${opts.batchName} fee for ${opts.monthLabel} is pending.`,
    opts.amountHint ? `Amount: ${opts.amountHint}` : "",
    opts.payLink ? `Pay here: ${opts.payLink}` : "Please complete payment at your earliest convenience.",
    "",
    "— Sent via Sportza",
  ].filter(Boolean);
  return lines.join("\n");
}

export function sessionReminderMessage(opts: {
  batchName: string;
  dateLabel: string;
  timeRange: string;
}): string {
  return [
    `Reminder: ${opts.batchName} session on ${opts.dateLabel} (${opts.timeRange}).`,
    "See you there!",
    "",
    "— Sportza",
  ].join("\n");
}

export function progressShareMessage(opts: { batchName: string; shareUrl: string }): string {
  return [`${opts.batchName} — player progress update`, opts.shareUrl, "", "Shared via Sportza"].join("\n");
}
