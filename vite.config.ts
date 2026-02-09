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
  },
  // Include ONNX models as assets (but not .mjs which are code)
  assetsInclude: ['**/*.onnx', '**/*.wasm']
})
