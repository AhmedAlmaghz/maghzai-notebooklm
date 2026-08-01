import { db } from "@/db";
import { notes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { touchNotebook } from "./notebook-service";
import type { NoteKind } from "@/lib/types";

export async function getNotesForNotebook(notebookId: string) {
  return db.select().from(notes).where(eq(notes.notebookId, notebookId)).orderBy(notes.createdAt);
}

export async function getNoteById(notebookId: string, noteId: string) {
  const [note] = await db
    .select()
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);
  return note && note.notebookId === notebookId ? note : null;
}

export async function createNote(params: {
  notebookId: string;
  title: string;
  content: string;
  kind?: NoteKind;
}) {
  const [note] = await db
    .insert(notes)
    .values({
      notebookId: params.notebookId,
      title: params.title,
      content: params.content,
      kind: params.kind || "note",
    })
    .returning();
  await touchNotebook(params.notebookId);
  return note;
}

export async function updateNote(
  notebookId: string,
  noteId: string,
  data: { title?: string; content?: string; kind?: NoteKind }
) {
  const [note] = await db
    .update(notes)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(notes.id, noteId))
    .returning();
  await touchNotebook(notebookId);
  return note;
}

export async function deleteNote(notebookId: string, noteId: string) {
  await db.delete(notes).where(eq(notes.id, noteId));
  await touchNotebook(notebookId);
}