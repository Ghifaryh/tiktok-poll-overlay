import { useState } from "react";

type Props = {
  tiktokUsername: string;
  onCaptured: (giftId: string, giftName: string) => void;
};

export function GiftCaptureButton({ tiktokUsername, onCaptured }: Props) {
  const [listening, setListening] = useState(false);

  function startListening() {
    setListening(true);
    const ws = new WebSocket(`${import.meta.env.PUBLIC_WS_URL}/ws/capture/${tiktokUsername}`);
    ws.onmessage = (e) => {
      const { giftId, giftName } = JSON.parse(e.data);
      onCaptured(giftId, giftName);
      setListening(false);
      ws.close();
    };
    ws.onclose = () => setListening(false);
  }

  return (
    <button
      type="button"
      onClick={startListening}
      disabled={listening}
      className="whitespace-nowrap rounded-md border border-border px-2 py-2 text-xs disabled:opacity-50"
    >
      {listening ? "Waiting…" : "Capture gift"}
    </button>
  );
}