// Renders the dashboard once into <dir>/dash.png (default: site/), without
// Next.js. Used by the GitHub Pages workflow; also handy locally:
//   npm run render
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderDashboard } from "../lib/render";
import { getWeather } from "../lib/weather";

const TRIES = 4;
const WAIT_MS = 15_000;

// The weather service occasionally refuses or drops a request (the workflow
// runs from shared addresses), so try a few times before giving up.
async function weather() {
  for (let attempt = 1; ; attempt++) {
    try {
      return await getWeather();
    } catch (err) {
      console.error(`weather attempt ${attempt}/${TRIES} failed:`, err);
      if (attempt === TRIES) throw err;
      await new Promise((r) => setTimeout(r, WAIT_MS));
    }
  }
}

async function main() {
  const dir = process.argv[2] ?? "site";
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "dash.png");
  writeFileSync(file, await renderDashboard(await weather()));
  console.log(`wrote ${file}`);
}

main().catch((err) => {
  // Shown as an annotation on the workflow run when this runs in GitHub Actions.
  const cause = err?.cause ? ` (${err.cause?.code ?? err.cause})` : "";
  console.error(`::error::render failed: ${err?.message ?? err}${cause}`);
  process.exit(1);
});
