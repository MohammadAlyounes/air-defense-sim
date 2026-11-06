/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages serves the app from /<repo-name>/, so CI sets BASE_PATH.
// Locally (npm run dev / preview) the app is served from the root.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          // The 3D view loads after the console. Its libraries go in their own chunk, which
          // stays cached between deploys because it rarely changes.
          groups: [
            {
              name: 'three',
              test: /node_modules[\\/](three|three-stdlib|@react-three|camera-controls|troika-[\w-]+)[\\/]/,
              // Only these packages: React and other shared code stay with the console.
              includeDependenciesRecursively: false,
            },
          ],
        },
      },
    },
    // three.js alone is about 700 kB minified; it is loaded on demand, never up front.
    chunkSizeWarningLimit: 1100,
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
