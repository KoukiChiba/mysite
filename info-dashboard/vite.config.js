import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_BASE_PATH をセットすることで GitHub Pages のサブディレクトリに対応
// 例: VITE_BASE_PATH=/info-dashboard/
const base = process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    // ローカル開発時: /sheets-proxy/* → https://docs.google.com/spreadsheets/*
    // これにより CORS を回避してシートデータを直接取得できる
    proxy: {
      '/sheets-proxy': {
        target: 'https://docs.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sheets-proxy/, '/spreadsheets'),
      },
    },
  },
})
