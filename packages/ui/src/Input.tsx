import React from "react";

export type InputType = "text" | "password" | "email" | "search" | "number" | "tel" | "url" | "date" | "time";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  type?: InputType;
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ type = "text", label, error, helperText, leftIcon, rightIcon, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const hasError = !!error;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">{leftIcon}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            className={[
              "w-full rounded-md border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed",
              hasError
                ? "border-status-error focus:ring-status-error"
                : "border-border focus:ring-primary-500 focus:border-primary-500",
              leftIcon ? "pl-10" : "",
              rightIcon ? "pr-10" : "",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary">{rightIcon}</span>
          )}
        </div>
        {(error || helperText) && (
          <p className={`text-xs ${hasError ? "text-status-error" : "text-text-tertiary"}`}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
