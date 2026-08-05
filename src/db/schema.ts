import * as schemaPg from "./schema-pg";
import * as schemaSqlite from "./schema-sqlite";

const driver = (process.env.DATABASE_DRIVER || "").toLowerCase();
const dbUrl = (process.env.DATABASE_URL || "").toLowerCase();

export const IS_POSTGRES = driver === "postgres" || (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://"));

export const users = IS_POSTGRES ? schemaPg.users : (schemaSqlite.users as unknown as typeof schemaPg.users);
export const emailVerifications = IS_POSTGRES
    ? schemaPg.emailVerifications
    : (schemaSqlite.emailVerifications as unknown as typeof schemaPg.emailVerifications);
export const passwordResets = IS_POSTGRES
    ? schemaPg.passwordResets
    : (schemaSqlite.passwordResets as unknown as typeof schemaPg.passwordResets);
export const refreshTokens = IS_POSTGRES
    ? schemaPg.refreshTokens
    : (schemaSqlite.refreshTokens as unknown as typeof schemaPg.refreshTokens);
export const organizations = IS_POSTGRES
    ? schemaPg.organizations
    : (schemaSqlite.organizations as unknown as typeof schemaPg.organizations);
export const memberships = IS_POSTGRES
    ? schemaPg.memberships
    : (schemaSqlite.memberships as unknown as typeof schemaPg.memberships);
export const notebooks = IS_POSTGRES ? schemaPg.notebooks : (schemaSqlite.notebooks as unknown as typeof schemaPg.notebooks);
export const sources = IS_POSTGRES ? schemaPg.sources : (schemaSqlite.sources as unknown as typeof schemaPg.sources);
export const sourceChunks = IS_POSTGRES ? schemaPg.sourceChunks : (schemaSqlite.sourceChunks as unknown as typeof schemaPg.sourceChunks);
export const messages = IS_POSTGRES ? schemaPg.messages : (schemaSqlite.messages as unknown as typeof schemaPg.messages);
export const notes = IS_POSTGRES ? schemaPg.notes : (schemaSqlite.notes as unknown as typeof schemaPg.notes);
