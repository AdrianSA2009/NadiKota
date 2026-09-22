import type { LucideIcon } from "lucide-react";

interface IconProps {
  icon: LucideIcon;
  className?: string;
  size?: number;
  strokeWidth?: number;
}

export function Icon({ icon: IconComponent, className, size, strokeWidth }: IconProps) {
  return <IconComponent className={className ?? "size-5"} size={size} strokeWidth={strokeWidth ?? 2} aria-hidden="true" />;
}