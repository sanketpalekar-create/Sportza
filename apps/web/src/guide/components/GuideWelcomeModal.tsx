import Logo from "../../components/Logo";

interface GuideWelcomeModalProps {
  open: boolean;
  onTour: () => void;
  onSkip: () => void;
}

export default function GuideWelcomeModal({ open, onTour, onSkip }: GuideWelcomeModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sportza-welcome-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/75"
        aria-label="Dismiss welcome"
        onClick={onSkip}
      />
      <div
        className="relative z-10 mx-4 mb-4 w-full max-w-md rounded-2xl px-6 py-7 sm:mb-0"
        style={{
          background: "linear-gradient(165deg, #1E3A8A 0%, #0F172A 55%, #0B1220 100%)",
          border: "1px solid rgba(59,130,246,0.35)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
        }}
      >
        <div className="mb-4 flex justify-center">
          <Logo />
        </div>
        <h2
          id="sportza-welcome-title"
          className="text-center text-2xl font-bold"
          style={{ color: "#F8FAFC" }}
        >
          Welcome to Sportza
        </h2>
        <p className="mt-1 text-center text-sm font-semibold" style={{ color: "#60A5FA" }}>
          हर दिन. Game On.
        </p>
        <p className="mt-4 text-center text-sm leading-relaxed" style={{ color: "#CBD5E1" }}>
          Your game starts here. Discover venues. Find people to play with. Train. Track your
          performance. Compete.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onTour}
            className="rounded-xl px-4 py-3 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            style={{ backgroundColor: "#3B82F6" }}
          >
            Take a quick tour
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            style={{ color: "#94A3B8" }}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
