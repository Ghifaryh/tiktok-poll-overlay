import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authRoutes } from "./routes/auth";
import { layoutRoutes } from "./routes/layouts";
import { publicRoutes } from "./routes/public";
import { wsRooms } from "./ws/rooms";
import { connectionManager } from "./connector/manager";

const app = new Elysia()
  .use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:4321" }))
  .use(authRoutes)
  .use(layoutRoutes)
  .use(publicRoutes)
  .use(wsRooms)
  .get("/health", () => ({ ok: true }))
  .listen(process.env.PORT ?? 3000);

console.log(`api listening on :${app.server?.port}`);

connectionManager.attachServer(app.server!);