"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiSend } from "@/lib/client/api";
import { displayPhone } from "@/lib/format";
import { t } from "@/lib/i18n";

interface Contact {
  readonly name: string;
  readonly phone: string;
}

interface Exchange {
  readonly id: number;
  readonly from: string;
  readonly body: string;
  readonly reply: string;
  readonly stored: boolean;
}

const PRESETS: readonly string[] = ["TA 165 100 78 MP", "TA 163 99 80", "ta 182 118 cp", "TA 128 82 74 PP", "bonjour"];

/** Paste an incoming SMS: same handler as the gateway webhook (spec §4.3). */
export function SmsSimulator({ contacts, defaultPhone }: { contacts: readonly Contact[]; defaultPhone: string }) {
  const qc = useQueryClient();
  const [from, setFrom] = useState(defaultPhone);
  const [body, setBody] = useState(PRESETS[0]);
  const [log, setLog] = useState<readonly Exchange[]>([]);

  const send = useMutation({
    mutationFn: () => apiSend<{ reply: string; stored: boolean }>("/api/dev/sms", "POST", { from, body }),
    onSuccess: (res) => {
      setLog((l) => [{ id: Date.now(), from, body, reply: res.reply, stored: res.stored }, ...l]);
      void qc.invalidateQueries();
    },
  });
  const reset = useMutation({
    mutationFn: () => apiSend<{ reset: boolean }>("/api/dev/reset", "POST"),
    onSuccess: () => {
      setLog([]);
      void qc.invalidateQueries();
    },
  });
  const nameOf = (phone: string) => contacts.find((c) => c.phone === phone)?.name ?? displayPhone(phone);

  return (
    <div className="sim">
      <form
        className="panel sim__form"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <div className="panel__body">
          <label className="field">
            <span className="field__label">{t("sim.from")}</span>
            <input list="sim-contacts" value={from} onChange={(e) => setFrom(e.target.value)} inputMode="tel" required />
            <datalist id="sim-contacts">
              {contacts.map((c) => (
                <option key={c.phone} value={c.phone}>
                  {c.name}
                </option>
              ))}
            </datalist>
          </label>
          <p className="micro">{nameOf(from)}</p>
          <label className="field">
            <span className="field__label">{t("sim.body")}</span>
            <textarea rows={2} value={body} maxLength={480} onChange={(e) => setBody(e.target.value)} required />
          </label>
          <div className="composer__quick" aria-label={t("sim.presets")}>
            {PRESETS.map((p) => (
              <button key={p} type="button" className="chip chip--quick num" onClick={() => setBody(p)}>
                {p}
              </button>
            ))}
          </div>
          <button type="submit" className="btn btn--royal btn--block" disabled={send.isPending}>
            {t("sim.send")}
          </button>
          {send.isError && (
            <p className="field__error" role="alert">
              {t("sim.error")}
            </p>
          )}
        </div>
      </form>

      <section className="sim__log" aria-live="polite">
        <div className="section-head">
          <h2>{t("sim.log")}</h2>
          <button type="button" className="btn btn--sm btn--ghost" disabled={reset.isPending} onClick={() => reset.mutate()}>
            {t("sim.reset")}
          </button>
        </div>
        {reset.isSuccess && <p className="sub">{t("sim.resetDone")}</p>}
        {log.length === 0 && <p className="sub">{t("sim.logEmpty")}</p>}
        {log.map((x) => (
          <div key={x.id} className="sim__exchange">
            <p className="micro">{nameOf(x.from)}</p>
            <div className="msg msg--patient num">{x.body}</div>
            <div className="msg msg--doctor sim__reply">
              <span className="micro">{t("sim.reply")}</span>
              <br />
              {x.reply}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
