import React, { useState, useMemo } from "react";

export interface DatePickerProps {
  value?: Date;
  onChange: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  label?: string;
  error?: string;
  placeholder?: string;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  minDate,
  maxDate,
  label,
  error,
  placeholder = "Select date",
}) => {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value || new Date());

  const days = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const result: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) result.push(new Date(year, month, d));
    return result;
  }, [viewDate]);

  const isDisabled = (date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const formatDate = (d: Date) =>
    `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;

  return (
    <div className="relative flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-text-primary">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
          error
            ? "border-status-error"
            : "border-border hover:border-primary-400 focus:ring-2 focus:ring-primary-500"
        } ${value ? "text-text-primary" : "text-text-tertiary"}`}
      >
        {value ? formatDate(value) : placeholder}
      </button>
      {error && <p className="text-xs text-status-error">{error}</p>}

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 rounded-lg border border-border bg-surface p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
              className="rounded p-1 hover:bg-surface-tertiary"
            >
              ◀
            </button>
            <span className="text-sm font-semibold text-text-primary">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
              className="rounded p-1 hover:bg-surface-tertiary"
            >
              ▶
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-text-tertiary py-1">
                {d}
              </div>
            ))}
            {days.map((day, i) =>
              day ? (
                <button
                  key={i}
                  type="button"
                  disabled={isDisabled(day)}
                  onClick={() => {
                    onChange(day);
                    setOpen(false);
                  }}
                  className={`rounded-md py-1.5 text-center text-sm transition-colors ${
                    value && isSameDay(day, value)
                      ? "bg-primary-500 text-white"
                      : isSameDay(day, new Date())
                        ? "bg-primary-50 text-primary-600 font-semibold"
                        : "text-text-primary hover:bg-surface-tertiary"
                  } ${isDisabled(day) ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {day.getDate()}
                </button>
              ) : (
                <div key={i} />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};
