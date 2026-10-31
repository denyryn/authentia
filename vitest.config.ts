import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    // Node for the pure modules; page tests opt into jsdom per file.
    environment: 'node'
  },
  resolve: {
    alias: {'@': new URL('./src', import.meta.url).pathname}
  }
})
