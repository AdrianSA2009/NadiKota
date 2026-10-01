import { BookOpen, Bus, Car, Coins, CreditCard, Droplets, Fuel, Gift, Heart, Leaf, Lightbulb, Package, Phone, Recycle, ShieldCheck, ShoppingBag, Smartphone, Sprout, Ticket, Train, Utensils, Wallet, Zap, type LucideIcon } from "lucide-react";

/** Harus identik dengan daftar RewardIconPicker::ICONS di backend. */
export const rewardIcons: Record<string, LucideIcon> = {
  BookOpen, Bus, Car, Coins, CreditCard, Droplets, Fuel, Gift, Heart, Leaf,
  Lightbulb, Package, Phone, Recycle, ShieldCheck, ShoppingBag, Smartphone,
  Sprout, Ticket, Train, Utensils, Wallet, Zap,
};

export function RewardIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && rewardIcons[name]) || Gift;
  return <Icon className={className} aria-hidden="true" />;
}
