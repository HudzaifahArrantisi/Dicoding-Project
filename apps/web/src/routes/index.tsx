import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const healthApi = useQuery({
    queryKey: ["health-api"],
    queryFn: async () => {
      const res = await api.health.get();
      return res.data;
    },
  });

  const healthDb = useQuery({
    queryKey: ["health-db"],
    queryFn: async () => {
      const res = await api.health.db.get();
      return res.data;
    },
    // Hanya cek database jika API sudah siap
    enabled: !!healthApi.data?.ok,
  });

  return (
    <main className="min-h-screen bg-paper p-8 flex flex-col items-center justify-center text-text">
      <div className="w-full max-w-md bg-white border border-line rounded-2xl p-6 shadow-sm">
        <h1 className="font-display text-2xl font-bold text-ink-900 mb-2">
          Daisuki Inventory
        </h1>
        <p className="text-sm text-muted mb-6">
          Sistem Verifikasi Status Monorepo & Database
        </p>

        <div className="space-y-4">
          {/* Status API */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-line bg-ink-50">
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">
                API
              </p>
              <p className="text-sm font-medium text-ink-900">Port 3001</p>
            </div>
            <div>
              {healthApi.isLoading ? (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                  Memeriksa...
                </span>
              ) : healthApi.data?.ok ? (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#E3F4EA] text-[#14653A]">
                  ● Terhubung
                </span>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FDE7E7] text-[#9B1C1C]">
                  ✕ Terputus
                </span>
              )}
            </div>
          </div>

          {/* Status Database Neon */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-line bg-ink-50">
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">
                Database
              </p>
              <p className="text-sm font-medium text-ink-900">
                {healthDb.data?.now
                  ? new Date(healthDb.data.now).toLocaleTimeString("id-ID")
                  : "Mengecek..."}
              </p>
            </div>
            <div>
              {healthDb.isLoading ? (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                  Memeriksa...
                </span>
              ) : healthDb.data?.ok ? (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#E3F4EA] text-[#14653A]">
                  ● Terhubung
                </span>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FDE7E7] text-[#9B1C1C]">
                  ✕ Terputus
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-line text-center">
          <p className="text-xs text-muted">
            Jalankan <code className="text-xs bg-[#E6E9F5] text-[#26336B] px-1.5 py-0.5 rounded">bun run dev</code> untuk menjalankan frontend & backend.
          </p>
        </div>
      </div>
    </main>
  );
}
