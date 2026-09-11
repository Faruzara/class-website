import OwnerRouteShell from "@/components/owner/OwnerRouteShell";

export const dynamic = "force-dynamic";

export default function OwnerRouteLayout({ children }: { children: React.ReactNode }) {
  return <OwnerRouteShell>{children}</OwnerRouteShell>;
}
