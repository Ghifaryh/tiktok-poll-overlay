import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";

export const requireAuth = new Elysia()
  .use(jwt({ name: "jwt", secret: process.env.JWT_SECRET! }))
  .derive({ as: "scoped" }, async ({ jwt, cookie, set }) => {
    const rawToken = cookie.auth_token?.value;

    if (!rawToken || typeof rawToken !== "string") {
      set.status = 401;
      throw new Error("unauthorized");
    }

    const payload = await jwt.verify(rawToken);
    if (!payload) {
      set.status = 401;
      throw new Error("unauthorized");
    }

    return { userId: payload.sub as string };
  });