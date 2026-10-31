"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { Level } from "shared";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fr } from "@/lib/i18n/fr";
import styles from "./MessageToasts.module.css";

export interface MessageToast {
  readonly id: string;
  readonly patientId: string;
  readonly fullName: string;
  readonly level: Level;
  readonly unconfirmedSevere: boolean;
  readonly body: string;
}

const VISIBLE_MS = 8000;
const PREVIEW_LENGTH = 110;

const preview = (body: string): string =>
  body.length > PREVIEW_LENGTH ? `${body.slice(0, PREVIEW_LENGTH - 1).trimEnd()}…` : body;

function Toast({ toast, onClose }: { toast: MessageToast; onClose: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(toast.id), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  return (
    <div className={styles.toast}>
      <Link href={`/d/patients/${toast.patientId}#chat`} className={styles.link} onClick={() => onClose(toast.id)}>
        <span className={styles.head}>
          <Icon name="message" />
          <span className={styles.title}>
            {fr.messages.newFrom} <b>{toast.fullName}</b>
          </span>
        </span>
        <StatusBadge level={toast.level} unconfirmedSevere={toast.unconfirmedSevere} />
        <span className={styles.body}>{preview(toast.body)}</span>
      </Link>
      <button type="button" className={styles.close} onClick={() => onClose(toast.id)} aria-label={fr.messages.dismiss} title={fr.messages.dismiss}>
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}

/** New-message cards, bottom right; click opens the patient's chat. Announced to screen readers. */
export function MessageToasts({ toasts, onClose }: { toasts: readonly MessageToast[]; onClose: (id: string) => void }) {
  return (
    <div className={styles.stack} role="status" aria-live="polite">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onClose={onClose} />
      ))}
    </div>
  );
}
