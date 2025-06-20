import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

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
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
    // Enable history API fallback for client-side routing
    historyApiFallback: true,
    proxy: {
      // Proxy WebSocket connections for YJS
      '/yjs': {
        target: 'ws://localhost:4600', // Your backend server address
        ws: true, // IMPORTANT: Enable WebSocket proxying
        secure: false,
        changeOrigin: true,
      },
      // You might also want to proxy regular HTTP API calls if not already configured
      '/llm-api': {
        target: 'http://localhost:4600',
        secure: false,
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:4600',
        secure: false,
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:4600',
        secure: false,
        changeOrigin: true,
      }
    }
  }
})