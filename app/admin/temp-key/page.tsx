import { getSession } from "@/lib/auth";
import { getActiveTempKeys } from "@/lib/db";
import { redirect } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import TempKeyManager from "@/components/admin/TempKeyManager";

export default async function TempKeyPage() {
  const session = await getSession();

  // Temp admin tidak bisa akses halaman ini
  if (session?.role !== "admin") {
    redirect("/admin");
  }

  const activeTempKeys = await getActiveTempKeys();

  return (
    <AdminLayout role={session.role} permissions={session.permissions}>
      <div className="mb-6">
        <p className="text-xs font-mono text-gray-500 mb-1">/ admin / temp-key</p>
        <h1 className="font-display font-bold text-2xl text-gray-900">Temp Key</h1>
        <p className="text-gray-600 text-sm mt-1">
          Generate key sementara untuk mendelegasikan akses tanpa berbagi key utama.
        </p>
      </div>

      <TempKeyManager
        slotId={session!.slot_id!}
        slotLabel={session!.label}
        activeTempKeys={activeTempKeys}
      />
    </AdminLayout>
  );
}
