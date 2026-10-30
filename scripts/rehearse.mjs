/**
 * Stage rehearsal (spec §14), in real browsers.
 *
 *   npm run build && npm run start      # DEMO_MODE=true in .env.local
 *   node scripts/rehearse.mjs           # BASE=http://localhost:3000 by default
 *
 * Resets the demo, plays Ahmed 182/118 → re-measure → confirmed crisis, checks the
 * red row, acknowledges, messages, sends an SMS, takes the danger path, and
 * writes screenshots to shots/. Fails on any console error.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "shots";
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log("•", ...a);

try {
  const browser = await chromium.launch();
  const problems = [];
  const watch = (page, label) => {
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") problems.push(`${label} ${m.type()}: ${m.text().slice(0, 300)}`);
    });
    page.on("pageerror", (e) => problems.push(`${label} pageerror: ${e.message}`));
  };

  // ---- doctor on a laptop
  const doc = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dp = await doc.newPage();
  watch(dp, "doctor");
  await dp.goto(`${BASE}/login?next=/d`);
  await dp.getByRole("button", { name: /Dr Amine Benali/ }).click();
  await dp.waitForURL(`${BASE}/d`);
  const reset = await dp.request.post(`${BASE}/api/dev/reset`, { headers: { "Content-Type": "application/json" }, data: {} });
  log("reset", reset.status());
  await dp.reload();
  await dp.waitForSelector(".row");
  const names = await dp.locator(".row__name").allTextContents();
  log("triage rows", names.length, "| top:", names.slice(0, 5).join(", "));
  const reasons = await dp.locator(".row__reason").allTextContents();
  log("top reasons:", JSON.stringify(reasons.slice(0, 4)));
  await dp.screenshot({ path: `${OUT}/01-triage.png` });

  // ---- patient on a phone
  const pat = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const pp = await pat.newPage();
  watch(pp, "patient");
  await pp.goto(`${BASE}/login`);
  await pp.getByRole("button", { name: /Ahmed Saidi/ }).click();
  await pp.waitForURL(`${BASE}/p`);
  await pp.screenshot({ path: `${OUT}/02-patient-home.png`, fullPage: true });
  await pp.getByRole("link", { name: "Ajouter une mesure" }).click();
  await pp.waitForURL(`${BASE}/p/add`);

  const setTo = async (label, id, target) => {
    const current = Number(await pp.locator(`#${id}`).textContent());
    const btn = pp.getByRole("button", { name: `${target > current ? "Augmenter" : "Diminuer"} ${label}`, exact: true });
    for (let i = 0; i < Math.abs(target - current); i += 1) await btn.click();
  };
  await setTo("Haute (systolique)", "r1-sys", 182);
  await setTo("Basse (diastolique)", "r1-dia", 118);
  log("stepper r1 =", await pp.locator("#r1-sys").textContent(), "/", await pp.locator("#r1-dia").textContent());
  await pp.screenshot({ path: `${OUT}/03-add-first.png`, fullPage: true });

  const twoReadings = async () => {
    await pp.getByRole("button", { name: /Valider la 1re mesure/ }).click();
    await pp.waitForSelector(".countdown");
    await pp.waitForSelector("text=Faites maintenant la 2e mesure.", { timeout: 20000 });
    const pressedAt = Date.now();
    await pp.getByRole("button", { name: /Envoyer la mesure/ }).click();
    return pressedAt;
  };
  await twoReadings();
  await pp.waitForSelector("text=Reposez-vous 5 minutes et mesurez à nouveau");
  await pp.screenshot({ path: `${OUT}/04-remeasure.png`, fullPage: true });

  await dp.waitForFunction(() => [...document.querySelectorAll(".row")].some((r) => r.textContent.includes("Ahmed Saidi") && r.textContent.includes("En attente de confirmation")), null, { timeout: 5000 });
  log("doctor sees pending Ahmed (awaiting confirmation)");

  await pp.getByRole("button", { name: /Mesurer à nouveau/ }).click({ timeout: 20000 });
  log("re-measure prefilled =", await pp.locator("#r1-sys").textContent(), "/", await pp.locator("#r1-dia").textContent());
  const sentAt = await twoReadings();
  await pp.waitForSelector(".result .pstatus__word:has-text('Urgent')");
  await pp.screenshot({ path: `${OUT}/05-result-urgent.png`, fullPage: true });

  await dp.waitForFunction(() => {
    const first = document.querySelector(".row");
    return first && first.textContent.includes("Ahmed Saidi") && first.textContent.includes("Confirmé 182/118, niveau crise");
  }, null, { timeout: 5000 });
  log(`RED ROW on dashboard ${Date.now() - sentAt} ms after the patient pressed send`);
  await dp.waitForSelector(".redbanner");
  await dp.screenshot({ path: `${OUT}/06-triage-red.png` });

  await dp.locator(".redbanner").getByRole("button", { name: "Prendre en charge" }).first().click();
  await dp.waitForSelector(".redbanner", { state: "detached", timeout: 5000 });
  log("acknowledged: banner gone");

  await dp.locator(".row", { hasText: "Ahmed Saidi" }).first().click();
  await dp.waitForURL(/\/d\/patients\//);
  await dp.getByRole("button", { name: "Venez au cabinet aujourd'hui." }).click();
  await dp.locator(".dossier-messages").getByRole("button", { name: "Envoyer", exact: true }).click();
  await dp.waitForSelector(".msg--doctor:has-text('Venez au cabinet')");
  await dp.screenshot({ path: `${OUT}/07-dossier-ahmed.png`, fullPage: true });

  await pp.goto(`${BASE}/p`);
  await pp.waitForSelector(".doctor-note:has-text('Venez au cabinet')", { timeout: 6000 });
  log("patient sees the doctor's message on home");
  await pp.screenshot({ path: `${OUT}/08-patient-message.png`, fullPage: true });

  await dp.goto(`${BASE}/dev/sms-simulator`);
  await dp.getByRole("button", { name: "Simuler la réception" }).click();
  await dp.waitForSelector(".sim__reply");
  log("SMS reply:", (await dp.locator(".sim__reply").first().textContent()).replace(/\s+/g, " "));
  await dp.screenshot({ path: `${OUT}/09-sms-simulator.png` });

  for (const [path, file] of [["/d/indicators", "10-indicators"], ["/d/alerts", "11-alerts"]]) {
    await dp.goto(`${BASE}${path}`);
    await dp.waitForSelector(path.endsWith("alerts") ? ".alert-block" : ".figure");
    await dp.screenshot({ path: `${OUT}/${file}.png`, fullPage: true });
  }
  await dp.goto(`${BASE}/d`);
  await dp.locator(".row", { hasText: "Fatima Boudiaf" }).first().click();
  await dp.waitForSelector(".note");
  log("Fatima lines:", JSON.stringify(await dp.locator(".note__body").allTextContents()));
  await dp.screenshot({ path: `${OUT}/12-dossier-fatima.png`, fullPage: true });

  await pp.goto(`${BASE}/p/add`);
  await pp.getByRole("button", { name: /Douleur dans la poitrine/ }).click();
  await pp.waitForSelector(".danger-panel");
  await pp.screenshot({ path: `${OUT}/13-danger-panel.png`, fullPage: true });
  await pp.getByRole("button", { name: "Envoyer maintenant" }).click();
  await pp.waitForSelector("text=Appelez le 14 maintenant");
  await pp.screenshot({ path: `${OUT}/14-call14.png`, fullPage: true });
  await dp.goto(`${BASE}/d`);
  await dp.waitForFunction(() => document.querySelector(".row")?.textContent.includes("Signe de danger"), null, { timeout: 5000 });
  log("doctor top row:", (await dp.locator(".row__reason").first().textContent()));

  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mob.addCookies(await doc.cookies());
  const mp = await mob.newPage();
  watch(mp, "doctor-mobile");
  await mp.goto(`${BASE}/d`);
  await mp.waitForSelector(".row");
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  log("doctor on phone: horizontal overflow px =", overflow);
  await mp.screenshot({ path: `${OUT}/15-triage-mobile.png` });

  log("console problems:", problems.length);
  problems.forEach((p) => console.log("  !", p));
  await browser.close();
  if (problems.length > 0) process.exit(1);
} catch (e) {
  console.error("FAILED:", e.message);
  process.exit(1);
}
