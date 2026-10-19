import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Boxes,
  Store,
  LayoutDashboard,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ArrowRight,
  Activity,
  Sparkles,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({ component: Home });

interface ShelfBarProps {
  totalSlots?: number;
  filledSlots: number;
  status: "ok" | "warn" | "crit";
}

function ShelfBar({ totalSlots = 10, filledSlots, status }: ShelfBarProps) {
  const activeColor =
    status === "ok"
      ? "bg-ok"
      : status === "warn"
        ? "bg-warn"
        : "bg-crit";

  return (
    <div className="flex items-center gap-1" role="progressbar" aria-valuenow={filledSlots} aria-valuemin={0} aria-valuemax={totalSlots}>
      {Array.from({ length: totalSlots }).map((_, i) => (
        <span
          key={i}
          className={`h-4 w-2.5 rounded-[2px] transition-all duration-300 ${
            i < filledSlots ? activeColor : "bg-line/40 dark:bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

function Home() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: async () => (await api.health.get()).data,
  });

  return (
    <div className="min-h-screen bg-paper text-text">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-ink-700 text-white shadow-xs">
              <Boxes className="size-6 stroke-[1.8]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold tracking-tight text-ink-900">
                  Daisuki
                </span>
                <span className="rounded-sm bg-ume/10 px-1.5 py-0.5 text-[11px] font-semibold text-ume">
                  B2B
                </span>
              </div>
              <p className="text-xs text-muted">Sistem Inventaris & Pemesanan Multi-Cabang</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {health.isLoading ? (
              <Badge variant="outline" className="gap-1.5 border-line bg-surface text-muted">
                <Activity className="size-3 animate-spin text-ink-500" />
                <span className="hidden sm:inline">Memeriksa API…</span>
              </Badge>
            ) : health.data?.ok ? (
              <Badge variant="outline" className="gap-1.5 border-ok/30 bg-ok-bg text-ok-fg">
                <span className="size-1.5 rounded-full bg-ok animate-pulse" />
                <span className="hidden sm:inline">API Terhubung</span>
                <span className="sm:hidden">Online</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1.5 border-crit/30 bg-crit-bg text-crit-fg">
                <span className="size-1.5 rounded-full bg-crit" />
                <span>API Terputus</span>
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Hero Section */}
        <div className="mb-10 text-center sm:mb-14">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-700 shadow-xs">
            <Sparkles className="size-3.5 text-ume" />
            <span>Monorepo Modern: TanStack Start + ElysiaJS + Supabase</span>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900 sm:text-5xl">
            Kontrol Stok Akurat, <br className="hidden sm:inline" />
            <span className="text-ink-700">Restock Tepat Waktu</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted sm:text-lg">
            Platform terpadu untuk menghubungkan seluruh mitra cabang dengan pabrik pusat Daisuki.
            Pantau stok secara real-time dan optimalkan kuantitas produksi secara presisi.
          </p>
        </div>

        {/* Two Main Role Portals */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Portal Mitra Card */}
          <Card className="border-line bg-surface transition-all duration-200 hover:border-ink-500/40 hover:shadow-md">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex size-12 items-center justify-center rounded-md bg-ink-100 text-ink-700">
                  <Store className="size-6 stroke-[1.8]" />
                </div>
                <Badge variant="secondary" className="bg-ink-50 text-ink-700">
                  Mobile-First • PIC Toko
                </Badge>
              </div>
              <CardTitle className="mt-4 font-display text-2xl font-bold text-ink-900">
                Portal Mitra Cabang
              </CardTitle>
              <CardDescription className="text-muted">
                Didesain khusus untuk perangkat mobile PIC di lapangan dengan interaksi minim klik.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-6 text-sm text-text">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 text-ok" />
                <span>Entri cepat stok fisik harian maksimal 3 ketukan per produk</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 text-ok" />
                <span>Pengajuan pesanan restock dengan estimasi kebutuhan otomatis</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 text-ok" />
                <span>Konfirmasi penerimaan barang dan riwayat log mutasi stok</span>
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button asChild className="w-full bg-ink-700 text-white hover:bg-ink-500">
                <Link to="/" className="flex items-center justify-center gap-2">
                  <span>Buka Portal Mitra</span>
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Dashboard Admin Card */}
          <Card className="border-line bg-surface transition-all duration-200 hover:border-ink-500/40 hover:shadow-md">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex size-12 items-center justify-center rounded-md bg-ink-900 text-white">
                  <LayoutDashboard className="size-6 stroke-[1.8]" />
                </div>
                <Badge variant="secondary" className="bg-ink-50 text-ink-700">
                  Desktop • Manajemen Pusat
                </Badge>
              </div>
              <CardTitle className="mt-4 font-display text-2xl font-bold text-ink-900">
                Dashboard Admin Pusat
              </CardTitle>
              <CardDescription className="text-muted">
                Pusat kendali operasional pabrik untuk memantau status cabang dan persetujuan order.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-6 text-sm text-text">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 text-ok" />
                <span>Live monitoring stok semua mitra dengan Supabase Realtime</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 text-ok" />
                <span>Approval workflow & penyesuaian kuantitas restock per batch pabrik</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 text-ok" />
                <span>Reminder otomatis harian untuk cabang yang terlambat update stok</span>
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button asChild variant="outline" className="w-full border-ink-700 text-ink-700 hover:bg-ink-50">
                <Link to="/" className="flex items-center justify-center gap-2">
                  <span>Masuk Dashboard Admin</span>
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Signature Element Showcase: "Rak Bar" */}
        <section className="mt-12 rounded-xl border border-line bg-surface p-6 sm:p-8">
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-bold text-ink-900">
                  Pratinjau Desain: Indikator "Rak Bar"
                </h2>
                <Badge variant="outline" className="border-line bg-paper text-muted text-xs">
                  Design System Default
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                Elemen visual khas Daisuki: 10 slot rak terisi sesuai persentase sisa stok terhadap par level.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <ShieldCheck className="size-4 text-ink-700" />
              <span>Aman bagi pembaca layar & kontras tinggi</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Safe Status Item */}
            <div className="flex flex-col justify-between rounded-lg border border-line bg-paper p-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text">Keripik Singkong Original</span>
                  <span className="inline-flex items-center gap-1 rounded-sm bg-ok-bg px-2 py-0.5 text-xs font-semibold text-ok-fg">
                    <CheckCircle2 className="size-3.5" />
                    Aman
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">Par level: 50 pcs</p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
                <ShelfBar totalSlots={10} filledSlots={6} status="ok" />
                <span className="font-display text-sm font-bold tabular-nums text-text">
                  31 pcs (62%)
                </span>
              </div>
            </div>

            {/* Warning Status Item */}
            <div className="flex flex-col justify-between rounded-lg border border-line bg-paper p-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text">Basreng Pedas Daun Jeruk</span>
                  <span className="inline-flex items-center gap-1 rounded-sm bg-warn-bg px-2 py-0.5 text-xs font-semibold text-warn-fg">
                    <AlertTriangle className="size-3.5" />
                    Waspada
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">Par level: 40 pcs</p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
                <ShelfBar totalSlots={10} filledSlots={3} status="warn" />
                <span className="font-display text-sm font-bold tabular-nums text-text">
                  14 pcs (35%)
                </span>
              </div>
            </div>

            {/* Critical Status Item */}
            <div className="flex flex-col justify-between rounded-lg border border-line bg-paper p-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text">Saus Keju Khas Daisuki</span>
                  <span className="inline-flex items-center gap-1 rounded-sm bg-crit-bg px-2 py-0.5 text-xs font-semibold text-crit-fg">
                    <AlertOctagon className="size-3.5" />
                    Kritis
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">Par level: 60 botol</p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
                <ShelfBar totalSlots={10} filledSlots={1} status="crit" />
                <span className="font-display text-sm font-bold tabular-nums text-crit-fg">
                  9 botol (15%)
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Highlights Grid */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ink-50 text-ink-700">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-ink-900">Lead Time Pabrik 5-7 Hari</h3>
              <p className="text-xs text-muted">Sinkronisasi pesanan dengan kapasitas batch 1.000 unit</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ink-50 text-ink-700">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-ink-900">Tenant Isolation & RLS</h3>
              <p className="text-xs text-muted">Data stok antar cabang terisolasi aman di level database</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ink-50 text-ink-700">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-ink-900">Model AI Terintegrasi</h3>
              <p className="text-xs text-muted">Prediksi kebutuhan stok harian berbasis machine learning</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-line bg-surface py-6 text-center text-xs text-muted">
        <p>© 2026 Daisuki Snack & Food. Built with TanStack Start, ElysiaJS, and Tailwind CSS v4.</p>
      </footer>
    </div>
  );
}