import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const pick = async (route, fn) => {
  await page.goto("http://localhost:3000" + route, { waitUntil: "networkidle" });
  return page.evaluate(fn);
};

console.log(
  "p-01 tokens:",
  await pick("/doctor/patients/p-01", () => {
    const cs = (sel, prop) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el)[prop] : null;
    };
    return {
      sealColor: cs(".seal", "color"),
      sealBorder: cs(".seal", "borderTopColor"),
      markColor: cs(".mark", "color"),
      alertBorder: cs(".alert-block", "borderLeftColor"),
      rule: cs(".rule-id", "color"),
      eyebrow: cs(".eyebrow", "color"),
      title: cs(".patient-name", "fontFamily") + " / " + cs(".patient-name", "fontSize"),
      rowFlagBorder: document.querySelector(".readings tr.is-flag td") ? getComputedStyle(document.querySelector(".readings tr.is-flag td")).boxShadow : null,
      chartStroke: document.querySelectorAll(".chart-frame svg path")[1]?.getAttribute("stroke"),
    };
  }),
);

const triage = await pick("/doctor", () => {
  const rows = [...document.querySelectorAll(".row")].slice(0, 8).map((r) => ({
    name: r.querySelector(".row__name")?.textContent,
    c: getComputedStyle(r).getPropertyValue("--c").trim(),
    h: Math.round(r.getBoundingClientRect().height),
    meta: r.querySelector(".row__meta")?.textContent?.trim(),
  }));
  const chips = [...document.querySelectorAll(".chip")].map((c) => `${c.textContent.trim()} h=${Math.round(c.getBoundingClientRect().height)}`);
  return { rows, chips, count: document.querySelectorAll(".row").length, ledger: Math.round(document.querySelector(".ledger").getBoundingClientRect().height) };
});
console.log("triage rows:", JSON.stringify(triage.rows, null, 1));
console.log("chips:", triage.chips.join(" | "), "| rows:", triage.count);

/* screenshot the fix states once more for the record */
await page.screenshot({ path: "shots/triage-final.png", fullPage: true });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
console.log(
  "cover:",
  await page.evaluate(() => {
    const h1 = document.querySelector(".cover__word");
    const range = document.createRange();
    range.selectNodeContents(h1);
    const t = range.getBoundingClientRect();
    const f = document.querySelector(".cover__frame").getBoundingClientRect();
    return {
      text: Math.round(t.width),
      frame: Math.round(f.width),
      fill: Math.round((t.width / f.width) * 100) + "%",
      size: getComputedStyle(h1).fontSize,
      page: document.documentElement.scrollHeight,
      vh: innerHeight,
    };
  }),
);
await browser.close();
