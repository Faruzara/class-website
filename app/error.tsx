"use client";

import PageFailure from "@/components/layout/PageFailure";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageFailure
      code="Error"
      title="Halaman belum bisa dimuat."
      description="Tidak ada data yang diubah. Coba muat halaman ini sekali lagi."
      onRetry={reset}
    />
  );
}
