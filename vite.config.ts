import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({ command }) => {
  // Repository name for GitHub Pages deployment (https://<username>.github.io/<repo>/)
  const repoName = 'MobilBalapGemoy';
  const repoPath = process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
    : `/${repoName}/`;

  // During local development ('serve'), use '/' root path.
  // In production builds, use repository path to guarantee correct asset resolution on GitHub Pages.
  const base = process.env.VITE_BASE_PATH || process.env.BASE_URL || (
    command === 'serve' ? '/' : repoPath
  );

  return {
    base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
