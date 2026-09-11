import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XI TP2 SKANJA",
  description: "Portal resmi kelas XI Teknik Pemesinan 2",
};

export const viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="bg-surface-base text-gray-900 font-body antialiased">
        {children}
      </body>
    </html>
  );
}
