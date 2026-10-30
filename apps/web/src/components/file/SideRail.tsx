"use client";

import { useState } from "react";
import type { NoteDto } from "shared";
import { Icon } from "@/components/ui/Icon";
import { errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { fr } from "@/lib/i18n/fr";
import { useAddNote } from "@/lib/queries";
import styles from "./file.module.css";

/** AI summary: labelled, never the only source of truth (spec §9.1). */
export function SummaryCard({ text }: { text: string | null }) {
  return (
    <section className={`panel ${styles.summary}`} aria-labelledby="summary-title">
      <div className="panel-head">
        <h2 id="summary-title">
          <Icon name="sparkle" /> {fr.file.summary}
        </h2>
      </div>
      <div className="panel-body">
        <p className={styles.aiLabel}>{fr.file.summaryLabel}</p>
        <p className={styles.summaryText}>{text ?? fr.file.summaryEmpty}</p>
        <p className="subtle">{fr.file.summarySoon}</p>
      </div>
    </section>
  );
}

export function NotesPanel({ patientId, notes }: { patientId: string; notes: readonly NoteDto[] }) {
  const [draft, setDraft] = useState("");
  const add = useAddNote(patientId);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    add.mutate(body, { onSuccess: () => setDraft("") });
  }

  return (
    <section className="panel" aria-labelledby="notes-title">
      <div className="panel-head">
        <h2 id="notes-title">
          <Icon name="note" /> {fr.file.notes}
        </h2>
      </div>
      <div className="panel-body">
        <form onSubmit={submit} className={styles.noteForm}>
          <label htmlFor="note" className="sr-only">
            {fr.file.notePlaceholder}
          </label>
          <textarea
            id="note"
            className="input"
            placeholder={fr.file.notePlaceholder}
            value={draft}
            maxLength={2000}
            onChange={(e) => setDraft(e.target.value)}
          />
          {add.isError && (
            <p className="notice tone-danger" role="alert">
              {errorMessage(add.error)}
            </p>
          )}
          <button type="submit" className="btn btn-secondary" disabled={add.isPending || !draft.trim()}>
            {fr.file.addNote}
          </button>
        </form>
        {notes.length === 0 ? (
          <p className="subtle">{fr.file.noNotes}</p>
        ) : (
          <ul className={styles.notes}>
            {notes.map((n) => (
              <li key={n.id}>
                <p>{n.body}</p>
                <time className="subtle" dateTime={n.createdAt}>
                  {formatDateTime(n.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
