import AdminLayout from "@/components/admin/AdminLayout";
import GalleryEditor from "@/components/admin/GalleryEditor";
import { getEditorSession } from "@/lib/auth";
import { getGaleriPage } from "@/lib/db";
import { GALLERY_MANAGEMENT_PAGE_SIZE } from "@/lib/gallery-constants";

export default async function AdminGaleriPage() {
  const [session, gallery] = await Promise.all([
    getEditorSession(),
    getGaleriPage(0, GALLERY_MANAGEMENT_PAGE_SIZE).catch(() => ({ items: [], total: 0 })),
  ]);
  return <AdminLayout role={session?.role} permissions={session?.permissions}><header className="mb-7"><p className="section-kicker mb-2">Konten Publik</p><h1 className="font-display text-3xl font-semibold text-gray-900">Galeri</h1><p className="mt-2 text-sm text-gray-600">Upload foto secara dinamis tanpa batas slot tetap.</p></header><GalleryEditor initialPhotos={gallery.items} initialTotal={gallery.total} /></AdminLayout>;
}
