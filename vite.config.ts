import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages base path: https://julianailo.github.io/loanoptions-roster/
export default defineConfig({
  plugins: [react()],
  base: '/loanoptions-roster/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
