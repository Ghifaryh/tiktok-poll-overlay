import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { layouts } from "../db/schema";
import { getCurrentCounts } from "../connector/manager";

export const publicRoutes = new Elysia({ prefix: "/api/public" }).get("/layouts/:token", async ({ params, set }) => {
  const layout = await db.query.layouts.findFirst({ where: eq(layouts.overlayToken, params.token) });

  if (!layout || layout.status !== "active" || !layout.activeSessionId) {
    set.status = 404;
    return { error: "layout not found or inactive" };
  }

  return {
    sessionId: layout.activeSessionId,
    options: await getCurrentCounts(layout.id, layout.activeSessionId),
  };
});