"use client";

import { useState } from "react";
import type { Invite } from "shared";
import { Icon } from "@/components/ui/Icon";
import { QueryState } from "@/components/ui/QueryState";
import { useNow } from "@/components/ui/useNow";
import { errorMessage } from "@/lib/api";
import { relativeTime, untilTime } from "@/lib/format";
import { fr } from "@/lib/i18n/fr";
import { useCreateInvite, useDecideRequest, useInvites, useLinkRequests } from "@/lib/queries";
import styles from "./InvitesView.module.css";

const COPIED_MS = 1500;

function CodeRow({ invite, now, highlight }: { invite: Invite; now: Date; highlight?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(invite.code);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_MS);
  }
  return (
    <div className={highlight ? `${styles.code} ${styles.codeNew}` : styles.code}>
      <span className={styles.codeValue} aria-label={invite.code.split("").join(" ")}>
        {invite.code}
      </span>
      <span className="subtle">{fr.invites.expires(untilTime(invite.expiresAt, now))}</span>
      <button type="button" className="btn btn-ghost" onClick={() => void copy()}>
        <Icon name="copy" />
        {copied ? fr.invites.copied : fr.invites.copy}
      </button>
    </div>
  );
}

function CodesPanel({ now }: { now: Date }) {
  const invites = useInvites();
  const create = useCreateInvite();
  const latest = create.data;
  const others = (invites.data ?? []).filter((i) => i.code !== latest?.code);

  return (
    <section className="panel" aria-labelledby="codes-title">
      <div className="panel-head">
        <h2 id="codes-title">{fr.invites.active}</h2>
        <button type="button" className="btn btn-primary" onClick={() => create.mutate()} disabled={create.isPending}>
          <Icon name="plus" />
          {create.isPending ? fr.invites.generating : fr.invites.generate}
        </button>
      </div>
      <div className="panel-body">
        {create.isError && (
          <p className="notice tone-danger" role="alert">
            {errorMessage(create.error)}
          </p>
        )}
        {latest && (
          <div className={styles.newBlock} aria-live="polite">
            <h3>{fr.invites.newCode}</h3>
            <CodeRow invite={latest} now={now} highlight />
          </div>
        )}
        <QueryState query={invites} skeletonRows={2}>
          {others.length === 0 && !latest ? (
            <p className="empty">{fr.invites.noActive}</p>
          ) : (
            <div className={styles.codes}>
              {others.map((invite) => (
                <CodeRow key={invite.code} invite={invite} now={now} />
              ))}
            </div>
          )}
        </QueryState>
      </div>
    </section>
  );
}

function RequestsPanel({ now }: { now: Date }) {
  const requests = useLinkRequests();
  const decide = useDecideRequest();
  return (
    <section className="panel" aria-labelledby="requests-title">
      <div className="panel-head">
        <h2 id="requests-title">{fr.invites.requests}</h2>
      </div>
      <div className="panel-body">
        <p className={`notice tone-neutral ${styles.privacy}`}>{fr.invites.privacy}</p>
        {decide.isError && (
          <p className="notice tone-danger" role="alert">
            {errorMessage(decide.error)}
          </p>
        )}
        <QueryState query={requests} skeletonRows={2}>
          {(requests.data ?? []).length === 0 ? (
            <p className="empty">{fr.invites.noRequests}</p>
          ) : (
            <ul className={styles.requests}>
              {(requests.data ?? []).map((r) => (
                <li key={r.id} className={styles.request}>
                  <div>
                    <p className={styles.requestName}>{r.patientName}</p>
                    <p className="subtle">{fr.invites.requestedAt(relativeTime(r.createdAt, now))}</p>
                  </div>
                  <div className={styles.requestActions}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: r.id, action: "REFUSE" })}
                    >
                      {fr.invites.refuse}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: r.id, action: "ACCEPT" })}
                    >
                      {fr.invites.accept}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </QueryState>
      </div>
    </section>
  );
}

export function InvitesView() {
  const now = useNow();
  return (
    <>
      <header className="page-head">
        <div>
          <h1>{fr.invites.title}</h1>
          <p>{fr.invites.subtitle}</p>
        </div>
      </header>
      <div className={styles.grid}>
        <RequestsPanel now={now} />
        <CodesPanel now={now} />
      </div>
    </>
  );
}
