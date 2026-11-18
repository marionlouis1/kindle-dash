// Renders the dashboard once into <dir>/dash.png (default: site/), without
// Next.js. Used by the GitHub Pages workflow; also handy locally:
//   npm run render
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderDashboard } from "../lib/render";
import { getWeather } from "../lib/weather";

async function main() {
  const dir = process.argv[2] ?? "site";
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "dash.png");
  writeFileSync(file, await renderDashboard(await getWeather()));
  console.log(`wrote ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
