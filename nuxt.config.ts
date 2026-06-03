export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  pages: true,
  devServer: {
    host: 'localhost',
    port: Number(process.env.PORT || 3000)
  },
  runtimeConfig: {
    geminiApiKey: process.env.GEMINI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY
  }
})