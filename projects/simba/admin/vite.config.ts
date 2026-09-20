import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@simba/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  server: { port: 5174 },
})
