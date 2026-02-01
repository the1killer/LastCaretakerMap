import { defineConfig } from 'vite'

const insertVersion = () => ({
  name: 'insert-version',
  transformIndexHtml: {
    order: 'pre',
    handler (html) {
      return html.replace('%VERSION%',
        process.env.npm_package_version || 'dev'
      )
    }
  }
})

export default defineConfig({
  plugins: [insertVersion()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
