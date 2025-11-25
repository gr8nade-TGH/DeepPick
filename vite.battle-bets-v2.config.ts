import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Vite config for building the V2 tabbed interface test page
// This builds from src/battle-bets/ and outputs to public/battle-arena-v2/
export default defineConfig({
  plugins: [react()],

  // Set the root to the battle-bets source directory
  root: path.resolve(__dirname, 'src/battle-bets'),

  // Output to public/battle-arena-v2/
  build: {
    outDir: path.resolve(__dirname, 'public/battle-arena-v2'),
    emptyOutDir: true, // Clear the directory before building

    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/battle-bets/index-v2.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },

  // Resolve aliases to match the battle-bets project structure
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/battle-bets'),
    },
  },

  // Base path for assets
  base: '/battle-arena-v2/',

  // Server config for development
  server: {
    port: 5175, // Different port from main battle game (5174)
    proxy: {
      // Proxy API calls to the Next.js dev server
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});

