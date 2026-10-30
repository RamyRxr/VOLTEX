"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { meSchema } from "shared";
import { api } from "@/lib/api";
import { fr } from "@/lib/i18n/fr";
import { supabaseBrowser } from "@/lib/supabase";
import styles from "./LoginForm.module.css";

/** Only internal paths are accepted as a return target. */
const safeNext = (next: string | null): string => (next && next.startsWith("/d") ? next : "/d");

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setBusy(false);
      setError(fr.login.badCredentials);
      return;
    }
    try {
      const me = await api("/api/me", meSchema);
      if (me.role !== "DOCTOR") {
        await supabase.auth.signOut();
        setError(fr.login.notDoctor);
        setBusy(false);
        return;
      }
      router.replace(safeNext(params.get("next")));
    } catch {
      await supabase.auth.signOut();
      setError(fr.login.failed);
      setBusy(false);
    }
  }

  return (
    <main id="contenu" className={styles.page}>
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.brand}>{fr.app.name}</div>
        <h1 id="login-title">{fr.login.title}</h1>
        <p className={styles.subtitle}>{fr.login.subtitle}</p>
        <form onSubmit={submit} className={styles.form} noValidate>
          <div className="field">
            <label htmlFor="email">{fr.login.email}</label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">{fr.login.password}</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p className="notice tone-danger" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy || !email || !password}>
            {busy ? fr.login.submitting : fr.login.submit}
          </button>
        </form>
        <p className={styles.principle}>{fr.app.principle}</p>
      </section>
    </main>
  );
}
