"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LoginResponse } from "@/app/api/auth/login/route";
import { ApiError, apiSend } from "@/lib/client/api";
import { t } from "@/lib/i18n";
import { RegisterForm } from "./RegisterForm";

export interface DemoAccount {
  readonly name: string;
  readonly role: string;
  readonly phone: string;
}

/** Only follow ?next= inside the signed-in user's own space (no open redirect). */
function safeNext(next: string | null, home: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return home;
  const inside = next === home || next.startsWith(`${home}/`) || (home === "/d" && next.startsWith("/dev/"));
  return inside ? next : home;
}

function errorText(err: unknown): string {
  if (err instanceof ApiError && err.code === "UNAUTHORIZED") return t("login.error.code");
  if (err instanceof ApiError && err.code === "INVALID") return t("login.error.phone");
  return t("login.error.generic");
}

export function LoginForm({ next, demoAccounts, demoCode }: { next: string | null; demoAccounts: readonly DemoAccount[]; demoCode: string | null }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [register, setRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async (p: string, c: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiSend<LoginResponse>("/api/auth/login", "POST", { phone: p, code: c });
      if (res.needsRegistration) {
        setPhone(p);
        setCode(c);
        setRegister(true);
        setBusy(false);
        return;
      }
      router.replace(safeNext(next, res.redirect));
      router.refresh();
    } catch (err: unknown) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  if (register) return <RegisterForm phone={phone} code={code} />;

  return (
    <form
      className="auth__form"
      onSubmit={(e) => {
        e.preventDefault();
        void signIn(phone, code);
      }}
    >
      <h2 className="auth__title">{t("login.title")}</h2>
      <p className="sub">{t("login.lede")}</p>
      <label className="field">
        <span className="field__label">{t("login.phone")}</span>
        <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      </label>
      <label className="field">
        <span className="field__label">{t("login.code")}</span>
        <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
      </label>
      {demoCode && <p className="micro">{t("login.codeHint", { code: demoCode })}</p>}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="cta" disabled={busy}>
        {t("login.submit")}
      </button>

      {demoCode && demoAccounts.length > 0 && (
        <div className="auth__demo">
          <p className="eyebrow">{t("login.demo")}</p>
          {demoAccounts.map((a) => (
            <button key={a.phone} type="button" className="demo-account" disabled={busy} onClick={() => void signIn(a.phone, demoCode)}>
              <span className="demo-account__name">{a.name}</span>
              <span className="micro">{a.role}</span>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
