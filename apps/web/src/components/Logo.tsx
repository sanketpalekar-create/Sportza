/**
 * Sportza brand logo — uses the official brand SVG asset.
 *
 * The SVG has a white background and navy mark; on dark app surfaces it is
 * shown inside a white rounded container so the mark is always visible.
 *
 * Props are kept identical to the previous version so every call site
 * continues to work without change.
 *
 * Color modes
 *   light — white pill container  (for dark backgrounds — app default)
 *   dark  — transparent container (for light backgrounds)
 */

interface LogoProps {
  size?: "sm" | "md" | "lg";
  /** "icon" = mark only  |  "full" = mark + wordmark */
  variant?: "full" | "icon";
  /** "light" = on dark bg (default)  |  "dark" = on light bg */
  color?: "light" | "dark";
  className?: string;
  /** Show the tagline "हर दिन. Game On." — only meaningful when variant="full" */
  tagline?: boolean;
}

const sizes = {
  sm: { icon: 32,  wordmark: 18, tag: 9  },
  md: { icon: 44,  wordmark: 24, tag: 11 },
  lg: { icon: 64,  wordmark: 34, tag: 14 },
};

const NAVY  = "#1B2380";
const WHITE = "#FFFFFF";

export default function Logo({
  size = "md",
  variant = "full",
  color = "light",
  tagline = false,
  className = "",
}: LogoProps) {
  const { icon: iconSize, wordmark: wordmarkSize, tag: tagSize } = sizes[size];
  const onDark = color === "light";        // rendering on a dark background?
  const textColor = onDark ? WHITE : NAVY;

  // On dark backgrounds wrap the logo in a white rounded pill so the navy
  // mark stays readable; on light backgrounds show it bare.
  const containerStyle: React.CSSProperties = {
    width: iconSize,
    height: iconSize,
    flexShrink: 0,
    borderRadius: "22%",
    overflow: "hidden",
    ...(onDark
      ? { backgroundColor: WHITE, padding: 2 }
      : { backgroundColor: "transparent" }),
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Brand mark */}
      <div style={containerStyle}>
        <img
          src="/logo.svg"
          alt="Sportza"
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      </div>

      {/* Wordmark + tagline (when variant="full") */}
      {variant === "full" && (
        <div className="flex flex-col leading-none">
          <span
            style={{
              fontSize: wordmarkSize,
              fontWeight: 700,
              color: textColor,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            Sportza
          </span>
          {tagline && (
            <span
              style={{
                fontSize: tagSize,
                fontWeight: 400,
                color: textColor,
                opacity: 0.75,
                marginTop: 3,
                letterSpacing: "0.01em",
              }}
            >
              हर दिन. Game On.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
