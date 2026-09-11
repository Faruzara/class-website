"use client";

import Image from "next/image";
import Link from "next/link";

type PageFailureProps = {
  code: string;
  title: string;
  description: string;
  onRetry?: () => void;
};

export default function PageFailure({ code, title, description, onRetry }: PageFailureProps) {
  return (
    <main className="relative flex min-h-svh flex-col items-center overflow-hidden bg-white px-6 pb-48 pt-[18vh] text-center sm:pb-56">
      <p className="font-mono text-[11px] font-semibold uppercase text-brand-600">{code}</p>
      <h1 className="mt-4 font-serif text-4xl font-light text-gray-900 sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-gray-500">{description}</p>

      <div className="mt-8 flex items-center gap-5 text-sm font-semibold">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 rounded-sm bg-brand-600 px-5 text-white transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            Coba lagi
          </button>
        )}
        <Link href="/" className="border-b border-gray-300 py-2 text-gray-700 transition-colors hover:border-brand-500 hover:text-brand-700">
          Kembali ke beranda
        </Link>
      </div>

      <Image
        src="/images/silly-cat.gif"
        alt="Kucing anime sedang menunggu"
        width={498}
        height={498}
        unoptimized
        priority
        className="pointer-events-none absolute bottom-0 left-1/2 h-auto w-36 -translate-x-1/2 select-none sm:w-44"
      />
    </main>
  );
}
