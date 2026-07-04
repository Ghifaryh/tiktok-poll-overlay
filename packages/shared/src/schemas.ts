// packages/shared/src/schemas.ts
import { z } from "zod";

export const PollOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  matchValue: z.string(),
  voteCount: z.number(),
});

export const WsMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("snapshot"), options: z.array(PollOptionSchema) }),
  z.object({ type: z.literal("update"), options: z.array(PollOptionSchema) }),
]);

export type PollOption = z.infer<typeof PollOptionSchema>;
export type WsMessage = z.infer<typeof WsMessageSchema>;