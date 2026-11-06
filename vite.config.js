import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Warn when a chunk exceeds 500 kB (Vite default is 500 kB; explicit for clarity)
    chunkSizeWarningLimit: 500,
    // Minify CSS (esbuild is the default and handles this automatically in Vite 5+)
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-slot',
          ],
          'vendor-motion': ['framer-motion'],
          'vendor-query': ['@tanstack/react-query'],
          // Split Clerk auth into its own chunk — large library, only needed on auth routes
          'vendor-clerk': ['@clerk/clerk-react', '@clerk/localizations'],
          // PDF generation is large and only used in BookWizard/BookView
          'vendor-pdf': ['jspdf', 'html2canvas'],
          // Sanity blog is only needed on blog routes
          'vendor-sanity': ['@sanity/client', '@sanity/image-url'],
        }
      }
    }
  }
});
