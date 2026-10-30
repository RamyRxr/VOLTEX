import { t } from "@/lib/i18n";

export interface StageNoteProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  readonly steps?: readonly { readonly title: string; readonly body: string }[];
}

/** Desktop-only editorial note beside the phone (hidden on a real phone). */
function StageNote({ eyebrow, title, body, steps = [] }: StageNoteProps) {
  return (
    <div className="stage__note no-print">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="display stage__title">{title}</h1>
      <p>{body}</p>
      {steps.length > 0 && (
        <div className="stage__steps">
          {steps.map((s, i) => (
            <div className="stage__step" key={s.title}>
              <span className="aside__n">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface PhoneFrameProps {
  readonly note?: StageNoteProps;
  readonly barStart: React.ReactNode;
  readonly barEnd: React.ReactNode;
  readonly children: React.ReactNode;
}

/** The patient page: full screen on a phone, framed beside a note on a laptop. */
export function PhoneFrame({ note, barStart, barEnd, children }: PhoneFrameProps) {
  return (
    <div className="stage">
      {note && <StageNote {...note} />}
      <main className="phone" id="contenu">
        <div className="phone__bar">
          <span>{barStart}</span>
          <span>{barEnd}</span>
        </div>
        <div className="phone__body">{children}</div>
      </main>
    </div>
  );
}

export function PhoneBrand({ end }: { end: React.ReactNode }) {
  return (
    <div className="phone__brand">
      <span className="brand__name" aria-label={t("app.name")}>
        Tensio<em>Care</em>
      </span>
      <span className="micro">{end}</span>
    </div>
  );
}
