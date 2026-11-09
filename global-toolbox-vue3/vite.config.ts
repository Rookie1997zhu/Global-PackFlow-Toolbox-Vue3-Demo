/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const base = process.env.VITE_BASE || '/'

export default defineConfig({
  plugins: [vue()],
  base,
  test: {
    environment: 'node',
    include: ['src/tests/**/*.spec.ts'],
  },
})
