import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages 같은 하위 경로 배포는 VITE_BASE=/저장소이름/ 으로 지정한다
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
