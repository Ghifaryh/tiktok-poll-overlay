import { pgTable, pgEnum, text, timestamp, integer, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const layoutStatusEnum = pgEnum("layout_status", ["draft", "active", "ended"]);
export const sourceTypeEnum = pgEnum("source_type", ["comment", "gift"]);
export const eventTypeEnum = pgEnum("event_type", ["comment", "gift"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  tiktokUsername: text("tiktok_username").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const layouts = pgTable("layouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sourceType: sourceTypeEnum("source_type").notNull(),
  overlayToken: text("overlay_token").notNull().unique(), // nanoid(21), generated app-side
  status: layoutStatusEnum("status").notNull().default("draft"),
  activeSessionId: uuid("active_session_id"), // FK added below, nullable until a session starts
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pollOptions = pgTable("poll_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  layoutId: uuid("layout_id").notNull().references(() => layouts.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  matchValue: text("match_value").notNull(), // e.g. "1", or a gift_id as text
  aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`), // e.g. ["one","1️⃣"]
  giftId: text("gift_id"), // set only when layout.sourceType = 'gift'
  sortOrder: integer("sort_order").notNull().default(0),
});

export const pollSessions = pgTable("poll_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  layoutId: uuid("layout_id").notNull().references(() => layouts.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const pollEvents = pgTable("poll_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  layoutId: uuid("layout_id").notNull().references(() => layouts.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").notNull().references(() => pollSessions.id, { onDelete: "cascade" }),
  optionId: uuid("option_id").notNull().references(() => pollOptions.id, { onDelete: "cascade" }),
  tiktokUserId: text("tiktok_user_id").notNull(),
  tiktokNickname: text("tiktok_nickname").notNull(),
  eventType: eventTypeEnum("event_type").notNull(),
  giftRepeatCount: integer("gift_repeat_count"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // one vote per viewer per session — comments only; gifts always tally
  oneVotePerViewer: uniqueIndex("poll_events_one_vote_per_viewer")
    .on(table.sessionId, table.tiktokUserId)
    .where(sql`${table.eventType} = 'comment'`),
}));

export const usersRelations = relations(users, ({ many }) => ({
  layouts: many(layouts),
}));

export const layoutsRelations = relations(layouts, ({ one, many }) => ({
  user: one(users, { fields: [layouts.userId], references: [users.id] }),
  options: many(pollOptions),
  sessions: many(pollSessions),
}));

export const pollOptionsRelations = relations(pollOptions, ({ one, many }) => ({
  layout: one(layouts, { fields: [pollOptions.layoutId], references: [layouts.id] }),
  events: many(pollEvents),
}));

export const pollSessionsRelations = relations(pollSessions, ({ one, many }) => ({
  layout: one(layouts, { fields: [pollSessions.layoutId], references: [layouts.id] }),
  events: many(pollEvents),
}));

export const pollEventsRelations = relations(pollEvents, ({ one }) => ({
  layout: one(layouts, { fields: [pollEvents.layoutId], references: [layouts.id] }),
  session: one(pollSessions, { fields: [pollEvents.sessionId], references: [pollSessions.id] }),
  option: one(pollOptions, { fields: [pollEvents.optionId], references: [pollOptions.id] }),
}));