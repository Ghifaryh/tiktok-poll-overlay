import { useEffect, useState } from "react";
import type { PollOption, WsMessage } from "@tiktok-poll-overlay/shared";

type Props = { token: string; initial: { options: PollOption[] }; wsUrl: string };

export function PollOverlay({ token, initial, wsUrl }: Props) {
  const [options, setOptions] = useState<PollOption[]>(initial.options);

  useEffect(() => {
    let ws: WebSocket;
    let retry = 0;
    let closedByUs = false;

    function connect() {
      ws = new WebSocket(`${wsUrl}/ws/${token}`);
      ws.onmessage = (e) => {
        const msg: WsMessage = JSON.parse(e.data);
        if (msg.type === "snapshot" || msg.type === "update") setOptions(msg.options);
      };
      ws.onclose = () => {
        if (closedByUs) return;
        retry++;
        setTimeout(connect, Math.min(10_000, 1000 * retry));
      };
    }
    connect();
    return () => {
      closedByUs = true;
      ws?.close();
    };
  }, [token, wsUrl]);

  return <LeaderboardBars options={options} />;
}

function LeaderboardBars({ options }: { options: PollOption[] }) {
  const total = options.reduce((sum, o) => sum + o.voteCount, 0);
  const max = Math.max(1, ...options.map((o) => o.voteCount));

  return (
    <div className="max-w-[420px]">
      {options.map((opt) => (
        <div key={opt.id} className="mb-2.5">
          <div className="flex justify-between text-[13px]">
            <span>{opt.label}</span>
            <span>{opt.voteCount}</span>
          </div>
          <div className="h-5 overflow-hidden rounded-md bg-black/[0.08]">
            <div
              className="h-full rounded-md bg-accent transition-all"
              style={{ width: `${(opt.voteCount / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      <div className="mt-2 text-xs text-text-muted">{total} votes</div>
    </div>
  );
}