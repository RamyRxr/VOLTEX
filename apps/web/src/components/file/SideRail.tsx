"use client";

import { useState } from "react";
import type { NoteDto } from "shared";
import { Icon } from "@/components/ui/Icon";
import { errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { fr } from "@/lib/i18n/fr";
import { useAddNote, useGenerateSummary } from "@/lib/queries";
import styles from "./file.module.css";

/**
 * AI summary: labelled, never the only source of truth (spec §9.1). A fallback
 * text (model unavailable) is labelled as such, never as AI.
 */
export function SummaryCard({ patientId, text }: { patientId: string; text: string | null }) {
  const generate = useGenerateSummary(patientId);
  const fresh = generate.data;
  const shown = fresh?.text ?? text;
  const label = fresh?.source === "FALLBACK" ? fr.file.summaryFallbackLabel : fr.file.summaryLabel;
  return (
    <section className={`panel ${styles.summary}`} aria-labelledby="summary-title">
      <div className="panel-head">
        <h2 id="summary-title">
          <Icon name="sparkle" /> {fr.file.summary}
        </h2>
      </div>
      <div className="panel-body" aria-live="polite">
        <p className={styles.aiLabel}>{label}</p>
        <p className={styles.summaryText}>{shown ?? fr.file.summaryEmpty}</p>
        {fresh?.generatedAt && <p className="subtle">{fr.file.summaryGeneratedAt(formatDateTime(fresh.generatedAt))}</p>}
        {generate.isError && (
          <p className="notice tone-danger" role="alert">
            {errorMessage(generate.error)}
          </p>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => generate.mutate()} disabled={generate.isPending}>
          <Icon name="sparkle" />
          {generate.isPending ? fr.file.summaryGenerating : fr.file.summaryGenerate}
        </button>
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
