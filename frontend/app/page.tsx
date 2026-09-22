import Link from "next/link";

export default function Home() {
  return <main className="min-h-screen bg-neutral-50 px-6 py-20"><div className="mx-auto max-w-5xl"><p className="font-semibold text-primary-700">NadiKota</p><h1 className="mt-4 max-w-2xl text-5xl font-bold tracking-tight text-neutral-900">Laporkan kerusakan kota, pantau perbaikannya.</h1><p className="mt-6 max-w-xl text-lg text-neutral-700">Salurkan laporan infrastruktur Kota Batam secara cepat dan transparan.</p><Link href="/report" className="mt-8 inline-flex min-h-11 items-center rounded-lg bg-action-600 px-5 py-3 font-semibold text-neutral-0 hover:bg-action-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2">Lapor kerusakan</Link></div></main>;
}
