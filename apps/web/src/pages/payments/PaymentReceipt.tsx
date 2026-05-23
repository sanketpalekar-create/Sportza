import { useParams, useNavigate } from "react-router-dom";
import { useBooking } from "@sportza/api-client";
import { Download, ChevronLeft, CheckCircle2, MapPin, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";

const GST_RATE = 0.18;

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span className="text-[#64748B]" style={{ fontSize: "13px" }}>{label}</span>
      <span className="text-right" style={{ fontSize: bold ? "16px" : "13px", fontWeight: bold ? "800" : "600", color: "#fff" }}>{value}</span>
    </div>
  );
}

export default function PaymentReceipt() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bookingId = id ? parseInt(id, 10) : 0;

  const { data: res, isLoading, isError } = useBooking(bookingId);
  const booking: any = (res as any)?.data ?? res;

  const handleDownload = () => {
    const printContent = document.getElementById("receipt-print");
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Receipt – Sportza</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px;background:#fff}
      h1{font-size:1.4rem;margin-bottom:16px}.row{display:flex;justify-content:space-between;margin:8px 0}
      .label{color:#666}.total{font-weight:800;font-size:1.2rem;margin-top:12px}
      .section{margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #eee}
      </style></head><body>${printContent.innerHTML}</body></html>`);
    win.document.close();
    win.print();
    win.close();
  };

  if (isError || (!isLoading && !booking)) {
    return (
      <div className="min-h-screen bg-[#0F172A] px-4 pt-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[#64748B] mb-4">
          <ChevronLeft style={{ width: "20px", height: "20px" }} /> Back
        </button>
        <div className="p-4 text-[#EF4444]" style={{ borderRadius: "12px", backgroundColor: "#1E293B" }}>
          Receipt not found.
        </div>
      </div>
    );
  }

  const payment   = booking?.payment as Record<string, unknown> | undefined;
  const amount    = (payment?.amount as number) ?? booking?.totalAmount ?? 0;
  const baseAmt   = amount / (1 + GST_RATE);
  const gstAmt    = amount - baseAmt;

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-8 pb-4">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}>
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>
        <h1 className="text-white" style={{ fontSize: "18px", fontWeight: "800" }}>Payment Receipt</h1>
        <button onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-2"
          style={{ borderRadius: "10px", backgroundColor: "#1E293B", fontSize: "12px", fontWeight: "700", color: "#94A3B8" }}>
          <Download style={{ width: "14px", height: "14px" }} />
          Print
        </button>
      </div>

      {isLoading ? (
        <div className="px-4">
          {[1,2,3].map((i) => <div key={i} className="animate-pulse h-28 rounded-2xl mb-4" style={{ backgroundColor: "#1E293B" }} />)}
        </div>
      ) : (
        <div id="receipt-print" className="px-4 space-y-4 max-w-md mx-auto">
          {/* Success badge */}
          <div className="p-5 flex flex-col items-center text-center"
            style={{ borderRadius: "20px", background: "linear-gradient(135deg,rgba(34,197,94,0.15),rgba(22,163,74,0.08))", border: "1px solid rgba(34,197,94,0.2)" }}>
            <CheckCircle2 style={{ width: "40px", height: "40px", color: "#22C55E", marginBottom: "12px" }} />
            <p className="text-white" style={{ fontSize: "28px", fontWeight: "900" }}>₹{amount.toLocaleString()}</p>
            <p className="text-[#22C55E]" style={{ fontSize: "13px", fontWeight: "700" }}>Payment Confirmed ✓</p>
            {booking?.id && (
              <p className="text-[#64748B] mt-1" style={{ fontSize: "11px" }}>
                SRTZA-{String(booking.id).padStart(6, "0")}
              </p>
            )}
          </div>

          {/* Booking details */}
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <p className="text-white mb-3" style={{ fontSize: "15px", fontWeight: "700" }}>Booking Details</p>
            <div className="space-y-0">
              {booking?.venue?.name && (
                <div className="flex items-center gap-2 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <MapPin style={{ width: "14px", height: "14px", color: "#64748B", flexShrink: 0 }} />
                  <span className="text-[#64748B]" style={{ fontSize: "13px" }}>Venue</span>
                  <span className="text-white ml-auto" style={{ fontSize: "13px", fontWeight: "600" }}>{booking.venue.name}</span>
                </div>
              )}
              {booking?.facilityName && (
                <Row label="Facility"  value={booking.facilityName} />
              )}
              {booking?.sport && (
                <Row label="Sport"     value={booking.sport} />
              )}
              {booking?.bookingDate && (
                <div className="flex items-center gap-2 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <Calendar style={{ width: "14px", height: "14px", color: "#64748B", flexShrink: 0 }} />
                  <span className="text-[#64748B]" style={{ fontSize: "13px" }}>Date</span>
                  <span className="text-white ml-auto" style={{ fontSize: "13px", fontWeight: "600" }}>
                    {format(new Date(booking.bookingDate), "dd MMM yyyy")}
                  </span>
                </div>
              )}
              {(booking?.startTime || booking?.endTime) && (
                <div className="flex items-center gap-2 py-2">
                  <Clock style={{ width: "14px", height: "14px", color: "#64748B", flexShrink: 0 }} />
                  <span className="text-[#64748B]" style={{ fontSize: "13px" }}>Time</span>
                  <span className="text-white ml-auto" style={{ fontSize: "13px", fontWeight: "600" }}>
                    {booking.startTime} – {booking.endTime}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Payment details */}
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <p className="text-white mb-3" style={{ fontSize: "15px", fontWeight: "700" }}>Payment Details</p>
            <Row label="Method"       value={(payment?.method as string) ?? "Online"} />
            {payment != null && payment.transactionId != null && String(payment.transactionId) !== "" && (
              <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span className="text-[#64748B]" style={{ fontSize: "13px" }}>Transaction ID</span>
                <span className="text-white font-mono" style={{ fontSize: "11px" }}>{String(payment.transactionId)}</span>
              </div>
            )}
            <Row label="Date"         value={payment?.createdAt
              ? format(new Date(String(payment.createdAt)), "dd MMM yyyy HH:mm")
              : booking?.createdAt ? format(new Date(booking.createdAt), "dd MMM yyyy HH:mm") : "—"} />
          </div>

          {/* GST breakdown */}
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <p className="text-white mb-3" style={{ fontSize: "15px", fontWeight: "700" }}>GST Breakdown (18%)</p>
            <Row label="Base Amount"  value={`₹${baseAmt.toFixed(2)}`} />
            <Row label="GST (18%)"    value={`₹${gstAmt.toFixed(2)}`} />
            <div className="flex items-center justify-between pt-3 mt-1"
              style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>Total</span>
              <span className="text-[#22C55E]" style={{ fontSize: "22px", fontWeight: "900" }}>₹{amount.toLocaleString()}</span>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-[#475569] pb-4" style={{ fontSize: "11px" }}>
            Thank you for booking with Sportza · हर दिन. Game On.
          </p>
        </div>
      )}
    </div>
  );
}
