import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the project site from /<repo>/. Local dev and custom
// domains serve from the root. GITHUB_REPOSITORY is set by GitHub Actions.
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.PAGES_BASE ?? (repo ? `/${repo}/` : '/');

export default defineConfig({
  base,
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
});
