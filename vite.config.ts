import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react()
  ],
  base: process.env.NODE_ENV === 'development' ? '/' : './',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      }
    },
    watch: {
      // Don't watch backend/server dirs — they have their own dev servers
      ignored: ['**/backend-team/**', '**/server/**', '**/dist-server/**', '**/release/**', '**/openclaw-reference/**', '**/data/**']
    }
  },
  // Pre-bundle heavy dependencies so Vite doesn't discover them one-by-one
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'recharts',
      'lucide-react',
      'axios',
    ]
  },
  // Include ONNX models as assets (but not .mjs which are code)
  assetsInclude: ['**/*.onnx', '**/*.wasm']
})
