import Navbar from "./Navbar";
import Footer from "./Footer";
import { getPengumuman } from "@/lib/db";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const announcements = await getPengumuman().catch(() => []);
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar announcements={announcements} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
