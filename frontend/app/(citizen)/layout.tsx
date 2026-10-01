import { NavigationShell } from "@/components/nav/NavigationShell";
import { isPublicVisitor } from "@/lib/publicVisitor";

export default async function CitizenLayout({ children }: { children: React.ReactNode }) {
  return <NavigationShell publicVisitor={await isPublicVisitor()}>{children}</NavigationShell>;
}
