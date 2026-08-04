export type Notebook = {
  id: string;
  title: string;
  emoji: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  sourceCount?: number;
};

export type SourceStatus = "processing" | "ready" | "error";
export type SourceType = "text" | "url" | "pdf" | "file" | "youtube";

export type SourceItem = {
  id: string;
  title: string;
  type: SourceType;
  status: SourceStatus;
  errorMessage: string | null;
  charCount: number;
  sourceUrl: string | null;
  createdAt: string;
};

export type Citation = {
  sourceId: string;
  sourceTitle: string;
  snippet: string;
};

export type ChatMessage = {
  id: string;
  notebookId: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[] | null;
  createdAt: string;
};

export type NoteKind =
  | "note"
  | "summary"
  | "faq"
  | "study_guide"
  | "timeline"
  | "mindmap"
  | "flashcards"
  | "presentation"
  | "quiz"
  | "glossary"
  | "outline"
  | "comparison"
  | "debate";

export type NoteItem = {
  id: string;
  notebookId: string;
  title: string;
  content: string;
  kind: NoteKind;
  createdAt: string;
  updatedAt: string;
};

export type FollowUpSuggestion = {
  text: string;
  type: "expand" | "related" | "example" | "deeper";
};

/**
 * Answer mode for the chat:
 * - "sources": answer is built strictly from the selected sources (default).
 * - "expanded": answer starts from the sources but the model may expand from
 *   its own knowledge and/or search the web for a deeper, more detailed reply.
 */
export type AnswerMode = "sources" | "expanded";
