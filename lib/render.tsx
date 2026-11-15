import { readFileSync } from "node:fs";
import path from "node:path";
import satori from "satori";
import sharp from "sharp";
import { PLACE, describe, type Weather } from "./weather";

// Kindle Paperwhite 11th gen (PW5) screen, portrait.
export const WIDTH = 1236;
export const HEIGHT = 1648;

// Fonts and icons come straight from their npm packages (see next.config.mjs for tracing).
const FONT_DIR = path.join(process.cwd(), "node_modules/@fontsource/inter/files");
const ICON_DIR = path.join(process.cwd(), "node_modules/@tabler/icons/icons/outline");

const fonts = [
  { name: "Inter", weight: 400 as const, style: "normal" as const, data: readFileSync(path.join(FONT_DIR, "inter-latin-400-normal.woff")) },
  { name: "Inter", weight: 600 as const, style: "normal" as const, data: readFileSync(path.join(FONT_DIR, "inter-latin-600-normal.woff")) },
];

const iconCache = new Map<string, string>();
function iconSrc(name: string, stroke = 1.5) {
  const key = `${name}:${stroke}`;
  let src = iconCache.get(key);
  if (!src) {
    const svg = readFileSync(path.join(ICON_DIR, `${name}.svg`), "utf8")
      .replace(/currentColor/g, "#000")
      .replace(/stroke-width="[^"]*"/, `stroke-width="${stroke}"`);
    src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    iconCache.set(key, src);
  }
  return src;
}

function Icon({ name, size, stroke }: { name: string; size: number; stroke?: number }) {
  return <img src={iconSrc(name, stroke)} width={size} height={size} />;
}

const r = (n: number) => Math.round(n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
      <Icon name={icon} size={64} stroke={1.75} />
      <div style={{ fontSize: 46, fontWeight: 600, marginTop: 10 }}>{value}</div>
      <div style={{ fontSize: 30, color: "#333" }}>{label}</div>
    </div>
  );
}

function Dashboard({ w, now }: { w: Weather; now: Date }) {
  const current = describe(w.now.code, w.now.isDay);
  const day = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: PLACE.tz,
  }).format(now);
  const time = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: PLACE.tz,
  }).format(now);
  const dayName = (date: string) =>
    new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

  const rule = { height: 3, background: "#000", width: "100%" };

  return (
    <div
      style={{
        // Satori sizes are content-box: subtract the padding below.
        width: WIDTH - 144,
        height: HEIGHT - 112,
        background: "#fff",
        color: "#000",
        fontFamily: "Inter",
        display: "flex",
        flexDirection: "column",
        padding: "64px 72px 48px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: 64, fontWeight: 600 }}>{PLACE.name}</div>
        <div style={{ fontSize: 36 }}>{cap(day)}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24 }}>
        <Icon name={current.icon} size={360} stroke={1.25} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ fontSize: 300, fontWeight: 600, lineHeight: 1, letterSpacing: -12 }}>{r(w.now.temp)}°</div>
          <div style={{ fontSize: 52, fontWeight: 600 }}>{current.label}</div>
          <div style={{ fontSize: 38, color: "#333" }}>Ressenti {r(w.now.feels)}°</div>
        </div>
      </div>

      <div style={{ ...rule, marginTop: 40 }} />
      <div style={{ display: "flex", padding: "32px 0" }}>
        <Stat icon="wind" value={`${r(w.now.wind)} km/h`} label={`rafales ${r(w.now.gusts)}`} />
        <Stat icon="umbrella" value={`${r(w.days[0].rain)} %`} label="pluie" />
        <Stat icon="droplet" value={`${r(w.now.humidity)} %`} label="humidité" />
        <Stat icon={w.now.isDay ? "sunset" : "sunrise"} value={w.now.isDay ? w.sunset : w.sunrise} label={w.now.isDay ? "coucher" : "lever"} />
      </div>
      <div style={rule} />

      <div style={{ display: "flex", padding: "32px 0" }}>
        {w.hours.map((h) => (
          <div key={h.hour} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
            <div style={{ fontSize: 34, color: "#333" }}>{h.hour}</div>
            <div style={{ display: "flex", margin: "8px 0" }}>
              <Icon name={describe(h.code, h.isDay).icon} size={84} stroke={1.5} />
            </div>
            <div style={{ fontSize: 46, fontWeight: 600 }}>{r(h.temp)}°</div>
            <div style={{ fontSize: 30, color: "#333" }}>{r(h.rain)} %</div>
          </div>
        ))}
      </div>
      <div style={rule} />

      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-around", paddingTop: 12 }}>
        {w.days.slice(1, 6).map((d) => (
          <div key={d.date} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ fontSize: 42, width: 300 }}>{cap(dayName(d.date))}</div>
            <Icon name={describe(d.code).icon} size={68} stroke={1.5} />
            <div style={{ fontSize: 34, color: "#333", width: 300, paddingLeft: 28 }}>
              {describe(d.code).label}
            </div>
            <div style={{ fontSize: 34, color: "#333", flex: 1, textAlign: "right", justifyContent: "flex-end", display: "flex" }}>
              {r(d.rain)} %
            </div>
            <div style={{ fontSize: 42, width: 230, display: "flex", justifyContent: "flex-end" }}>
              <span style={{ color: "#333" }}>{r(d.min)}°</span>
              <span style={{ fontWeight: 600, marginLeft: 24 }}>{r(d.max)}°</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 26, color: "#444", marginTop: 8 }}>
        Mis à jour à {time}
      </div>
    </div>
  );
}

/** 8-bit grayscale PNG at the Kindle's native resolution. */
export async function renderDashboard(w: Weather, now = new Date()): Promise<Buffer> {
  const svg = await satori(<Dashboard w={w} now={now} />, { width: WIDTH, height: HEIGHT, fonts });
  return sharp(Buffer.from(svg))
    .flatten({ background: "#fff" })
    .toColourspace("b-w")
    .png({ compressionLevel: 9 })
    .toBuffer();
}
