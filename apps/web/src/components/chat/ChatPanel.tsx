"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { formatDateTime, formatTime } from "@/lib/format";
import { fr } from "@/lib/i18n/fr";
import { useMe } from "@/lib/queries";
import styles from "./ChatPanel.module.css";
import { useChat } from "./useChat";

export function ChatPanel({ linkId, patientName }: { linkId: string; patientName: string }) {
  const me = useMe();
  const myId = me.data?.id ?? null;
  const { messages, status, send } = useChat(linkId, myId);
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Same guard as the disabled button: Enter also submits the form.
    if (!draft.trim() || !myId || sending) return;
    setSending(true);
    const ok = await send(draft);
    setSending(false);
    setFailed(!ok);
    if (ok) setDraft("");
  }

  return (
    <section className={`panel ${styles.panel}`} aria-labelledby="chat-title">
      <div className="panel-head">
        <h2 id="chat-title">
          <Icon name="send" /> {fr.chat.title}
        </h2>
      </div>
      <p className={styles.banner}>{fr.chat.banner}</p>
      <ol ref={listRef} className={styles.list} aria-live="polite">
        {status === "loading" && <li className="subtle">{fr.common.loading}</li>}
        {status === "error" && <li className="subtle">{fr.common.error}</li>}
        {status === "ready" && messages.length === 0 && <li className="subtle">{fr.chat.empty}</li>}
        {messages.map((m) => {
          const mine = m.senderId === myId;
          return (
            <li key={m.id} className={mine ? `${styles.message} ${styles.mine}` : styles.message}>
              <span className={styles.author}>{mine ? fr.chat.you : patientName}</span>
              <p>{m.body}</p>
              <time dateTime={m.createdAt} title={formatDateTime(m.createdAt)}>
                {formatTime(m.createdAt)}
              </time>
            </li>
          );
        })}
      </ol>
      <form onSubmit={submit} className={styles.form}>
        <label htmlFor="chat-input" className="sr-only">
          {fr.chat.placeholder}
        </label>
        <textarea
          id="chat-input"
          className="input"
          rows={2}
          maxLength={2000}
          placeholder={fr.chat.placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button type="submit" className="btn btn-primary" disabled={sending || !draft.trim() || !myId}>
          <Icon name="send" />
          <span className="sr-only">{fr.chat.send}</span>
        </button>
      </form>
      {failed && (
        <p className={`notice tone-danger ${styles.error}`} role="alert">
          {fr.chat.failed}
        </p>
      )}
    </section>
  );
}
