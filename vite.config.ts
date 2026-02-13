import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pagesのサブディレクトリ名「/ASLA/」を正確に伝えます
  base: '/ASLA/', 
  build: {
    // 部品をまとめるフォルダ名を指定します
    outDir: 'dist',
  }
})
