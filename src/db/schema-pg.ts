import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

export const users = pgTable("users", {
  id: id(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notebooks = pgTable("notebooks", {
  id: id(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull().default("دفتر بحث بلا عنوان"),
  emoji: varchar("emoji", { length: 8 }).notNull().default("📓"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sources = pgTable("sources", {
  id: id(),
  notebookId: text("notebook_id")
    .notNull()
    .references(() => notebooks.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // text | url | pdf | file | youtube
  content: text("content").notNull().default(""),
  sourceUrl: text("source_url"),
  status: varchar("status", { length: 20 }).notNull().default("ready"), // processing | ready | error
  errorMessage: text("error_message"),
  charCount: integer("char_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sourceChunks = pgTable("source_chunks", {
  id: id(),
  sourceId: text("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  notebookId: text("notebook_id")
    .notNull()
    .references(() => notebooks.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: id(),
  notebookId: text("notebook_id")
    .notNull()
    .references(() => notebooks.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(), // user | assistant
  content: text("content").notNull(),
  citations: jsonb("citations").$type<
    {
      id?: number;
      kind?: "local" | "web";
      sourceId?: string;
      sourceTitle: string;
      snippet: string;
      uri?: string;
    }[]
  >(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notes = pgTable("notes", {
  id: id(),
  notebookId: text("notebook_id")
    .notNull()
    .references(() => notebooks.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  kind: varchar("kind", { length: 20 }).notNull().default("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  notebooks: many(notebooks),
}));

export const notebooksRelations = relations(notebooks, ({ one, many }) => ({
  user: one(users, {
    fields: [notebooks.userId],
    references: [users.id],
  }),
  sources: many(sources),
  messages: many(messages),
  notes: many(notes),
}));

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  notebook: one(notebooks, {
    fields: [sources.notebookId],
    references: [notebooks.id],
  }),
  chunks: many(sourceChunks),
}));

export const sourceChunksRelations = relations(sourceChunks, ({ one }) => ({
  source: one(sources, {
    fields: [sourceChunks.sourceId],
    references: [sources.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  notebook: one(notebooks, {
    fields: [messages.notebookId],
    references: [notebooks.id],
  }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  notebook: one(notebooks, {
    fields: [notes.notebookId],
    references: [notebooks.id],
  }),
}));
