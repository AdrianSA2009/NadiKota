import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`rounded-xl border border-neutral-200 bg-neutral-0 p-4 text-neutral-900 shadow-sm hover:border-primary-200 ${className}`}>
      {children}
    </div>
  );
}
