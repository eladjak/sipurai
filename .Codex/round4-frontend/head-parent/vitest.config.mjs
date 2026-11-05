import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({ root, plugins: [react()], test: { environment: 'jsdom', globals: true, include: ['round3.test.jsx'], testTimeout: 10000 } });
