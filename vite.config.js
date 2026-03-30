import { defineConfig } from "vite";

export default defineConfig({
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
