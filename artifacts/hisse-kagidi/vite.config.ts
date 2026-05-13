import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";

const isBuild = process.argv.includes("build");

const rawPort = process.env.PORT;
let port = 3000;

if (rawPort) {
  port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }
} else if (!isBuild) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const basePath = process.env.BASE_PATH || "/";

const externalApiTarget = (() => {
  const raw = process.env.VITE_API_BASE_URL?.trim() || "https://api.kys.gelecekvadisi.org";
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "https://api.kys.gelecekvadisi.org";
  }
})();

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(isBuild
      ? [
          VitePWA({
            registerType: "autoUpdate",
            workbox: {
              cleanupOutdatedCaches: true,
              globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
              navigateFallback: "index.html",
              navigateFallbackAllowlist: [/^\/takip\//],
              runtimeCaching: [
                {
                  urlPattern: /\/(?:api\/)?tracking\/.+/,
                  handler: "NetworkFirst",
                  options: {
                    cacheName: "tracking-api-cache",
                    expiration: {
                      maxEntries: 50,
                      maxAgeSeconds: 60 * 60 * 24,
                    },
                    networkTimeoutSeconds: 5,
                  },
                },
              ],
            },
            manifest: {
              name: "Kurban Hisse Kağıdı - Kesim Takip",
              short_name: "Kesim Takip",
              description: "Kesim takip sayfası - çevrimdışı çalışabilir",
              theme_color: "#059669",
              background_color: "#ffffff",
              display: "standalone",
              icons: [
                {
                  src: "pwa-192x192.png",
                  sizes: "192x192",
                  type: "image/png",
                },
                {
                  src: "pwa-512x512.png",
                  sizes: "512x512",
                  type: "image/png",
                },
              ],
            },
          }),
        ]
      : []),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
    ...(process.env.ANALYZE === "true"
      ? [
          visualizer({
            filename: path.resolve(import.meta.dirname, "dist/bundle-report.html"),
            open: false,
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  worker: {
    format: "es",
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom")) return "vendor-react-dom";
            if (id.includes("react") && !id.includes("react-dom")) return "vendor-react";
            if (id.includes("@tanstack")) return "vendor-tanstack";
            if (id.includes("lucide-react")) return "vendor-lucide";
            if (id.includes("@radix-ui")) return "vendor-radix";
            if (id.includes("xlsx") || id.includes("exceljs")) return "vendor-xlsx";
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
            if (id.includes("qrcode")) return "vendor-qrcode";
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ["lucide-react", "react", "react-dom", "react-virtuoso"],
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/api": {
        target: externalApiTarget,
        changeOrigin: true,
        secure: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
