import { DANGER_ITEMS, QUESTIONNAIRE_ITEMS, type AlertDto, type QuestionnaireDto, type SessionDto } from "shared";
import { AlertBadge } from "@/components/alerts/AlertBadge";
import { formatBp, formatDateTime } from "@/lib/format";
import { fr } from "@/lib/i18n/fr";
import styles from "./file.module.css";

const SESSION_TONE: Readonly<Record<SessionDto["status"], string>> = {
  NORMAL: "tone-ok",
  HYPERTENSIVE: "tone-warning",
  SEVERE_PENDING: "tone-danger",
  SEVERE_CONFIRMED: "tone-danger",
  SEVERE_NOT_CONFIRMED: "tone-neutral",
  SEVERE_EXPIRED: "tone-danger",
};

/** Every reading, newest first; unconfirmed ones always shown (spec §6.2). */
export function ReadingsTable({ sessions }: { sessions: readonly SessionDto[] }) {
  if (sessions.length === 0) return <p className="empty">{fr.file.noReadings}</p>;
  const c = fr.file.readingsColumns;
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">{c.date}</th>
            <th scope="col">{c.value}</th>
            <th scope="col">{c.pulse}</th>
            <th scope="col">{c.status}</th>
            <th scope="col">{c.source}</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td className="tabular">{formatDateTime(s.takenAt)}</td>
              <td className={`tabular ${styles.strong}`}>{formatBp(s)}</td>
              <td className="tabular">{s.pulse ?? fr.common.none}</td>
              <td>
                <span className={`pill ${SESSION_TONE[s.status]}`}>
                  <span className="pill-dot" aria-hidden />
                  {fr.session[s.status]}
                </span>
              </td>
              <td className="subtle">{fr.session.source[s.source]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DANGER: ReadonlySet<string> = new Set(DANGER_ITEMS);

/** Questionnaire answers over time: the "yes" answers, danger items first. */
export function QuestionnairesTable({ questionnaires }: { questionnaires: readonly QuestionnaireDto[] }) {
  if (questionnaires.length === 0) return <p className="empty">{fr.file.noQuestionnaires}</p>;
  const c = fr.file.questionnairesColumns;
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">{c.date}</th>
            <th scope="col">{c.answers}</th>
          </tr>
        </thead>
        <tbody>
          {questionnaires.map((q) => {
            const yes = QUESTIONNAIRE_ITEMS.filter((item) => q.answers[item] === true);
            return (
              <tr key={q.id}>
                <td className="tabular">{formatDateTime(q.answeredAt)}</td>
                <td>
                  {yes.length === 0 ? (
                    <span className="pill tone-ok">{fr.file.noSymptom}</span>
                  ) : (
                    <span className={styles.answerList}>
                      {yes.map((item) => (
                        <span
                          key={item}
                          className={`pill ${DANGER.has(item) ? "tone-danger" : "tone-watch"}`}
                          title={DANGER.has(item) ? fr.questionnaire.danger : fr.questionnaire.watch}
                        >
                          <span className="pill-dot" aria-hidden />
                          {fr.questionnaire[item]}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AlertsHistory({ alerts }: { alerts: readonly AlertDto[] }) {
  if (alerts.length === 0) return <p className="empty">{fr.file.noAlerts}</p>;
  const c = fr.file.alertsColumns;
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">{c.date}</th>
            <th scope="col">{c.level}</th>
            <th scope="col">{c.reason}</th>
            <th scope="col">{c.status}</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={a.id}>
              <td className="tabular">{formatDateTime(a.createdAt)}</td>
              <td>
                <AlertBadge level={a.level} />
              </td>
              <td>{a.reason}</td>
              <td className="subtle">{fr.alerts.status[a.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
