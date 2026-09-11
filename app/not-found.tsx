import PageFailure from "@/components/layout/PageFailure";

export default function NotFound() {
  return (
    <PageFailure
      code="404"
      title="Halaman tidak ditemukan."
      description="Alamat ini mungkin sudah berpindah atau memang tidak pernah ada."
    />
  );
}
