import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../db/client";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../auth/middleware";

export const authRoutes = new Elysia({ prefix: "/api/auth" })
  .use(jwt({ name: "jwt", secret: process.env.JWT_SECRET! }))

  .post(
    "/signup",
    async ({ body, jwt, cookie }) => {
      const existing = await db.query.users.findFirst({ where: eq(users.email, body.email) });
      if (existing) throw new Error("email already registered");

      const passwordHash = await Bun.password.hash(body.password);
      const [user] = await db
        .insert(users)
        .values({ email: body.email, passwordHash, tiktokUsername: body.tiktokUsername })
        .returning();
      if (!user) throw new Error("failed to create user");

      const token = await jwt.sign({ sub: user.id });
      cookie.auth_token!.set({ value: token, httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
      return { id: user.id, email: user.email };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 8 }),
        tiktokUsername: t.String({ minLength: 1 }),
      }),
    }
  )

  .post(
    "/login",
    async ({ body, jwt, cookie, set }) => {
      const user = await db.query.users.findFirst({ where: eq(users.email, body.email) });
      if (!user || !(await Bun.password.verify(body.password, user.passwordHash))) {
        set.status = 401;
        throw new Error("invalid credentials");
      }
      const token = await jwt.sign({ sub: user.id });
      cookie.auth_token!.set({ value: token, httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
      return { id: user.id, email: user.email };
    },
    { body: t.Object({ email: t.String(), password: t.String() }) }
  )

  .post("/logout", ({ cookie }) => {
    cookie.auth_token!.remove();
    return { ok: true };
  })

  .use(requireAuth)
  .get("/me", async ({ userId }) => {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new Error("user not found");
    return { id: user.id, email: user.email, tiktokUsername: user.tiktokUsername };
  });