import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://sjroesink.github.io",
  base: "/GoLaunch",
  integrations: [tailwind()],
});
