import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "public-web",
  base: "/Game-GDEYA/",
  plugins: [react()],
  build: {
    outDir: "../dist-public",
    emptyOutDir: true,
  },
});
