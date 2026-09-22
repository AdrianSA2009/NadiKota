import { CircleX, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="rounded-xl border border-danger-600 bg-danger-50 p-4 text-danger-700">
      <div className="flex items-center gap-2">
        <CircleX className="size-5" aria-hidden="true" />
        <p className="font-semibold">Terjadi kesalahan</p>
      </div>
      <p className="mt-1 text-sm">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-danger-700 px-3 py-2 text-sm font-semibold text-neutral-0 hover:bg-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2">
          <RefreshCw className="size-4" aria-hidden="true" />
          Coba lagi
        </button>
      )}
    </div>
  );
}
