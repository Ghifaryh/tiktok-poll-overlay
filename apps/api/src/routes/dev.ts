import { Elysia, t } from "elysia";
import { connectionManager } from "../connector/manager";

export const devRoutes = new Elysia({ prefix: "/api/dev" })
  .post(
    "/simulate/:username/comment",
    ({ params, body }) => {
      const conn = connectionManager.acquireFake(params.username);
      conn.emit("chat", {
        comment: body.text,
        userId: body.userId ?? `fake-${Math.random().toString(36).slice(2, 8)}`,
        nickname: body.nickname ?? "TestViewer",
      });
      return { ok: true };
    },
    {
      params: t.Object({ username: t.String() }),
      body: t.Object({
        text: t.String(),
        userId: t.Optional(t.String()),
        nickname: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/simulate/:username/gift",
    ({ params, body }) => {
      const conn = connectionManager.acquireFake(params.username);
      conn.emit("gift", {
        giftId: body.giftId,
        giftDetails: { giftType: body.repeatable ? 1 : 0 },
        repeatEnd: body.repeatable ? true : undefined,
        repeatCount: body.repeatCount ?? 1,
        userId: body.userId ?? `fake-${Math.random().toString(36).slice(2, 8)}`,
        nickname: body.nickname ?? "TestGifter",
      });
      return { ok: true };
    },
    {
      params: t.Object({ username: t.String() }),
      body: t.Object({
        giftId: t.String(),
        repeatCount: t.Optional(t.Number()),
        repeatable: t.Optional(t.Boolean()),
        userId: t.Optional(t.String()),
        nickname: t.Optional(t.String()),
      }),
    }
  );