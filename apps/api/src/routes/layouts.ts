import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { layouts, pollSessions, pollOptions } from "../db/schema";
import { eq, and, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireAuth } from "../auth/middleware";
import { getCurrentCounts, connectionManager } from "../connector/manager";

export const layoutRoutes = new Elysia({ prefix: "/api/layouts" })
  .use(requireAuth)

  .get("/", async ({ userId }) => {
    return db.query.layouts.findMany({
      where: eq(layouts.userId, userId),
      with: { options: true },
      orderBy: (l, { desc }) => desc(l.createdAt),
    });
  })

.post(
  "/",
  async ({ userId, body }) => {
    const [layout] = await db
      .insert(layouts)
      .values({
        userId,
        name: body.name,
        sourceType: body.sourceType,
        overlayToken: nanoid(21),
        status: "draft",
      })
      .returning();

    if (!layout) throw new Error("failed to create layout");

    if (body.options.length > 0) {
      await db.insert(pollOptions).values(
        body.options.map((opt, i) => ({
          layoutId: layout.id,
          label: opt.label,
          matchValue: opt.matchValue,
          aliases: opt.aliases ?? [],
          giftId: opt.giftId ?? null,
          sortOrder: i,
        }))
      );
    }

    return layout;
  },
  {
    body: t.Object({
      name: t.String({ minLength: 1 }),
      sourceType: t.Union([t.Literal("comment"), t.Literal("gift")]),
      options: t.Array(
        t.Object({
          label: t.String({ minLength: 1 }),
          matchValue: t.String({ minLength: 1 }),
          aliases: t.Optional(t.Array(t.String())),
          giftId: t.Optional(t.String()),
        })
      ),
    }),
  }
)

.post(
  "/:id/activate",
  async ({ userId, params }) => {
    return db.transaction(async (tx) => {
      const target = await tx.query.layouts.findFirst({
        where: and(eq(layouts.id, params.id), eq(layouts.userId, userId)),
      });
      if (!target) throw new Error("layout not found");

      await tx
        .update(layouts)
        .set({ status: "ended" })
        .where(and(eq(layouts.userId, userId), eq(layouts.status, "active"), ne(layouts.id, params.id)));

      const [session] = await tx.insert(pollSessions).values({ layoutId: params.id }).returning();
      if (!session) throw new Error("failed to create session");

      const [updated] = await tx
        .update(layouts)
        .set({ status: "active", activeSessionId: session.id })
        .where(eq(layouts.id, params.id))
        .returning();
      if (!updated) throw new Error("failed to activate layout");

      return updated;
    });
  },
  { params: t.Object({ id: t.String() }) }
)

.post(
  "/:id/end",
  async ({ userId, params }) => {
    const [updated] = await db
      .update(layouts)
      .set({ status: "ended" })
      .where(and(eq(layouts.id, params.id), eq(layouts.userId, userId)))
      .returning();
    if (!updated) throw new Error("layout not found");
    return updated;
  },
  { params: t.Object({ id: t.String() }) }
)

.get(
  "/:id/stats",
  async ({ userId, params, set }) => {
    const layout = await db.query.layouts.findFirst({
      where: and(eq(layouts.id, params.id), eq(layouts.userId, userId)),
      with: { user: true },
    });
    if (!layout) {
      set.status = 404;
      throw new Error("layout not found");
    }

    const options = layout.activeSessionId
      ? await getCurrentCounts(layout.id, layout.activeSessionId)
      : [];

    return {
      totalVotes: options.reduce((sum, o) => sum + o.voteCount, 0),
      connected: connectionManager.isConnected(layout.user.tiktokUsername ?? ""),
      options,
    };
  },
  { params: t.Object({ id: t.String() }) }
)