import React from "react";

export type CardVariant = "standard" | "elevated" | "outlined";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: "none" | "sm" | "md" | "lg";
}

const variantClasses: Record<CardVariant, string> = {
  standard: "bg-surface border border-border",
  elevated: "bg-surface-elevated shadow-md",
  outlined: "bg-surface border-2 border-border",
};

const paddingClasses: Record<string, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "standard", padding = "md", className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={[
          "rounded-lg transition-shadow",
          variantClasses[variant],
          paddingClasses[padding],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHeader: React.FC<CardHeaderProps> = ({ className = "", children, ...props }) => (
  <div className={`mb-3 ${className}`} {...props}>
    {children}
  </div>
);

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle: React.FC<CardTitleProps> = ({ className = "", children, ...props }) => (
  <h3 className={`text-lg font-semibold text-text-primary ${className}`} {...props}>
    {children}
  </h3>
);

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent: React.FC<CardContentProps> = ({ className = "", children, ...props }) => (
  <div className={className} {...props}>
    {children}
  </div>
);
