import { db } from "../db/client";
import { pollEvents } from "../db/schema";

type LayoutRow = { id: string; sourceType: "comment" | "gift"; activeSessionId: string | null };
type OptionRow = { id: string };

export async function recordPollEvent(layout: LayoutRow, option: OptionRow, data: any): Promise<boolean> {
  if (!layout.activeSessionId) return false;

  const result = await db
    .insert(pollEvents)
    .values({
      layoutId: layout.id,
      sessionId: layout.activeSessionId,
      optionId: option.id,
      tiktokUserId: String(data.user?.userId ?? data.userId ?? "unknown"),
      tiktokNickname: data.user?.nickname ?? data.nickname ?? "unknown",
      eventType: layout.sourceType,
      giftRepeatCount: data.repeatCount ?? null,
    })
    .onConflictDoNothing()
    .returning();

  return result.length > 0;
}