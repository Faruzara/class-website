"use client";

import PageFailure from "@/components/layout/PageFailure";

export default function OwnerError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageFailure
      code="Owner Control / Error"
      title="Dashboard belum bisa dimuat."
      description="Data kamu tidak diubah. Coba muat kembali halaman Owner."
      onRetry={reset}
    />
  );
}
