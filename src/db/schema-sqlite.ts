import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
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
  // Nullable: OAuth-only users (e.g. Google) have no password.
  password: text("password"),
  // Profile picture URL (from OAuth provider, optional).
  image: text("image"),
  emailVerifiedAt: text("email_verified_at"),
  role: text("role").notNull().default("user"),
  refreshTokenVersion: integer("refresh_token_version").notNull().default(0),
  organizationId: text("organization_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

/**
 * Links an external OAuth provider account (Google, …) to a local user.
 * One user can have multiple provider links (e.g. Google + GitHub).
 * The (provider, providerAccountId) pair is unique.
 */
export const oauthAccounts = sqliteTable(
  "oauth_accounts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // "google" | "github" | …
    provider: text("provider").notNull(),
    // The provider's stable user id (e.g. Google's `sub` claim).
    providerAccountId: text("provider_account_id").notNull(),
    // Optional cached profile data from the provider.
    providerEmail: text("provider_email"),
    providerName: text("provider_name"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [uniqueIndex("oauth_accounts_provider_unique").on(t.provider, t.providerAccountId)]
);

export const emailVerifications = sqliteTable("email_verifications", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const passwordResets = sqliteTable("password_resets", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  revokedAt: text("revoked_at"),
  userAgent: text("user_agent"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const organizations = sqliteTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const memberships = sqliteTable(
  "memberships",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // owner | admin | member
    role: text("role").notNull().default("member"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [uniqueIndex("memberships_organization_user_unique").on(t.organizationId, t.userId)]
);

export const notebooks = sqliteTable("notebooks", {
  id: id(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  // Tenant key for org-shared notebooks. Null for personal/private notebooks.
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "set null" }),
  // private (default) | org
  visibility: text("visibility").notNull().default("private"),
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
  memberships: many(memberships),
  oauthAccounts: many(oauthAccounts),
}));

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, {
    fields: [oauthAccounts.userId],
    references: [users.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
}));

export const notebooksRelations = relations(notebooks, ({ one, many }) => ({
  user: one(users, {
    fields: [notebooks.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [notebooks.organizationId],
    references: [organizations.id],
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
