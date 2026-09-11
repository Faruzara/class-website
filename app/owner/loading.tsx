export default function OwnerLoading() {
  return (
    <main aria-busy="true" aria-label="Loading Owner overview" className="animate-pulse motion-reduce:animate-none">
      <div className="border-b border-surface-border pb-8">
        <div className="h-3 w-28 bg-surface-border" />
        <div className="mt-4 h-9 w-44 bg-surface-border" />
        <div className="mt-3 h-4 w-52 bg-surface-border" />
      </div>
      <div className="grid grid-cols-2 border-b border-surface-border sm:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="min-h-36 border-r border-surface-border px-4 py-6 last:border-r-0">
            <div className="h-3 w-20 bg-surface-border" />
            <div className="mt-5 h-12 w-24 bg-surface-border" />
            <div className="mt-3 h-3 w-28 max-w-full bg-surface-border" />
          </div>
        ))}
      </div>
      <div className="py-10">
        <div className="mb-6 h-3 w-28 bg-surface-border" />
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-[76px] border-t border-surface-border last:border-b" />)}
      </div>
    </main>
  );
}
