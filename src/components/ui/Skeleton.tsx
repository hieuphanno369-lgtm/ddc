export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />;
}

export function CardSkeleton({ h = 180 }: { h?: number }) {
  return (
    <div className="card p-5">
      <Skeleton className="mb-3 h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <div className="mt-4" style={{ height: h }}>
        <Skeleton className="h-full w-full" />
      </div>
    </div>
  );
}
