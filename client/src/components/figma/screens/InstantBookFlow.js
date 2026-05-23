import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import "../../../styles/instant-book.css";
import {
  ChevronLeft, ChevronRight, Star, MapPin, Clock, Search,
  Zap, Check, CheckCircle, Shield, Calendar, Users, RefreshCw,
  Share2, CalendarPlus, X, ChevronDown,
  Navigation, ArrowRight, Loader
} from "lucide-react";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const T = {
  bg:     "#0B1628",
  bg2:    "#0F172A",
  card:   "#162136",
  card2:  "#1C2D47",
  card3:  "#1A2942",
  border: "rgba(255,255,255,0.07)",
  bord2:  "rgba(255,255,255,0.12)",
  blue:   "#3B82F6",
  blue2:  "#60A5FA",
  indigo: "#6366F1",
  green:  "#22C55E",
  amber:  "#F59E0B",
  red:    "#EF4444",
  purple: "#8B5CF6",
  cyan:   "#06B6D4",
  t1:     "#F0F6FF",
  t2:     "#94A3B8",
  t3:     "#475569",
  t4:     "#253347",
};

const ff = (w = "sora") => w === "mono" ? "'JetBrains Mono', monospace" : "'Sora', sans-serif";

const SPORTS = [
  { id: "cricket",    emoji: "🏏", name: "Cricket",    color: T.purple },
  { id: "football",   emoji: "⚽", name: "Football",   color: T.green  },
  { id: "badminton",  emoji: "🏸", name: "Badminton",  color: T.blue   },
  { id: "tennis",     emoji: "🎾", name: "Tennis",     color: T.amber  },
  { id: "basketball", emoji: "🏀", name: "Basketball", color: T.red    },
  { id: "swimming",   emoji: "🏊", name: "Swimming",   color: T.cyan   },
  { id: "pickleball", emoji: "🏓", name: "Pickleball", color: "#14B8A6" },
];

function getAuthHeaders() {
  try {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

function formatTimeLabel(t) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function getTimeWindow(time) {
  const h = parseInt(time.split(":")[0], 10);
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

// ─── SHARED UI ATOMS ─────────────────────────────────────────────────────────

function BackBtn({ onBack }) {
  return (
    <button className="btn-press" onClick={onBack} style={{
      width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
      background: T.card2, border: `1px solid ${T.border}`, cursor: "pointer", flexShrink: 0,
    }}>
      <ChevronLeft size={18} color={T.t1} />
    </button>
  );
}

function PrimaryBtn({ label, onClick, disabled, icon: Icon, loading, color }) {
  const bg = color || `linear-gradient(90deg,${T.blue},${T.indigo})`;
  return (
    <button className="btn-press" onClick={onClick} disabled={disabled || loading} style={{
      width: "100%", padding: "15px 0", borderRadius: 16, border: "none",
      cursor: disabled ? "not-allowed" : "pointer",
      background: disabled ? T.t4 : bg,
      color: disabled ? T.t3 : "#fff",
      fontFamily: ff(), fontSize: 15, fontWeight: 700, letterSpacing: ".2px",
      boxShadow: disabled ? "none" : `0 10px 28px rgba(59,130,246,.35)`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      transition: "all .2s ease",
    }}>
      {loading
        ? <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} />
        : Icon ? <Icon size={18} /> : null}
      {loading ? "Processing..." : label}
    </button>
  );
}

function SportBadge({ sport, small }) {
  if (!sport) return null;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: `${sport.color}18`, border: `1px solid ${sport.color}35`,
      borderRadius: 99, padding: small ? "4px 12px" : "7px 16px",
    }}>
      <span style={{ fontSize: small ? 13 : 16 }}>{sport.emoji}</span>
      <span style={{ fontFamily: ff(), fontSize: small ? 11 : 13, fontWeight: 600, color: sport.color }}>{sport.name}</span>
    </div>
  );
}

// ─── SCREEN 1: SPORT + VENUE SELECTION ──────────────────────────────────────

