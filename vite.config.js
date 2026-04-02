import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        servers: resolve(__dirname, "servers.html"),
        map: resolve(__dirname, "map.html"),
        "map-vanilla": resolve(__dirname, "map-vanilla.html"),
        "map-creative": resolve(__dirname, "map-creative.html"),
        "map-modded": resolve(__dirname, "map-modded.html"),
      },
    },
  },
  server: {
    proxy: {
      "/bluemap": {
        target: "http://ip199-83-103-227.joinserver.xyz:25718",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bluemap/, ""),
      },
    },
  },
});
