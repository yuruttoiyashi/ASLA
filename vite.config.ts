import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // リポジトリ名が「ASLA」なら、前後をスラッシュで囲むのが正解です
  base: '/ASLA/', 
  build: {
    outDir: 'dist',
  }
})
