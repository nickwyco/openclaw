// Generates a print-ready PDF of labels from index.html.
// Usage: node scripts/make-pdf.mjs <out.pdf> [qty] [size WxH inches] [title] [sku] [price]
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path";

const [out = "labels.pdf", qty = "25", size = "2.125x1",
       title = "$40 Rock Tee", sku = "B07042601", price = "$ 40"] = process.argv.slice(2);
const [w, h] = size.split("x");

const htmlPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html");
const url = "file://" + htmlPath + "?" + new URLSearchParams({ title, sku, price, qty, size });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
await page.goto(url);
await page.pdf({
  path: out,
  width: `${w}in`,
  height: `${h}in`,
  margin: { top: 0, bottom: 0, left: 0, right: 0 },
  printBackground: true,
});
await browser.close();
console.log("wrote", out);
