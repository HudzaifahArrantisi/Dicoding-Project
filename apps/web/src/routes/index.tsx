import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: async () => (await api.health.get()).data,
  });

  return (
    <main className="p-6">
      <h1 className="font-display text-2xl font-semibold">Daisuki Inventory</h1>
      <p className="text-muted-foreground">
        API: {health.isLoading ? "memeriksa…" : health.data?.ok ? "terhubung" : "tidak terhubung"}
      </p>
    </main>
  );
}