import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Vite config for building the standalone battle-bets game
// This builds from src/battle-bets/ and outputs to public/battle-bets-game/
export default defineConfig({
  plugins: [react()],
  
  // Set the root to the battle-bets source directory
  root: path.resolve(__dirname, 'src/battle-bets'),
  
  // Output to public/battle-bets-game/
  build: {
    outDir: path.resolve(__dirname, 'public/battle-bets-game'),
    emptyOutDir: true, // Clear the directory before building
    
    rollupOptions: {
      input: path.resolve(__dirname, 'src/battle-bets/index.html'),
    },
  },
  
  // Resolve aliases to match the battle-bets project structure
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/battle-bets'),
    },
  },
  
  // Base path for assets
  base: '/battle-bets-game/',
  
  // Server config for development
  server: {
    port: 5174, // Different port from main Next.js app
    proxy: {
      // Proxy API calls to the Next.js dev server
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});

