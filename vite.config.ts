import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [tailwindcss()],
  clearScreen: false,
  build: {
    target: "es2022",
  },
  server: {
    port: 24680,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 24681 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
