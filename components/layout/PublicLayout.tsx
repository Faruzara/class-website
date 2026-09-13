import Navbar from "./Navbar";
import Footer from "./Footer";
import { getPengumuman, getPublicMusicTracks } from "@/lib/db";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [announcements, musicTracks] = await Promise.all([getPengumuman().catch(() => []), getPublicMusicTracks().catch(() => [])]);
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar announcements={announcements} musicTracks={musicTracks} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
