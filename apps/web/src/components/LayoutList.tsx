import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Layout = {
  id: string;
  name: string;
  sourceType: "comment" | "gift";
  status: "draft" | "active" | "ended";
  overlayToken: string;
  options: { id: string; label: string }[];
};

export function LayoutList() {
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLayouts(await api.getLayouts());
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  async function handleActivate(layout: Layout) {
    const hasOtherActive = layouts.some((l) => l.status === "active" && l.id !== layout.id);
    if (hasOtherActive) {
      const confirmed = window.confirm(
        "Another poll is currently live. Activating this one will end it. Continue?"
      );
      if (!confirmed) return;
    }
    await api.activateLayout(layout.id);
    await refresh();
  }

  async function handleEnd(layout: Layout) {
    await api.endLayout(layout.id);
    await refresh();
  }

  if (loading) return <p className="text-sm text-text-muted">Loading layouts…</p>;

  return (
    <div className="flex flex-col gap-2">
      {layouts.map((layout) => (
        <div
          key={layout.id}
          className="flex items-center justify-between rounded-md border border-border px-3.5 py-3"
        >
          <div>
            <p className="text-sm font-medium">{layout.name}</p>
            <p className="mt-0.5 text-xs text-text-muted">
              {layout.sourceType === "comment" ? "Comment poll" : "Gift poll"}, {layout.options.length} options
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={layout.status} />
            {layout.status !== "active" && (
              <button
                className="rounded-md bg-text-primary px-3 py-1.5 text-xs text-white"
                onClick={() => handleActivate(layout)}
              >
                Go live
              </button>
            )}
            {layout.status === "active" && (
              <button
                className="rounded-md border border-border px-3 py-1.5 text-xs"
                onClick={() => handleEnd(layout)}
              >
                End
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: "draft" | "active" | "ended" }) {
  const classes = {
    active: "bg-bg-success text-text-success",
    draft: "bg-surface-1 text-text-secondary",
    ended: "bg-surface-1 text-text-secondary",
  }[status];
  return <span className={`rounded-md px-2.5 py-0.5 text-xs ${classes}`}>{status}</span>;
}