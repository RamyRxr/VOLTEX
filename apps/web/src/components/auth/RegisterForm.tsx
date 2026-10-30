"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, apiSend } from "@/lib/client/api";
import { t } from "@/lib/i18n";
import { registerSchema } from "@/lib/validation/schemas";

const AGE_MIN = 18;
const AGE_MAX = 120;

/** First sign-in (spec §4.1): consent, invite code, profile. */
export function RegisterForm({ phone, code }: { phone: string; code: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (k: string) => String(form.get(k) ?? "").trim();
    const parsed = registerSchema.safeParse({
      phone,
      code,
      consent: form.get("consent") === "on",
      inviteCode: text("inviteCode"),
      name: text("name"),
      age: Number(text("age")),
      sex: text("sex"),
      treatmentNames: text("treatments").split(",").map((s) => s.trim()).filter(Boolean),
      emergencyContactPhone: text("emergency") || null,
      language: text("language") || "FR",
    });
    if (!parsed.success) {
      const consentMissing = parsed.error.issues.some((i) => i.path[0] === "consent");
      setError(consentMissing ? t("register.error.consent") : t("register.error.generic"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiSend("/api/auth/register-patient", "POST", parsed.data);
      router.replace("/p");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof ApiError && err.code === "NOT_FOUND" ? t("register.error.invite") : t("register.error.generic"));
      setBusy(false);
    }
  };

  return (
    <form className="auth__form" onSubmit={submit} noValidate>
      <h2 className="auth__title">{t("register.title")}</h2>
      <p className="sub">{t("register.lede")}</p>
      <label className="field">
        <span className="field__label">{t("register.name")}</span>
        <input name="name" autoComplete="name" required />
      </label>
      <div className="auth__row">
        <label className="field">
          <span className="field__label">{t("register.age")}</span>
          <input name="age" inputMode="numeric" pattern="[0-9]*" min={AGE_MIN} max={AGE_MAX} required />
        </label>
        <label className="field">
          <span className="field__label">{t("register.sex")}</span>
          <select name="sex" defaultValue="F">
            <option value="F">{t("register.sex.F")}</option>
            <option value="M">{t("register.sex.M")}</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span className="field__label">{t("register.invite")}</span>
        <input name="inviteCode" autoCapitalize="characters" required />
      </label>
      <label className="field">
        <span className="field__label">{t("register.treatments")}</span>
        <input name="treatments" />
      </label>
      <label className="field">
        <span className="field__label">{t("register.emergency")}</span>
        <input name="emergency" type="tel" inputMode="tel" autoComplete="tel" />
      </label>
      <label className="field">
        <span className="field__label">{t("register.language")}</span>
        <select name="language" defaultValue="FR">
          <option value="FR">{t("register.lang.FR")}</option>
          <option value="AR">{t("register.lang.AR")}</option>
        </select>
      </label>
      <label className="checkbox">
        <input type="checkbox" name="consent" required />
        <span>{t("register.consent")}</span>
      </label>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="cta" disabled={busy}>
        {t("register.submit")}
      </button>
    </form>
  );
}
