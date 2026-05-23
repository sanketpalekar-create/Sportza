import React from "react";

export type TrendDirection = "up" | "down" | "neutral";

export interface StatCardProps {
  label: string;
  value: string | number;
  trend?: { value: string; direction: TrendDirection };
  icon?: React.ReactNode;
  className?: string;
}

const trendColors: Record<TrendDirection, string> = {
  up: "text-status-success",
  down: "text-status-error",
  neutral: "text-text-tertiary",
};

const trendIcons: Record<TrendDirection, string> = {
  up: "↑",
  down: "↓",
  neutral: "→",
};

export const StatCard: React.FC<StatCardProps> = ({ label, value, trend, icon, className = "" }) => {
  return (
    <div
      className={`rounded-lg border border-border bg-surface p-4 flex flex-col gap-2 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">{label}</span>
        {icon && <span className="text-text-tertiary">{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-text-primary">{value}</span>
        {trend && (
          <span className={`text-sm font-medium ${trendColors[trend.direction]}`}>
            {trendIcons[trend.direction]} {trend.value}
          </span>
        )}
      </div>
    </div>
  );
};
