interface PageSkeletonProps {
  /** Number of card skeletons to render */
  cards?: number;
  /** Show a heading skeleton at the top */
  heading?: boolean;
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-tertiary ${className}`} />;
}

export default function PageSkeleton({ cards = 3, heading = true }: PageSkeletonProps) {
  return (
    <div className="p-4 space-y-4">
      {heading && (
        <div className="space-y-2">
          <SkeletonBlock className="h-7 w-48" />
          <SkeletonBlock className="h-4 w-32" />
        </div>
      )}
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <SkeletonBlock className="h-5 w-3/4" />
          <SkeletonBlock className="h-4 w-1/2" />
          <SkeletonBlock className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}
