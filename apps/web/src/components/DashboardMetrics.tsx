import { useEffect, useState } from "react";
import { api, type Layout } from "../lib/api";

export function DashboardMetrics() {
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [stats, setStats] = useState<{ totalVotes: number; connected: boolean } | null>(null);

  const active = layouts.find((l) => l.status === "active");

  useEffect(() => {
    api.getLayouts().then(setLayouts);
  }, []);

  useEffect(() => {
    if (!active) {
      setStats(null);
      return;
    }
    let cancelled = false;
    async function poll() {
      const data = await api.getLayoutStats(active!.id);
      if (!cancelled) setStats(data);
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [active?.id]);

  return (
    <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="rounded-md bg-surface-1 p-4">
        <p className="mb-1.5 text-xs text-text-secondary">Active layout</p>
        <p className="text-lg font-medium">{active ? active.name : "None"}</p>
      </div>
      <div className="rounded-md bg-surface-1 p-4">
        <p className="mb-1.5 text-xs text-text-secondary">Votes this session</p>
        <p className="text-2xl font-medium">{stats?.totalVotes ?? "–"}</p>
      </div>
      <div className="rounded-md bg-surface-1 p-4">
        <p className="mb-1.5 text-xs text-text-secondary">Connection</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${stats?.connected ? "bg-text-success" : "bg-text-muted"
              }`}
          />
          {active ? (stats?.connected ? "Connected" : "Connecting…") : "No active poll"}
        </p>
      </div>
    </div>
  );
}