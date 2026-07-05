import { TikTokLiveConnection, WebcastEvent, ControlEvent } from "tiktok-live-connector";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { layouts, users } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { matchOption } from "../poll/match";
import { recordPollEvent } from "../poll/record";
import { EventEmitter } from "events";

type ManagedConnection = {
  conn: TikTokLiveConnection;
  refCount: number;
  teardownTimer: ReturnType<typeof setTimeout> | null;
};

class FakeConnection extends EventEmitter {
  async connect() { /* no-op */ }
  disconnect() { /* no-op */ }
}

class TikTokConnectionManager {
  private connections = new Map<string, ManagedConnection>();
  private server: import("bun").Server<unknown> | null = null;

  attachServer(server: import("bun").Server<unknown>) {
    this.server = server;
  }

  publish(topic: string, payload: object) {
    this.server?.publish(topic, JSON.stringify(payload));
  }

  async acquire(username: string) {
    let entry = this.connections.get(username);
    if (entry) {
      entry.refCount++;
      if (entry.teardownTimer) clearTimeout(entry.teardownTimer);
      return entry;
    }

    const conn = new TikTokLiveConnection(username, {
      signApiKey: process.env.EULER_SIGN_API_KEY,
    });
    entry = { conn, refCount: 1, teardownTimer: null };
    this.connections.set(username, entry);

    conn.on(WebcastEvent.CHAT, (data) => this.handleEvent(username, "comment", data));
    conn.on(WebcastEvent.GIFT, (data) => this.handleEvent(username, "gift", data));
    conn.on(ControlEvent.DISCONNECTED, () => this.scheduleReconnect(username));

    await conn.connect();
    return entry;
  }

  release(username: string) {
    const entry = this.connections.get(username);
    if (!entry) return;
    entry.refCount--;
    if (entry.refCount <= 0) {
      entry.teardownTimer = setTimeout(() => {
        entry.conn.disconnect();
        this.connections.delete(username);
      }, 60_000);
    }
  }

  private scheduleReconnect(username: string, attempt = 1) {
    const delay = Math.min(30_000, 2 ** attempt * 1000);
    setTimeout(async () => {
      const entry = this.connections.get(username);
      if (!entry) return;
      try {
        await entry.conn.connect();
      } catch {
        this.scheduleReconnect(username, attempt + 1);
      }
    }, delay);
  }

    // dev-only: get (or create) a fake connection wired to the same handlers as a real one
  acquireFake(username: string): FakeConnection {
    let entry = this.connections.get(username);
    if (entry) return entry.conn as unknown as FakeConnection;

    const conn = new FakeConnection();
    entry = { conn: conn as any, refCount: 1, teardownTimer: null };
    this.connections.set(username, entry);

    conn.on("chat", (data) => this.handleEvent(username, "comment", data));
    conn.on("gift", (data) => this.handleEvent(username, "gift", data));

    return conn;
  }

 private async handleEvent(username: string, type: "comment" | "gift", data: any) {
    if (type === "gift" && data.giftDetails?.giftType === 1 && !data.repeatEnd) return;

    const rows = await db
      .select({ layout: layouts })
      .from(layouts)
      .innerJoin(users, eq(layouts.userId, users.id))
      .where(and(eq(users.tiktokUsername, username), eq(layouts.status, "active")))
      .limit(1);

    const layout = rows[0]?.layout;
    if (!layout || !layout.activeSessionId) return;

    const option = matchOption(layout as any, type, data);
    if (!option) return;

    const changed = await recordPollEvent(layout, option, data);
    if (!changed) return;

    this.publish(layout.id, { type: "update", options: await getCurrentCounts(layout.id, layout.activeSessionId) });
  }
    isConnected(username: string): boolean {
    return this.connections.has(username);
  }
}

export const connectionManager = new TikTokConnectionManager();

export async function getCurrentCounts(layoutId: string, sessionId: string) {
  const rows = await db.query.pollOptions.findMany({
    where: (opt, { eq }) => eq(opt.layoutId, layoutId),
    orderBy: (opt, { asc }) => asc(opt.sortOrder),
  });

  const counts = await db.execute(sql`
    SELECT option_id, COUNT(*)::int as count
    FROM poll_events
    WHERE session_id = ${sessionId}
    GROUP BY option_id
  `);
  const countMap = new Map((counts as any[]).map((r: any) => [r.option_id, r.count]));

  return rows.map((opt) => ({
    id: opt.id,
    label: opt.label,
    matchValue: opt.matchValue,
    voteCount: countMap.get(opt.id) ?? 0,
  }));
}