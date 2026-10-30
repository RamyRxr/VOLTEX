"use client";

import Link from "next/link";
import { MessageComposer, Thread } from "@/components/MessageComposer";
import { Icon } from "@/components/ui/Icon";
import { useSelf } from "@/lib/client/queries";
import { displayPhone } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { PatientSelfView } from "@/lib/services/views";
import { PhoneBrand, PhoneFrame } from "./PhoneFrame";

/** "Contacter mon médecin": call the practice or write; 14 for emergencies only. */
export function ContactView({ initial }: { initial: PatientSelfView }) {
  const { data } = useSelf(initial.patientId, initial);
  const v = data ?? initial;

  return (
    <PhoneFrame barStart={<Link href="/p">← {t("common.back")}</Link>} barEnd={t("contact.title")}>
      <PhoneBrand end={v.doctor.name} />

      {v.doctor.phone && (
        <a className="cta cta--ghost" href={`tel:${v.doctor.phone}`}>
          <span>
            {t("contact.call")}
            <span className="cta__sub num">{displayPhone(v.doctor.phone)}</span>
          </span>
          <Icon name="phone" size={18} />
        </a>
      )}
      <p className="safety">
        <Icon name="alert-octagon" size={13} /> {t("contact.urgent")}
      </p>

      <div className="phone__section">
        <div className="phone__section-head">
          <h2>{t("contact.thread")}</h2>
        </div>
        <Thread messages={v.messages} mine="PATIENT" />
      </div>

      <div className="phone__section">
        <MessageComposer patientId={v.patientId} placeholder={t("contact.placeholder")} />
      </div>
    </PhoneFrame>
  );
}
