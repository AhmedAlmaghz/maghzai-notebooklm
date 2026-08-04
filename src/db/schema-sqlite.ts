import {
  sqliteTable,
  text,
  integer,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

export const users = sqliteTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const notebooks = sqliteTable("notebooks", {
  id: id(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("دفتر بحث بلا عنوان"),
  emoji: text("emoji").notNull().default("📓"),
  description: text("description"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  // Soft delete: when set, the notebook is hidden from normal lists but kept
  // in the database so it can be restored from the trash.
  deletedAt: text("deleted_at"),
});

export const sources = sqliteTable("sources", {
  id: id(),
  notebookId: text("notebook_id")
    .notNull()
    .references(() => notebooks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type").notNull(), // text | url | pdf | file | youtube
  content: text("content").notNull().default(""),
  sourceUrl: text("source_url"),
  status: text("status").notNull().default("ready"), // processing | ready | error
  errorMessage: text("error_message"),
  charCount: integer("char_count").notNull().default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const sourceChunks = sqliteTable("source_chunks", {
  id: id(),
  sourceId: text("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  notebookId: text("notebook_id")
    .notNull()
    .references(() => notebooks.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const messages = sqliteTable("messages", {
  id: id(),
  notebookId: text("notebook_id")
    .notNull()
    .references(() => notebooks.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // user | assistant
  content: text("content").notNull(),
  citations: text("citations"), // JSON stringified array of citations
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const notes = sqliteTable("notes", {
  id: id(),
  notebookId: text("notebook_id")
    .notNull()
    .references(() => notebooks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  kind: text("kind").notNull().default("note"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
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
