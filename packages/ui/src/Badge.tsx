import React from "react";

export type BadgeVariant = "default" | "success" | "warning" | "error" | "info";
export type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-tertiary text-text-secondary",
  success: "bg-status-successBg text-green-700",
  warning: "bg-status-warningBg text-amber-700",
  error: "bg-status-errorBg text-red-700",
  info: "bg-status-infoBg text-blue-700",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
};

export const Badge: React.FC<BadgeProps> = ({
  variant = "default",
  size = "sm",
  className = "",
  children,
  ...props
}) => {
  return (
    <span
      className={[
        "inline-flex items-center font-medium rounded-full",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </span>
  );
};
