import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch();

const ROUTES = [
  "/",
  "/doctor",
  "/doctor/patients/p-01",
  "/doctor/patients/p-06",
  "/doctor/patients/p-07",
  "/doctor/indicateurs",
  "/patient",
  "/patient/add",
];

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1024", width: 1024, height: 800 },
  { name: "768", width: 768, height: 900 },
  { name: "390", width: 390, height: 844 },
];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();

  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);

    const report = await page.evaluate(() => {
      const vw = window.innerWidth;
      const out = { overflowX: document.documentElement.scrollWidth - vw, wide: [], clipped: [], fonts: [], small: [] };

      const desc = (el) => {
        const id = el.id ? `#${el.id}` : "";
        const cls = el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : "";
        return `${el.tagName.toLowerCase()}${id}${cls}`.slice(0, 90);
      };

      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > vw + 1 && !el.closest(".table-scroll, .no-print")) {
          out.wide.push(`${desc(el)} right=${Math.round(r.right)}`);
        }
        const cs = getComputedStyle(el);
        if (
          (cs.overflowX === "hidden" || cs.overflow === "hidden") &&
          el.scrollWidth > el.clientWidth + 2 &&
          el.textContent.trim().length > 0 &&
          cs.textOverflow !== "ellipsis"
        ) {
          out.clipped.push(`${desc(el)} ${el.scrollWidth}>${el.clientWidth}`);
        }
      }

      for (const sel of ["h1", ".cover__word", ".patient-name", ".row__name", ".stepper__value"]) {
        const el = document.querySelector(sel);
        if (el) out.fonts.push(`${sel}: ${getComputedStyle(el).fontFamily.split(",")[0]}`);
      }

      for (const el of document.querySelectorAll("button, a.cta, a.door, .chip, .toggle")) {
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.height < 32) out.small.push(`${desc(el)} h=${Math.round(r.height)}`);
      }

      return {
        ...out,
        wide: [...new Set(out.wide)].slice(0, 8),
        clipped: [...new Set(out.clipped)].slice(0, 8),
        small: [...new Set(out.small)].slice(0, 8),
        fonts: [...new Set(out.fonts)],
      };
    });

    const bad = report.overflowX > 1 || report.wide.length || report.clipped.length;
    console.log(`\n[${vp.name}] ${route}  scrollX+${report.overflowX}${bad ? "  <-- CHECK" : ""}`);
    if (report.wide.length) console.log("  wide:", report.wide.join(" | "));
    if (report.clipped.length) console.log("  clipped:", report.clipped.join(" | "));
    if (report.small.length) console.log("  small targets:", report.small.join(" | "));
  }

  await ctx.close();
}

/* font + palette sanity on one page */
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle" });
console.log(
  await page.evaluate(() => {
    const loaded = [...document.fonts].map((f) => `${f.family} ${f.style} ${f.weight} ${f.status}`);
    const h1 = document.querySelector(".cover__word");
    const cs = getComputedStyle(h1);
    return {
      loaded: [...new Set(loaded)],
      h1: { family: cs.fontFamily, size: cs.fontSize, letter: cs.letterSpacing, line: cs.lineHeight },
      body: getComputedStyle(document.body).backgroundColor,
      ink: getComputedStyle(document.body).color,
      wordBox: h1.getBoundingClientRect().width,
      frameBox: document.querySelector(".cover__frame").getBoundingClientRect().width,
    };
  }),
);

await browser.close();
