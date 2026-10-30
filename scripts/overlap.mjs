import { chromium } from "playwright";

const BASE = "http://localhost:3000";
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

const browser = await chromium.launch();

for (const vp of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();

  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    const res = await page.evaluate(() => {
      const leaves = [...document.querySelectorAll("body *")].filter((el) => {
        if (el.closest("svg")) return false;
        if (!el.textContent || !el.textContent.trim()) return false;
        return el.children.length === 0;
      });

      const boxes = leaves.map((el) => ({ el, r: el.getBoundingClientRect() })).filter((b) => b.r.width > 0 && b.r.height > 0 && b.r.width < window.innerWidth * 0.9);
      const hits = [];
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
          const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
          const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
          if (w <= 2 || h <= 2) continue;
          const frac = (w * h) / Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
          if (frac > 0.35) {
            hits.push(
              `${a.el.tagName}.${a.el.className} "${a.el.textContent.trim().slice(0, 24)}" <> ${b.el.tagName}.${b.el.className} "${b.el.textContent.trim().slice(0, 24)}" ${Math.round(frac * 100)}%`,
            );
          }
        }
      }

      const blocks = [".cover__frame", ".ledger", ".phone", ".seal", ".figures", ".detail", ".stage"].map((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return `${sel} ${Math.round(r.width)}x${Math.round(r.height)}`;
      });

      return { hits: [...new Set(hits)].slice(0, 6), blocks: blocks.filter(Boolean), h: document.documentElement.scrollHeight };
    });

    console.log(`\n[${vp.width}] ${route}  page=${res.h}px  ${res.blocks.join("  ")}`);
    if (res.hits.length) console.log("  overlap:", res.hits.join(" | "));
  }
  await ctx.close();
}

await browser.close();
