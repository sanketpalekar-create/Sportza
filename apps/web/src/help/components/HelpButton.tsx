import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleHelp, BookOpen, Compass, MessageCircle, X } from "lucide-react";
import { useGuideOptional } from "../../guide/hooks/useGuide";

export default function HelpButton() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const guide = useGuideOptional();

  return (
    <>
      <button
        type="button"
        data-guide="help-button"
        aria-label="Need help?"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="fixed z-[90] flex h-12 w-12 items-center justify-center rounded-full shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
        style={{
          right: 16,
          bottom: "calc(var(--bottom-nav-h, 88px) + 16px + env(safe-area-inset-bottom))",
          backgroundColor: "#3B82F6",
          color: "#fff",
        }}
      >
        <CircleHelp className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Help menu">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60"
            aria-label="Close help menu"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute left-4 right-4 overflow-hidden rounded-2xl"
            style={{
              bottom: "calc(var(--bottom-nav-h, 88px) + 72px + env(safe-area-inset-bottom))",
              backgroundColor: "#1E293B",
              border: "1px solid rgba(148,163,184,0.2)",
            }}
          >
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "rgba(148,163,184,0.12)" }}>
              <div>
                <p className="text-sm font-bold" style={{ color: "#F8FAFC" }}>
                  Need help?
                </p>
                <p className="text-xs" style={{ color: "#64748B" }}>
                  हर दिन. Game On.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul>
              {[
                {
                  icon: BookOpen,
                  label: "Help Center",
                  action: () => navigate("/help"),
                },
                {
                  icon: Compass,
                  label: "Take a Tour",
                  action: () => guide?.startGuide("dashboard"),
                },
                {
                  icon: BookOpen,
                  label: "Getting Started",
                  action: () => navigate("/help/getting-started"),
                },
                {
                  icon: CircleHelp,
                  label: "FAQ",
                  action: () => navigate("/help/faq/frequently-asked-questions"),
                },
                {
                  icon: MessageCircle,
                  label: "Contact Support",
                  action: () => {
                    window.location.href = "mailto:support@sportza.in?subject=Sportza%20Support";
                  },
                },
              ].map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500"
                    style={{ color: "#E2E8F0" }}
                    onClick={() => {
                      setOpen(false);
                      item.action();
                    }}
                  >
                    <item.icon className="h-4 w-4" style={{ color: "#60A5FA" }} aria-hidden />
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
