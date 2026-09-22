import React, { useCallback, useEffect, useRef, useState } from "react";

export interface PopoverProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: "top" | "bottom" | "left" | "right";
  className?: string;
  contentClassName?: string;
  /** Accessible label for the popover panel */
  label?: string;
}

export const Popover: React.FC<PopoverProps> = ({
  trigger,
  content,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  placement = "bottom",
  className = "",
  contentClassName = "",
  label = "More information",
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange]
  );

  const updatePosition = useCallback(() => {
    const root = rootRef.current;
    const panel = panelRef.current;
    if (!root || !panel) return;
    const rect = root.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const gap = 8;
    let top = rect.bottom + gap;
    let left = rect.left;

    if (placement === "top") {
      top = rect.top - panelRect.height - gap;
      left = rect.left + rect.width / 2 - panelRect.width / 2;
    } else if (placement === "bottom") {
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - panelRect.width / 2;
    } else if (placement === "left") {
      top = rect.top + rect.height / 2 - panelRect.height / 2;
      left = rect.left - panelRect.width - gap;
    } else if (placement === "right") {
      top = rect.top + rect.height / 2 - panelRect.height / 2;
      left = rect.right + gap;
    }

    left = Math.max(8, Math.min(left, window.innerWidth - panelRect.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - panelRect.height - 8));
    setCoords({ top, left });
  }, [placement]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, setOpen, updatePosition]);

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={label}
          className={`fixed z-50 max-w-xs rounded-lg border border-border bg-surface p-3 shadow-lg ${contentClassName}`}
          style={
            coords
              ? { top: coords.top, left: coords.left }
              : { visibility: "hidden" as const }
          }
        >
          {content}
        </div>
      )}
    </div>
  );
};
