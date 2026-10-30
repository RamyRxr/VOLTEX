import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { t } from "@/lib/i18n";

function Door({ href, no, title, desc }: { href: string; no: string; title: string; desc: string }) {
  return (
    <Link href={href} className="door">
      <span className="door__no">{no}</span>
      <span className="door__title">
        {title}
        <Icon name="arrow-right" size={26} />
      </span>
      <span className="door__desc">{desc}</span>
    </Link>
  );
}

export default function CoverPage() {
  return (
    <main className="cover" id="contenu">
      <div className="cover__frame">
        <div className="cover__top">
          <div className="seal-stamp" aria-hidden>
            <span>TC</span>
          </div>
          <div className="cover__head">
            <span className="eyebrow">{t("cover.file")}</span>
            <span>{t("cover.fileValue")}</span>
            <span className="eyebrow">{t("cover.field")}</span>
            <span>{t("cover.fieldValue")}</span>
            <span className="eyebrow">{t("cover.nature")}</span>
            <span>{t("cover.natureValue")}</span>
          </div>
        </div>

        <div className="cover__mid">
          <p className="eyebrow eyebrow--gold">{t("app.tagline")}</p>
          <h1 className="cover__word">
            Tensio<em>Care</em>
          </h1>
          <div className="cover__sub">
            <span className="display cover__between">{t("cover.between")}</span>
            <span className="cover__rule" aria-hidden />
            <span className="eyebrow">{t("cover.channels")}</span>
          </div>
          <p className="cover__lede">{t("cover.lede")}</p>
        </div>

        <div className="cover__doors">
          <Door href="/d" no="01" title={t("cover.doctor")} desc={t("cover.doctorDesc")} />
          <Door href="/p" no="02" title={t("cover.patient")} desc={t("cover.patientDesc")} />
        </div>

        <div className="cover__foot">
          <span>{t("cover.foot")}</span>
          <span className="num">{t("app.version")}</span>
        </div>
      </div>
    </main>
  );
}
