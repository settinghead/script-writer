import path from "path"
import react from "@vitejs/plugin-react"
const { defineConfig } = require("vite") as any

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    outDir: 'dist-client',
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
  // Add this to avoid relative path imports for TypeScript
  optimizeDeps: {
    include: ["antd"],
  },

  server: {
    host: '0.0.0.0',
    hmr: {
      protocol: 'wss',
      host: '0.0.0.0',
    },
    // Enable history API fallback for client-side routing
    historyApiFallback: true
  }
})