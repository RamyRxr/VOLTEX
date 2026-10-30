"use client";

import { useId, useState } from "react";
import { useSendMessage } from "@/lib/client/queries";
import { t } from "@/lib/i18n";
import type { MessageDto } from "@/lib/services/views";
import { stamp } from "@/lib/format";

const MAX_LENGTH = 1000;

export function Thread({ messages, mine }: { messages: readonly MessageDto[]; mine: MessageDto["from"] }) {
  if (messages.length === 0) return <p className="sub thread__empty">{t("dossier.noMessages")}</p>;
  return (
    <div className="thread" role="log" aria-live="polite">
      {messages.map((m) => (
        <div key={m.id} className={`msg ${m.from === "DOCTOR" ? "msg--doctor" : "msg--patient"} ${m.from === mine ? "msg--mine" : ""}`}>
          {m.body}
          <span className="msg__time">{stamp(m.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}

interface ComposerProps {
  readonly patientId: string;
  readonly placeholder: string;
  readonly quickReplies?: readonly string[];
  readonly autoFocus?: boolean;
  readonly inputId?: string;
  readonly onSent?: () => void;
}

/** Doctor → patient or patient → doctor. Quick replies only fill the box; sending is explicit. */
export function MessageComposer({ patientId, placeholder, quickReplies = [], autoFocus = false, inputId, onSent }: ComposerProps) {
  const generated = useId();
  const id = inputId ?? generated;
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const send = useSendMessage(patientId);
  const text = body.trim();

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text || send.isPending) return;
        send.mutate(text, {
          onSuccess: () => {
            setBody("");
            setSent(true);
            onSent?.();
          },
        });
      }}
    >
      {quickReplies.length > 0 && (
        <div className="composer__quick">
          {quickReplies.map((q) => (
            <button key={q} type="button" className="chip chip--quick" onClick={() => setBody(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
      <label className="field" htmlFor={id}>
        <span className="field__label">{t("contact.write")}</span>
        <textarea
          id={id}
          rows={3}
          maxLength={MAX_LENGTH}
          value={body}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(e) => {
            setBody(e.target.value);
            setSent(false);
          }}
        />
      </label>
      <button type="submit" className="btn btn--royal btn--block" disabled={!text || send.isPending}>
        {send.isPending ? t("common.sending") : t("common.send")}
      </button>
      <p className="composer__status" role="status">
        {send.isError ? t("alerts.error") : sent ? t("contact.sent") : ""}
      </p>
    </form>
  );
}
