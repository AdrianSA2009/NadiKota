import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-neutral-200 bg-neutral-0 p-8 text-center text-neutral-700">
      <Inbox className="size-10 text-neutral-500" strokeWidth={1.5} aria-hidden="true" />
      <h2 className="mt-3 text-lg font-semibold text-neutral-900">{title}</h2>
      <p className="mt-1 max-w-md text-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}