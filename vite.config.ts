import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub PagesのURL（/ASLA/）に合わせるための設定です
  base: '/ASLA/', 
})
