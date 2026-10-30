import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
mkdirSync("shots", { recursive: true });

const browser = await chromium.launch();
const errors = [];

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} :: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`${page.url()} :: ${e.message}`));

const desktop = [
  ["/", "cover"],
  ["/doctor", "triage"],
  ["/doctor/patients/p-01", "dossier-orange"],
  ["/doctor/patients/p-06", "dossier-emergency"],
  ["/doctor/patients/p-07", "dossier-pending"],
  ["/doctor/indicateurs", "indicateurs"],
  ["/patient", "patient-accueil"],
];

for (const [route, name] of desktop) {
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  await page.screenshot({ path: `shots/${name}.png`, fullPage: true });
  console.log("shot", name);
}

/* --- the live scenario, on the real engine --- */
await page.goto(BASE + "/patient/add", { waitUntil: "networkidle" });
await page.screenshot({ path: "shots/add-1-form.png", fullPage: true });

const plus = (label) => page.getByRole("button", { name: `Augmenter ${label}` });
for (let i = 0; i < 54; i++) await plus("Systolique").click();
for (let i = 0; i < 36; i++) await plus("Diastolique").click();
await page.getByRole("button", { name: "Enregistrer la mesure" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: "shots/add-2-confirm.png", fullPage: true });
console.log("pending screen text:", (await page.locator(".result").first().innerText()).replace(/\s+/g, " "));

await page.getByRole("button", { name: "Envoyer la seconde mesure" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: "shots/add-3-crisis.png", fullPage: true });
console.log("result text:", (await page.locator(".result").first().innerText()).replace(/\s+/g, " "));

/* --- mobile --- */
const mob = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const mp = await mob.newPage();
for (const [route, name] of [
  ["/doctor", "m-triage"],
  ["/patient", "m-patient"],
  ["/patient/add", "m-add"],
  ["/doctor/patients/p-01", "m-dossier"],
]) {
  await mp.goto(BASE + route, { waitUntil: "networkidle" });
  await mp.screenshot({ path: `shots/${name}.png`, fullPage: true });
  console.log("shot", name);
}

console.log(errors.length ? "CONSOLE ERRORS:\n" + errors.join("\n") : "no console errors");
await browser.close();
