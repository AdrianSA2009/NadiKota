interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-pulse rounded-lg bg-neutral-200 ${className}`} aria-label="Memuat konten" role="status" />;
}
