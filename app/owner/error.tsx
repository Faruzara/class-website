"use client";

export default function OwnerError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="py-12">
      <p className="font-mono text-[11px] uppercase text-brand-700">Owner Control / Error</p>
      <h1 className="mt-4 font-display text-3xl font-semibold text-gray-900">Overview could not be opened.</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-gray-500">Data kamu tidak diubah. Coba muat kembali halaman Owner.</p>
      <button type="button" onClick={reset} className="mt-7 min-h-11 bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
        Try again
      </button>
    </main>
  );
}
