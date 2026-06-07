import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const cwd = process.cwd();
// Prioritize .env.local for developer overrides
loadEnvFile(path.resolve(cwd, '.env'));
loadEnvFile(path.resolve(cwd, '.env.local'));

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  pages: true,
  devServer: {
    host: 'localhost',
    port: Number(process.env.PORT || 3000)
  },
  runtimeConfig: {
    geminiApiKey: process.env.GEMINI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    klingApiKey: process.env.KLINGAI_ACCESS_KEY || process.env.KLING_API_KEY,
    klingApiSecret: process.env.KLINGAI_SECRET_KEY || process.env.KLING_API_SECRET,
    klingModel: process.env.KLINGAI_MODEL || process.env.KLING_MODEL,
    redisUrl: process.env.REDIS_URL,
    baseUrl: process.env.BASE_URL,
  }
})