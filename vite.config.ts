import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // 🟢 FIXED: appType belongs at the top level to handle SPA routing
  appType: 'spa', 

  server: {
    host: true,
    port: 5173,
    // 🟢 FIXED: historyApiFallback is removed as appType handles it
  },

  preview: {
    allowedHosts: ['cers-4.onrender.com']
  }
});