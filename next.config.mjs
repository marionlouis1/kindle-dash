/** @type {import('next').NextConfig} */
export default {
  // GitHub's runners share addresses that Open-Meteo rate-limits, so the Pages
  // workflow asks for the forecast through here. An external rewrite is served
  // by Vercel's CDN without running a function, so it uses no function CPU.
  async rewrites() {
    return [{ source: "/open-meteo/v1/forecast", destination: "https://api.open-meteo.com/v1/forecast" }];
  },
  // Fonts and icons are read from disk at runtime; make sure they ship with the function.
  outputFileTracingIncludes: {
    "/dash.png": [
      "./node_modules/@fontsource/inter/files/inter-latin-*-normal.woff",
      "./node_modules/@tabler/icons/icons/outline/*.svg",
    ],
  },
};
