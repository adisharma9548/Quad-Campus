import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // Decided at build time so that real-backend builds do not ship the offline mock service
  // (which contains demo accounts and passwords) or the demo seed content.
  const authReal = String(env.VITE_AUTH_MODE || 'mock').trim().toLowerCase() === 'real'
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __AUTH_REAL__: JSON.stringify(authReal),
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:4000',
          changeOrigin: true,
        },
      },
    },
  }
})
