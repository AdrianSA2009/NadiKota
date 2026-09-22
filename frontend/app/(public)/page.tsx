export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <section className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-primary-900">NadiKota</h1>
        <p className="mt-2 text-neutral-700">Pelaporan infrastruktur Kota Batam</p>
        <a
          href="/report"
          className="mt-8 inline-flex min-h-11 items-center rounded-lg bg-action-600 px-6 py-3 text-sm font-semibold text-neutral-0 hover:bg-action-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
        >
          Lapor Kerusakan
        </a>
      </section>
    </main>
  );
}
