import React from "react";

export interface RatingProps {
  value: number;
  max?: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
  label?: string;
}

const sizeMap = { sm: "w-4 h-4", md: "w-5 h-5", lg: "w-6 h-6" };

const Star: React.FC<{ filled: boolean; size: string; onClick?: () => void; interactive: boolean }> = ({
  filled,
  size,
  onClick,
  interactive,
}) => (
  <svg
    className={`${size} ${filled ? "text-amber-400" : "text-gray-300"} ${
      interactive ? "cursor-pointer hover:scale-110 transition-transform" : ""
    }`}
    onClick={onClick}
    fill={filled ? "currentColor" : "none"}
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={filled ? 0 : 1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
    />
  </svg>
);

export const Rating: React.FC<RatingProps> = ({
  value,
  max = 5,
  onChange,
  size = "md",
  readOnly = false,
  label,
}) => {
  const interactive = !readOnly && !!onChange;

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-sm font-medium text-text-primary">{label}</span>}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: max }, (_, i) => (
          <Star
            key={i}
            filled={i < value}
            size={sizeMap[size]}
            onClick={interactive ? () => onChange!(i + 1) : undefined}
            interactive={interactive}
          />
        ))}
        {readOnly && (
          <span className="ml-1.5 text-sm text-text-secondary">{value.toFixed(1)}</span>
        )}
      </div>
    </div>
  );
};
