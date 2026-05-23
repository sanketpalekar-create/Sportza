import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePairingSocket } from "../../hooks/usePairingSocket";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const WEB_BASE = import.meta.env.VITE_WEB_URL ?? window.location.origin;

interface PairingInfo {
  courtName: string;
  displayId: number;
  expiresAt: string;
  status: string;
}

function formatCountdown(expiresAt: string): string {
  const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PairDisplay() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [info, setInfo] = useState<PairingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>("");
  const [paired, setPaired] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // The URL the phone user will open to claim this display
  const claimUrl = `${WEB_BASE}/claim/${token}`;

  // QR image from a free CDN — encodes the claim URL
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&color=f8fafc&bgcolor=0a0f1a&margin=2&data=${encodeURIComponent(claimUrl)}`;

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/displays/pairing/${token}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          if (res.data.status === "expired") {
            setError("This pairing session has expired. Please generate a new one from the app.");
            return;
          }
          if (res.data.status === "claimed" && res.data.matchId) {
            navigate(`/scoreboard/${res.data.matchId}`, { replace: true });
            return;
          }
          setInfo(res.data);
        } else {
          setError("Invalid pairing session.");
        }
      })
      .catch(() => setError("Unable to reach server. Check network connection."));
  }, [token, navigate]);

  // Live countdown
  useEffect(() => {
    if (!info) return;
    countdownRef.current = setInterval(() => {
      const c = formatCountdown(info.expiresAt);
      setCountdown(c);
      if (c === "0:00") {
        setError("Session expired. Generate a new pairing from the app.");
        clearInterval(countdownRef.current!);
      }
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [info]);

  const onPaired = useCallback((payload: { matchId: number }) => {
    setPaired(true);
    setTimeout(() => {
      navigate(`/scoreboard/${payload.matchId}`, { replace: true });
    }, 1200);
  }, [navigate]);

  usePairingSocket({ token: token ?? null, onPaired });

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      {error ? (
        <div style={styles.errorBox}>
          <p style={styles.errorText}>{error}</p>
        </div>
      ) : paired ? (
        <div style={styles.pairedBox}>
          <div style={styles.pairedIcon}>✓</div>
          <p style={styles.pairedText}>Display linked — launching scoreboard…</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <p style={styles.appLabel}>Sportza</p>
          {info && (
            <p style={styles.courtLabel}>{info.courtName}</p>
          )}
          <p style={styles.instruction}>Scan to connect match to this display</p>

          {/* QR */}
          <div style={styles.qrFrame}>
            <img
              src={qrSrc}
              alt="Pairing QR code"
              width={280}
              height={280}
              style={styles.qrImg}
            />
          </div>

          {/* Serial / token hint */}
          <div style={styles.serialBox}>
            <p style={styles.serialLabel}>Session code</p>
            <p style={styles.serialCode}>{token?.slice(0, 12).toUpperCase()}</p>
          </div>

          {/* Countdown */}
          {countdown && (
            <p style={styles.countdown}>Expires in {countdown}</p>
          )}

          <p style={styles.hint}>
            Open the Sportza app → match detail → "Send to display" → scan this QR
          </p>
        </>
      )}

      {/* Footer dot */}
      <div style={styles.footer}>
        <span style={styles.footerDot} />
        <span style={styles.footerText}>sportza.app</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    background: "#0a0f1a",
    minHeight: "100vh",
    width: "100vw",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    color: "#f8fafc",
    position: "relative",
    gap: "0",
  },
  appLabel: {
    fontSize: "clamp(0.8rem, 1.5vw, 1.1rem)",
    color: "#22c55e",
    fontWeight: 700,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    margin: "0 0 0.5rem",
  },
  courtLabel: {
    fontSize: "clamp(1.8rem, 5vw, 4rem)",
    fontWeight: 800,
    color: "#f8fafc",
    margin: "0 0 0.25rem",
    letterSpacing: "-0.01em",
  },
  instruction: {
    fontSize: "clamp(0.85rem, 1.8vw, 1.2rem)",
    color: "#94a3b8",
    margin: "0 0 2.5rem",
    fontWeight: 400,
  },
  qrFrame: {
    background: "#0a0f1a",
    border: "3px solid #22c55e",
    borderRadius: "16px",
    padding: "18px",
    display: "inline-flex",
    boxShadow: "0 0 40px rgba(34,197,94,0.15)",
    marginBottom: "2rem",
  },
  qrImg: {
    display: "block",
    borderRadius: "8px",
  },
  serialBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.2rem",
    marginBottom: "1.25rem",
    background: "rgba(255,255,255,0.04)",
    borderRadius: "10px",
    padding: "0.6rem 1.5rem",
    border: "1px solid rgba(255,255,255,0.07)",
  },
  serialLabel: {
    fontSize: "0.65rem",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    margin: 0,
  },
  serialCode: {
    fontSize: "clamp(1rem, 2.5vw, 1.6rem)",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "0.25em",
    color: "#e2e8f0",
    margin: 0,
    fontFamily: "'SF Mono', 'Fira Code', monospace",
  },
  countdown: {
    fontSize: "0.8rem",
    color: "#475569",
    margin: "0 0 1rem",
  },
  hint: {
    fontSize: "clamp(0.7rem, 1.2vw, 0.85rem)",
    color: "#334155",
    textAlign: "center",
    maxWidth: "380px",
    lineHeight: 1.5,
    margin: "0 1rem",
  },
  errorBox: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: "12px",
    padding: "2rem 3rem",
    maxWidth: "420px",
    textAlign: "center",
  },
  errorText: {
    color: "#fca5a5",
    fontSize: "1rem",
    lineHeight: 1.6,
    margin: 0,
  },
  pairedBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1rem",
  },
  pairedIcon: {
    fontSize: "clamp(3rem, 10vw, 6rem)",
    color: "#22c55e",
    fontWeight: 800,
    lineHeight: 1,
  },
  pairedText: {
    fontSize: "clamp(1rem, 2.5vw, 1.8rem)",
    color: "#94a3b8",
    margin: 0,
  },
  footer: {
    position: "absolute",
    bottom: "1.5rem",
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
  },
  footerDot: {
    display: "inline-block",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#22c55e",
  },
  footerText: {
    fontSize: "0.7rem",
    color: "#1e293b",
    letterSpacing: "0.08em",
  },
};
