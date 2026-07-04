import { Elysia, t } from "elysia"
import { db } from "../db/client"
import { eq } from "drizzle-orm"
import { layouts } from "../db/schema"
import { connectionManager, getCurrentCounts } from "../connector/manager"
import { WsMessageSchema } from "@tiktok-poll-overlay/shared"

export const wsRooms = new Elysia().ws("/ws/:token", {
  params: t.Object({ token: t.String() }),

  async open(ws) {
    const layout = await db.query.layouts.findFirst({
      where: eq(layouts.overlayToken, ws.data.params.token),
      with: { user: true },
    })

    if (!layout || layout.status !== "active" || !layout.activeSessionId) {
      ws.close(4004, "layout not found or inactive")
      return
    }

    ws.data.store = { layoutId: layout.id, tiktokUsername: layout.user.tiktokUsername! }
    ws.subscribe(layout.id)

    await connectionManager.acquire(layout.user.tiktokUsername!)

    ws.send({
      type: "snapshot",
      options: await getCurrentCounts(layout.id, layout.activeSessionId),
    })

    ws.send(WsMessageSchema.parse({
      type: "snapshot",
      options: await getCurrentCounts(layout.id, layout.activeSessionId),
    }))
  },

  close(ws) {
    const store = ws.data.store as { tiktokUsername: string } | undefined
    if (store) connectionManager.release(store.tiktokUsername)
  },
})