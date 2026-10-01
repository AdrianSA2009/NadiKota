import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary-800 text-neutral-0 hover:bg-primary-700 active:bg-primary-900",
  secondary: "border border-primary-200 bg-neutral-0 text-primary-800 hover:bg-primary-50",
  outline: "border border-neutral-300 bg-neutral-0 text-neutral-800 hover:border-primary-300 hover:text-primary-800 active:bg-neutral-100",
  ghost: "text-neutral-700 hover:bg-neutral-100 hover:text-primary-800 active:bg-neutral-100",
  danger: "bg-danger-700 text-neutral-0 hover:bg-danger-600",
};

/** md mempertahankan tampilan lama persis (min-h-11 px-4 py-2.5 text-sm). */
const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 py-1.5 text-xs",
  md: "min-h-11 px-4 py-2.5 text-sm",
  lg: "min-h-12 px-5 py-3 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** State loading: spinner + tombol nonaktif + aria-busy. */
  loading?: boolean;
}

/** Komponen tombol terpusat — varian: primary, secondary, outline, ghost, danger; ukuran: sm, md, lg. */
export function Button({ variant = "primary", size = "md", loading = false, className = "", disabled, children, ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
