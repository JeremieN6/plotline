export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  pages: true,
  vite: {
    server: {
      host: 'localhost',
      port: Number(process.env.PORT || 3000)
    }
  }
})