import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  envPrefix: ["VITE_", "TURNSTILE_"],
  resolve: {
    alias: {
      "@content": path.resolve(__dirname, "../../content")
    }
  }
});
