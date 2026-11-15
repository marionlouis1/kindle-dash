/** @type {import('next').NextConfig} */
export default {
  // Fonts and icons are read from disk at runtime; make sure they ship with the function.
  outputFileTracingIncludes: {
    "/dash.png": [
      "./node_modules/@fontsource/inter/files/inter-latin-*-normal.woff",
      "./node_modules/@tabler/icons/icons/outline/*.svg",
    ],
  },
};
