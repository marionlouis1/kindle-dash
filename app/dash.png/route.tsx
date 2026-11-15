import { renderDashboard } from "@/lib/render";
import { getWeather } from "@/lib/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const png = await renderDashboard(await getWeather());
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // Weather barely moves in 10 minutes; let the CDN absorb repeat fetches.
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
    },
  });
}
