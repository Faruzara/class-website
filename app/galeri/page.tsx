import PublicLayout from "@/components/layout/PublicLayout";
import PublicGallery from "@/components/gallery/PublicGallery";

export default function GaleriPage() {
  return (
    <PublicLayout>
      <main className="mx-auto max-w-7xl px-5 pb-8 pt-14 md:pb-32 md:pt-20 lg:px-8">
        <header className="relative z-10 mx-auto mb-8 max-w-3xl text-center md:mb-10">
          <h1 className="font-serif text-4xl font-extralight leading-tight text-gray-900 md:text-5xl">
            Before they became <span className="font-serif font-extralight text-brand-600">memories.</span>
          </h1>
          <p className="mt-4 text-base font-normal leading-normal text-gray-500">
            These were simply moments we were living.
          </p>
        </header>
        <PublicGallery />
      </main>
    </PublicLayout>
  );
}
