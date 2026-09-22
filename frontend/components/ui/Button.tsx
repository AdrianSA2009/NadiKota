import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-primary-800 text-neutral-0 hover:bg-primary-700 active:bg-primary-900",
  secondary: "border border-primary-200 bg-neutral-0 text-primary-800 hover:bg-primary-50",
  danger: "bg-danger-700 text-neutral-0 hover:bg-danger-600",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`min-h-11 rounded-lg px-4 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
