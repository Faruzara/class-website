"use client";

import PageFailure from "@/components/layout/PageFailure";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body>
        <PageFailure
          code="Error"
          title="Website belum bisa dimuat."
          description="Ada kendala saat menyiapkan halaman. Silakan coba lagi."
          onRetry={reset}
        />
      </body>
    </html>
  );
}
