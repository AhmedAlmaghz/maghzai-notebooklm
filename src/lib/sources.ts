/**
 * Consolidated source ingestion helpers.
 *
 * This module re-exports the single source of truth from `source-service` to
 * eliminate the duplicate `ingestSource` implementation that previously lived
 * here (and silently skipped `touchNotebook`).
 */

export { ingestSource } from "@/lib/services/source-service";
export type { SourceType } from "@/lib/services/source-service";
