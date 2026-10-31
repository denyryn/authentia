import react from '@vitejs/plugin-react-swc'
import {defineConfig} from 'vite'

// Dev-only preview of the two real pages with an in-memory environment. Not
// part of the extension build: manifest.json never references this folder.
export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  // Serve src the way the extension serves its root, so `/images/*` resolves.
  publicDir: new URL('../src', import.meta.url).pathname,
  plugins: [react()],
  resolve: {
    alias: {'@': new URL('../src', import.meta.url).pathname}
  },
  server: {port: 4173, strictPort: true}
})