function SportVenueScreen({ onNext, onBack }) {
  const [sport, setSport] = useState(null);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchVenues = useCallback(async (sportId) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sportId) params.set("sport", sportId);
      const { data } = await axios.get(`${API_URL}/venues/nearby?${params}`);
      setVenues(Array.isArray(data) ? data : []);
    } catch {
      setVenues([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sport) fetchVenues(sport.id);
    else fetchVenues();
  }, [sport, fetchVenues]);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "0 0 32px" }}>
      {/* Header */}
      <div style={{ padding: "24px 22px 0", animation: "fadeUp .4s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg,${T.blue},${T.indigo})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={16} color="#fff" fill="#fff" />
            </div>
            <span style={{ fontFamily: ff(), fontSize: 12, fontWeight: 700, color: T.blue, letterSpacing: "1.2px", textTransform: "uppercase" }}>Instant Book</span>
          </div>
          {onBack && (
            <button className="btn-press" onClick={onBack} style={{ width: 38, height: 38, borderRadius: 12, background: T.card2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={18} color={T.t1} />
            </button>
          )}
        </div>
        <h1 style={{ fontFamily: ff(), fontSize: 26, fontWeight: 800, color: T.t1, letterSpacing: "-.5px", marginBottom: 4 }}>
          Book a Slot
        </h1>
        <p style={{ fontFamily: ff(), fontSize: 13, color: T.t2, lineHeight: 1.5 }}>
          Pick a sport, tap a venue, and you're in.
        </p>
      </div>

      {/* Sport filter */}
      <div style={{ padding: "18px 22px 0", animation: "fadeUp .4s ease .06s both" }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          <div
            className="btn-press"
            onClick={() => setSport(null)}
            style={{
              flexShrink: 0, padding: "8px 16px", borderRadius: 99, cursor: "pointer",
              background: !sport ? T.blue : T.card2,
              border: `1px solid ${!sport ? T.blue : T.border}`,
            }}
          >
            <span style={{ fontFamily: ff(), fontSize: 12, fontWeight: 600, color: !sport ? "#fff" : T.t2 }}>All Sports</span>
          </div>
          {SPORTS.map(sp => {
            const active = sport?.id === sp.id;
            return (
              <div key={sp.id} className="btn-press" onClick={() => setSport(active ? null : sp)}
                style={{
                  flexShrink: 0, padding: "8px 14px", borderRadius: 99, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  background: active ? `${sp.color}25` : T.card2,
                  border: `1px solid ${active ? sp.color : T.border}`,
                }}>
                <span style={{ fontSize: 14 }}>{sp.emoji}</span>
                <span style={{ fontFamily: ff(), fontSize: 12, fontWeight: 600, color: active ? sp.color : T.t2 }}>{sp.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Venues */}
      <div style={{ padding: "18px 22px 0" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Loader size={28} color={T.blue} style={{ animation: "spin 1s linear infinite" }} />
            <p style={{ fontFamily: ff(), fontSize: 13, color: T.t3, marginTop: 12 }}>Finding venues...</p>
          </div>
        ) : venues.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <MapPin size={32} color={T.t3} />
            <p style={{ fontFamily: ff(), fontSize: 14, color: T.t2, marginTop: 12 }}>No venues found</p>
            <p style={{ fontFamily: ff(), fontSize: 12, color: T.t3, marginTop: 4 }}>Try a different sport or location</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {venues.map((v, i) => (
              <div key={v.id} className="card" onClick={() => onNext(v, sport)}
                style={{
                  background: T.card, borderRadius: 18, border: `1px solid ${T.border}`,
                  padding: "16px", cursor: "pointer", overflow: "hidden",
                  animation: `fadeUp .4s ease ${.08 + i * .06}s both`,
                }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontFamily: ff(), fontSize: 16, fontWeight: 700, color: T.t1, marginBottom: 4 }}>{v.name}</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <MapPin size={12} color={T.t3} />
                      <span style={{ fontFamily: ff(), fontSize: 12, color: T.t2 }}>
                        {v.location?.city || v.location?.address || ""}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: ff("mono"), fontSize: 18, fontWeight: 700, color: T.blue }}>
                      ₹{v.pricePerHour || 500}
                      <span style={{ fontSize: 10, fontWeight: 400, color: T.t3, fontFamily: ff() }}>/hr</span>
                    </div>
                  </div>
                </div>

                {v.facilities && v.facilities.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {v.facilities.slice(0, 3).map(f => (
                      <div key={f.id} style={{
                        background: T.card2, borderRadius: 8, padding: "4px 10px",
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <span style={{ fontFamily: ff(), fontSize: 10, color: T.t2, fontWeight: 500 }}>
                          {f.name}{f.surfaceType ? ` · ${f.surfaceType}` : ""}
                        </span>
                      </div>
                    ))}
                    {v.facilities.length > 3 && (
                      <div style={{ background: T.card2, borderRadius: 8, padding: "4px 10px" }}>
                        <span style={{ fontFamily: ff(), fontSize: 10, color: T.t3 }}>+{v.facilities.length - 3}</span>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, background: `${T.blue}15`, borderRadius: 8, padding: "5px 12px" }}>
                    <span style={{ fontFamily: ff(), fontSize: 11, fontWeight: 600, color: T.blue }}>View Slots</span>
                    <ArrowRight size={12} color={T.blue} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SCREEN 2: SLOT GRID ────────────────────────────────────────────────────

function SlotGridScreen({ venue, sport, onNext, onBack }) {
  const today = new Date();
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i);
    return { d, label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : null, iso: d.toISOString().slice(0, 10) };
  });

  const [selDateIdx, setSelDateIdx] = useState(0);
  const [facilitySlots, setFacilitySlots] = useState([]);
  const [gstRate, setGstRate] = useState(18);
  const [loading, setLoading] = useState(true);
  const [selSlot, setSelSlot] = useState(null);
  const [selFacilityId, setSelFacilityId] = useState(null);
  const [timeFilter, setTimeFilter] = useState("all");

  const fetchSlots = useCallback(async (dateStr) => {
    setLoading(true);
    setSelSlot(null);
    setSelFacilityId(null);
    try {
      const params = new URLSearchParams({ date: dateStr });
      if (sport) params.set("sport", sport.id || sport);
      const { data } = await axios.get(`${API_URL}/slots/venue/${venue.id}?${params}`);
      setFacilitySlots(data.facilities || []);
      setGstRate(data.gstRate || 18);
    } catch {
      setFacilitySlots([]);
    } finally {
      setLoading(false);
    }
  }, [venue.id, sport]);

  useEffect(() => {
    fetchSlots(dates[selDateIdx].iso);
  }, [selDateIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectSlot = (facId, slot) => {
    if (!slot.available) return;
    if (selSlot?.start === slot.start && selFacilityId === facId) {
      setSelSlot(null);
      setSelFacilityId(null);
    } else {
      setSelSlot(slot);
      setSelFacilityId(facId);
    }
  };

  const selectedFacility = facilitySlots.find(f => f.facilityId === selFacilityId);

  const filterSlots = (slots) => {
    if (timeFilter === "all") return slots;
    return slots.filter(s => getTimeWindow(s.start) === timeFilter);
  };

  const timeFilters = [
    { id: "all", label: "All", icon: "🕐" },
    { id: "morning", label: "Morning", icon: "🌅" },
    { id: "afternoon", label: "Afternoon", icon: "☀️" },
    { id: "evening", label: "Evening", icon: "🌆" },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "0 0 32px" }}>
      {/* Header */}
      <div style={{ padding: "20px 22px 0", display: "flex", alignItems: "center", gap: 14, animation: "fadeUp .4s ease both" }}>
        <BackBtn onBack={onBack} />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: ff(), fontSize: 20, fontWeight: 800, color: T.t1, letterSpacing: "-.3px" }}>{venue.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            <MapPin size={11} color={T.t3} />
            <span style={{ fontFamily: ff(), fontSize: 11, color: T.t2 }}>{venue.location?.city || venue.location?.address || ""}</span>
          </div>
        </div>
        {sport && <SportBadge sport={sport} small />}
      </div>

      {/* Date scroll */}
      <div style={{ padding: "18px 22px 0", animation: "fadeUp .4s ease .04s both" }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {dates.map(({ d, label }, i) => {
            const active = selDateIdx === i;
            const day = d.toLocaleDateString("en-IN", { weekday: "short" });
            const date = d.getDate();
            return (
              <div key={i} className="btn-press" onClick={() => setSelDateIdx(i)}
                style={{
                  flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
                  background: active ? T.blue : T.card, border: `1.5px solid ${active ? T.blue : T.border}`,
                  borderRadius: 14, padding: "10px 14px", cursor: "pointer", minWidth: 56,
                  boxShadow: active ? `0 6px 18px ${T.blue}40` : "none",
                }}>
                {label && <div style={{ fontFamily: ff(), fontSize: 9, fontWeight: 700, color: active ? "rgba(255,255,255,.8)" : T.blue, letterSpacing: ".5px", marginBottom: 2 }}>{label.toUpperCase()}</div>}
                <div style={{ fontFamily: ff(), fontSize: 19, fontWeight: 800, color: active ? "#fff" : T.t1, lineHeight: 1 }}>{date}</div>
                <div style={{ fontFamily: ff(), fontSize: 10, color: active ? "rgba(255,255,255,.7)" : T.t2, marginTop: 2 }}>{day}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time filter */}
      <div style={{ padding: "14px 22px 0", animation: "fadeUp .4s ease .08s both" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {timeFilters.map(tf => {
            const active = timeFilter === tf.id;
            return (
              <div key={tf.id} className="btn-press" onClick={() => setTimeFilter(tf.id)}
                style={{
                  padding: "6px 12px", borderRadius: 99, cursor: "pointer",
                  background: active ? `${T.blue}20` : T.card2,
                  border: `1px solid ${active ? T.blue : T.border}`,
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                <span style={{ fontSize: 12 }}>{tf.icon}</span>
                <span style={{ fontFamily: ff(), fontSize: 11, fontWeight: 600, color: active ? T.blue : T.t3 }}>{tf.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Slots */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 50 }}>
          <Loader size={28} color={T.blue} style={{ animation: "spin 1s linear infinite" }} />
          <p style={{ fontFamily: ff(), fontSize: 13, color: T.t3, marginTop: 12 }}>Loading slots...</p>
        </div>
      ) : facilitySlots.length === 0 ? (
        <div style={{ textAlign: "center", padding: 50 }}>
          <Calendar size={32} color={T.t3} />
          <p style={{ fontFamily: ff(), fontSize: 14, color: T.t2, marginTop: 12 }}>No facilities available</p>
        </div>
      ) : (
        <div style={{ padding: "14px 22px 0" }}>
          {facilitySlots.map((fac, fi) => {
            const filtered = filterSlots(fac.slots);
            const availableCount = filtered.filter(s => s.available).length;
            return (
              <div key={fac.facilityId} style={{ marginBottom: 18, animation: `fadeUp .4s ease ${.1 + fi * .06}s both` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontFamily: ff(), fontSize: 14, fontWeight: 700, color: T.t1 }}>{fac.facilityName}</div>
                    {fac.surfaceType && (
                      <span style={{ fontFamily: ff(), fontSize: 11, color: T.blue2 }}>🏟 {fac.surfaceType}</span>
                    )}
                  </div>
                  <span style={{ fontFamily: ff(), fontSize: 11, color: availableCount > 0 ? T.green : T.red, fontWeight: 600 }}>
                    {availableCount} slot{availableCount !== 1 ? "s" : ""} free
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {filtered.map((slot, si) => {
                    const isSelected = selSlot?.start === slot.start && selFacilityId === fac.facilityId;
                    const unavail = !slot.available;
                    return (
                      <div key={si} className="slot-chip"
                        onClick={() => handleSelectSlot(fac.facilityId, slot)}
                        style={{
                          background: unavail ? T.bg2 : isSelected ? T.blue : T.card,
                          border: `1px solid ${unavail ? T.border : isSelected ? T.blue : T.bord2}`,
                          borderRadius: 12, padding: "10px 6px", textAlign: "center",
                          cursor: unavail ? "not-allowed" : "pointer", opacity: unavail ? .4 : 1,
                          boxShadow: isSelected ? `0 4px 14px ${T.blue}40` : "none",
                        }}>
                        <div style={{ fontFamily: ff(), fontSize: 12, fontWeight: isSelected ? 700 : 500, color: unavail ? T.t3 : isSelected ? "#fff" : T.t1 }}>
                          {formatTimeLabel(slot.start)}
                        </div>
                        {slot.available ? (
                          <div style={{ fontFamily: ff("mono"), fontSize: 13, fontWeight: 700, color: isSelected ? "#fff" : T.green, marginTop: 3 }}>
                            ₹{slot.price}
                          </div>
                        ) : (
                          <div style={{ fontFamily: ff(), fontSize: 10, color: T.t3, marginTop: 3 }}>
                            {slot.status === "past" ? "Past" : "Booked"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected slot summary + CTA */}
      {selSlot && selectedFacility && (
        <div style={{ padding: "16px 22px 0", animation: "slideUp .25s ease both" }}>
          <div style={{ background: `${T.green}10`, border: `1px solid ${T.green}30`, borderRadius: 16, padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <Check size={18} color={T.green} strokeWidth={2.5} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: ff(), fontSize: 13, fontWeight: 700, color: T.t1 }}>
                {selectedFacility.facilityName} · {formatTimeLabel(selSlot.start)} – {formatTimeLabel(selSlot.end)}
              </div>
              <div style={{ fontFamily: ff(), fontSize: 12, color: T.t2, marginTop: 2 }}>
                {dates[selDateIdx].label || dates[selDateIdx].d.toLocaleDateString("en-IN", { weekday: "long", month: "short", day: "numeric" })}
              </div>
            </div>
            <div style={{ fontFamily: ff("mono"), fontSize: 18, fontWeight: 700, color: T.green }}>₹{selSlot.price}</div>
          </div>

          <PrimaryBtn
            label={`Continue — ₹${selSlot.price}`}
            onClick={() => onNext({
              facility: selectedFacility,
              slot: selSlot,
              date: dates[selDateIdx],
              gstRate,
            })}
            icon={ArrowRight}
          />
        </div>
      )}
    </div>
  );
}

// ─── SCREEN 3: CONFIRM + PAY ────────────────────────────────────────────────

function ConfirmPayScreen({ venue, sport, selection, onSuccess, onBack }) {
  const { facility, slot, date, gstRate: gst } = selection;
  const pricePerHour = slot.price;
  const hours = 1;
  const subtotal = Math.round(pricePerHour * hours * 100) / 100;
  const gstRate = gst || 18;
  const gstAmount = Math.round(subtotal * gstRate / 100 * 100) / 100;
  const total = Math.round((subtotal + gstAmount) * 100) / 100;

  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);

  const handlePay = async () => {
    setPaying(true);
    setError(null);
    try {
      const { data } = await axios.post(`${API_URL}/bookings/instant`, {
        facilityId: facility.facilityId,
        date: date.iso,
        startTime: slot.start,
        endTime: slot.end,
      }, { headers: getAuthHeaders() });

      onSuccess(data);
    } catch (err) {
      const msg = err.response?.data?.message || "Booking failed. Please try again.";
      setError(msg);
      setPaying(false);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "0 0 32px" }}>
      <div style={{ padding: "20px 22px 0", display: "flex", alignItems: "center", gap: 14, animation: "fadeUp .4s ease both" }}>
        <BackBtn onBack={onBack} />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: ff(), fontSize: 22, fontWeight: 800, color: T.t1, letterSpacing: "-.4px" }}>Confirm Booking</h1>
          <p style={{ fontFamily: ff(), fontSize: 12, color: T.t2, marginTop: 2 }}>Review and pay</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, background: `${T.green}18`, border: `1px solid ${T.green}30`, borderRadius: 99, padding: "6px 12px" }}>
          <Shield size={12} color={T.green} />
          <span style={{ fontFamily: ff(), fontSize: 11, fontWeight: 600, color: T.green }}>Secure</span>
        </div>
      </div>

      <div style={{ padding: "20px 22px 0" }}>
        {/* Booking details card */}
        <div style={{ background: T.card, borderRadius: 20, border: `1px solid ${T.border}`, overflow: "hidden", marginBottom: 16, animation: "fadeUp .4s ease .06s both" }}>
          <div style={{ height: 5, background: `linear-gradient(90deg,${T.blue},${T.indigo})` }} />
          <div style={{ padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg,${T.blue},${T.indigo})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                {sport?.emoji || "🏟"}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontFamily: ff(), fontSize: 16, fontWeight: 700, color: T.t1, marginBottom: 2 }}>{venue.name}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <MapPin size={11} color={T.t3} />
                  <span style={{ fontFamily: ff(), fontSize: 12, color: T.t2 }}>{venue.location?.city || ""}</span>
                </div>
              </div>
            </div>

            {[
              { label: "Facility", value: facility.facilityName + (facility.surfaceType ? ` · ${facility.surfaceType}` : "") },
              { label: "Date", value: date.label || date.d.toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" }) },
              { label: "Time Slot", value: `${formatTimeLabel(slot.start)} – ${formatTimeLabel(slot.end)}` },
              { label: "Duration", value: `${hours} hour` },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontFamily: ff(), fontSize: 12, color: T.t2 }}>{label}</span>
                <span style={{ fontFamily: ff(), fontSize: 13, fontWeight: 600, color: T.t1 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Price breakdown */}
        <div style={{ background: T.card, borderRadius: 20, border: `1px solid ${T.border}`, padding: "16px", marginBottom: 20, animation: "fadeUp .4s ease .12s both" }}>
          <div style={{ fontFamily: ff(), fontSize: 14, fontWeight: 700, color: T.t1, marginBottom: 14 }}>💰 Price Breakdown</div>
          {[
            { label: `Court Charges (₹${pricePerHour} × ${hours}h)`, value: `₹${subtotal}` },
            { label: `GST (${gstRate}%)`, value: `₹${gstAmount}` },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontFamily: ff(), fontSize: 12, color: T.t2 }}>{label}</span>
              <span style={{ fontFamily: ff(), fontSize: 12, color: T.t1 }}>{value}</span>
            </div>
          ))}
          <div style={{ height: 1, background: T.border, margin: "10px 0 12px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: ff(), fontSize: 15, fontWeight: 700, color: T.t1 }}>Total</span>
            <span style={{ fontFamily: ff("mono"), fontSize: 24, fontWeight: 800, color: T.blue }}>₹{total.toLocaleString()}</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: `${T.red}15`, border: `1px solid ${T.red}35`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, animation: "slideUp .25s ease both" }}>
            <span style={{ fontFamily: ff(), fontSize: 13, color: T.red, fontWeight: 600 }}>{error}</span>
          </div>
        )}

        {/* Pay button */}
        <div style={{ animation: "fadeUp .4s ease .18s both" }}>
          <button className="btn-press" onClick={handlePay} disabled={paying}
            style={{
              width: "100%", padding: "16px 0", borderRadius: 16, border: "none",
              background: paying ? T.t4 : `linear-gradient(90deg, ${T.green}, #16A34A)`,
              color: paying ? T.t3 : "#fff", cursor: paying ? "not-allowed" : "pointer",
              fontFamily: ff(), fontSize: 15, fontWeight: 800, letterSpacing: ".2px",
              boxShadow: paying ? "none" : `0 12px 32px rgba(34,197,94,.4)`,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
            {paying ? (
              <><RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} /> Processing...</>
            ) : (
              <><Shield size={16} /> Pay ₹{total.toLocaleString()} & Book</>
            )}
          </button>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12 }}>
            <Shield size={12} color={T.t3} />
            <span style={{ fontFamily: ff(), fontSize: 11, color: T.t3 }}>256-bit SSL · Powered by Razorpay</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN 4: BOOKING SUCCESS ──────────────────────────────────────────────

function BookingSuccessScreen({ venue, sport, bookingData, onRestart }) {
  const booking = bookingData?.booking;
  const breakdown = bookingData?.priceBreakdown;
  const ref = `SPZ${booking?.id || Math.floor(Math.random() * 900000 + 100000)}`;
  const [shown, setShown] = useState(false);
  const confettiColors = [T.blue, T.green, T.amber, T.purple, T.cyan, T.red];

  useEffect(() => { setTimeout(() => setShown(true), 80); }, []);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "0 0 40px", position: "relative" }}>
      {/* Confetti */}
      {shown && Array.from({ length: 14 }).map((_, i) => (
        <div key={i} style={{
          position: "absolute", top: 20, left: `${10 + i * 6}%`,
          width: 7 + (i % 4), height: 7 + (i % 3),
          borderRadius: i % 2 === 0 ? "50%" : 3,
          background: confettiColors[i % confettiColors.length],
          animation: `confetti ${1.4 + (i % 5) * .25}s ease ${i * .08}s forwards`,
          zIndex: 10, pointerEvents: "none",
        }} />
      ))}

      {/* Success icon */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 22px 28px", animation: "fadeUp .5s ease both", position: "relative" }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ position: "absolute", top: 48, width: 96 + i * 32, height: 96 + i * 32, borderRadius: "50%", border: `1px solid ${T.green}`, animation: `ringPulse ${1 + i * .4}s ease-out ${i * .3}s infinite`, opacity: .5 }} />
        ))}

        <div style={{ width: 96, height: 96, borderRadius: "50%", background: `linear-gradient(135deg,#15803D,${T.green})`, display: "flex", alignItems: "center", justifyContent: "center", animation: "popIn .6s cubic-bezier(.34,1.56,.64,1) .2s both", boxShadow: `0 0 0 14px ${T.green}15`, zIndex: 1, position: "relative" }}>
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <path d="M10 22 L18 31 L34 14" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ strokeDasharray: 100, strokeDashoffset: shown ? 0 : 100, transition: "stroke-dashoffset 0.6s ease 0.5s" }} />
          </svg>
        </div>

        <h1 style={{ fontFamily: ff(), fontSize: 27, fontWeight: 800, color: T.t1, letterSpacing: "-.5px", marginTop: 22, marginBottom: 6 }}>
          Booking Confirmed!
        </h1>
        <p style={{ fontFamily: ff(), fontSize: 13, color: T.t2, textAlign: "center", lineHeight: 1.6, maxWidth: 260 }}>
          Your court is locked in. Get ready to play!
        </p>
        <div style={{ marginTop: 14, background: T.card2, border: `1px solid ${T.bord2}`, borderRadius: 12, padding: "8px 20px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.green, animation: "glowPulse 2s ease-in-out infinite" }} />
          <span style={{ fontFamily: ff("mono"), fontSize: 13, fontWeight: 700, color: T.blue2 }}>{ref}</span>
        </div>
      </div>

      <div style={{ padding: "0 22px" }}>
        {/* Booking card */}
        <div style={{ background: T.card, borderRadius: 22, border: `1px solid ${T.border}`, overflow: "hidden", marginBottom: 16, animation: "fadeUp .4s ease .35s both" }}>
          <div style={{ height: 4, background: `linear-gradient(90deg,${T.blue},${T.green},${T.indigo})` }} />
          <div style={{ padding: "18px 18px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: `linear-gradient(135deg,${T.blue},${T.indigo})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                {sport?.emoji || "🏟"}
              </div>
              <div>
                <div style={{ fontFamily: ff(), fontSize: 15, fontWeight: 700, color: T.t1 }}>{venue?.name || booking?.venue?.name}</div>
                <div style={{ fontFamily: ff(), fontSize: 12, color: T.t2, marginTop: 2 }}>{booking?.facilityName}</div>
              </div>
            </div>

            {[
              { label: "Date", value: booking?.bookingDate ? new Date(booking.bookingDate).toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" }) : "-" },
              { label: "Time", value: booking ? `${formatTimeLabel(booking.startTime)} – ${formatTimeLabel(booking.endTime)}` : "-" },
              { label: "Amount", value: `₹${booking?.totalAmount?.toLocaleString() || "0"}` },
              { label: "Ref", value: ref },
            ].map(({ label, value }, i, arr) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: i < arr.length - 1 ? 10 : 0, marginBottom: i < arr.length - 1 ? 10 : 0, borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                <span style={{ fontFamily: ff(), fontSize: 12, color: T.t2 }}>{label}</span>
                <span style={{ fontFamily: ff(), fontSize: 13, fontWeight: 700, color: label === "Amount" ? T.green : T.t1 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Post-booking actions */}
        <div style={{ fontFamily: ff(), fontSize: 12, fontWeight: 600, color: T.t3, marginBottom: 10, letterSpacing: ".3px", textTransform: "uppercase", animation: "fadeUp .4s ease .42s both" }}>
          What's next?
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20, animation: "fadeUp .4s ease .45s both" }}>
          {[
            { icon: Users, label: "Invite Players", sub: "Share with friends to fill the court", color: T.blue },
            { icon: Zap, label: "Create Open Play", sub: "Let others join your session", color: T.green },
            { icon: Share2, label: "Share Booking", sub: "Send booking details via WhatsApp", color: T.purple },
          ].map(({ icon: Ic, label, sub, color }) => (
            <button key={label} className="btn-press" style={{
              background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "14px 16px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Ic size={18} color={color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: ff(), fontSize: 13, fontWeight: 700, color: T.t1 }}>{label}</div>
                <div style={{ fontFamily: ff(), fontSize: 11, color: T.t3, marginTop: 1 }}>{sub}</div>
              </div>
              <ChevronRight size={16} color={T.t3} />
            </button>
          ))}
        </div>

        <PrimaryBtn label="Back to Home" onClick={onRestart} />
      </div>
    </div>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────

const STEPS = ["sport-venue", "slots", "confirm-pay", "success"];

export default function InstantBookFlow({ onBack, onComplete }) {
  const [step, setStep] = useState(0);
  const [venue, setVenue] = useState(null);
  const [sport, setSport] = useState(null);
  const [selection, setSelection] = useState(null);
  const [bookingResult, setBookingResult] = useState(null);
  const prevStep = useRef(0);

  const goTo = (i) => { prevStep.current = step; setStep(i); };
  const goBack = () => {
    if (step === 0 && onBack) onBack();
    else goTo(step - 1);
  };

  const direction = step > prevStep.current ? "slideR" : "slideL";
  const anim = step === 0 ? "fadeIn" : direction;

  const renderScreen = () => {
    switch (STEPS[step]) {
      case "sport-venue":
        return (
          <SportVenueScreen
            onBack={step === 0 ? onBack : undefined}
            onNext={(v, sp) => { setVenue(v); setSport(sp); goTo(1); }}
          />
        );
      case "slots":
        return (
          <SlotGridScreen
            venue={venue}
            sport={sport}
            onBack={goBack}
            onNext={(sel) => { setSelection(sel); goTo(2); }}
          />
        );
      case "confirm-pay":
        return (
          <ConfirmPayScreen
            venue={venue}
            sport={sport}
            selection={selection}
            onBack={goBack}
            onSuccess={(data) => { setBookingResult(data); goTo(3); }}
          />
        );
      case "success":
        return (
          <BookingSuccessScreen
            venue={venue}
            sport={sport}
            bookingData={bookingResult}
            onRestart={() => {
              onComplete && onComplete(bookingResult);
              setStep(0); setVenue(null); setSport(null); setSelection(null); setBookingResult(null);
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="instant-book-flow" style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", fontFamily: "'Sora',sans-serif" }}>
      {/* Progress bar */}
      {step < 3 && (
        <div style={{ padding: "12px 22px 8px", flexShrink: 0 }}>
          <div style={{ height: 3, borderRadius: 99, background: T.t4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${((step + 1) / 4) * 100}%`, background: `linear-gradient(90deg,${T.blue},${T.green})`, borderRadius: 99, transition: "width .4s cubic-bezier(.22,1,.36,1)", boxShadow: `0 0 8px ${T.blue}60` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontFamily: ff(), fontSize: 11, color: T.t3, fontWeight: 500 }}>Step {step + 1} of 3</span>
            <span style={{ fontFamily: ff(), fontSize: 11, color: T.blue, fontWeight: 600 }}>
              {["Select Venue", "Pick Slot", "Pay & Book"][step]}
            </span>
          </div>
        </div>
      )}

      {/* Screen */}
      <div key={step} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", animation: `${anim} .3s ease both` }}>
        {renderScreen()}
      </div>
    </div>
  );
}
