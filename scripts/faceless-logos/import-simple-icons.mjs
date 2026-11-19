/**
 * Importe un sous-ensemble de la bibliotheque de logos Simple Icons (CC0) dans le depot :
 *  - resources/faceless/logos/<slug>.svg (le dessin)
 *  - server/data/facelessLogos.js (le catalogue : slug, nom, couleur, alias)
 *
 * Usage (une seule fois, ou pour ajouter des marques) :
 *   npm pack simple-icons            (dans un dossier vide hors du depot)
 *   tar -xzf simple-icons-*.tgz
 *   node scripts/faceless-logos/import-simple-icons.mjs <dossier>/package
 *
 * Simple Icons a retire certaines marques a la demande de leurs proprietaires (OpenAI, Slack,
 * LinkedIn, Microsoft, Adobe, AWS, Canva...) : elles s importent a la main dans le dossier de la persona.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Indique le dossier du paquet simple-icons decompresse');

// Marques retenues (tech, outils, reseaux, IA). Ajouter un slug ici puis relancer le script.
const SLUGS = `anthropic claude googlegemini googlecloud meta mistralai perplexity huggingface ollama langchain githubcopilot cursor vercel windsurf
github gitlab bitbucket git vscodium jetbrains intellijidea pycharm webstorm xcode androidstudio docker kubernetes terraform ansible
nodedotjs npm pnpm yarn bun deno python typescript javascript react vuedotjs nuxt nextdotjs svelte angular astro vite webpack tailwindcss bootstrap
postgresql mysql mongodb redis sqlite supabase firebase neon prisma planetscale
stripe paypal shopify woocommerce wordpress webflow wix squarespace ghost
notion obsidian linear jira confluence trello asana clickup airtable discord telegram whatsapp signal zoom googlemeet
figma davinciresolve blender unity unrealengine
instagram tiktok youtube x facebook pinterest reddit twitch snapchat threads bluesky mastodon medium substack
google googlechrome firefox safari opera brave arc apple android ios linux ubuntu macos
cloudflare netlify digitalocean render railway sentry datadog grafana posthog plausibleanalytics googleanalytics mixpanel hotjar
zapier make n8n ifttt brevo mailchimp resend hubspot intercom zendesk
elevenlabs replicate suno spotify netflix uber airbnb tesla spacex nvidia intel amd samsung sony
wise revolut binance coinbase bitcoin ethereum gumroad patreon kofi buymeacoffee zotero grammarly deepl duolingo`.split(/\s+/).filter(Boolean);

// Noms courants sous lesquels on dit la marque a voix haute.
const ALIASES = {
  x: ['Twitter'], googlegemini: ['Gemini'], githubcopilot: ['Copilot'], vuedotjs: ['Vue'], nextdotjs: ['Next'],
  nodedotjs: ['Node'], googlechrome: ['Chrome'], googleanalytics: ['Analytics'], huggingface: ['Hugging Face'],
  mistralai: ['Mistral'], tailwindcss: ['Tailwind'], postgresql: ['Postgres'], unrealengine: ['Unreal'],
  davinciresolve: ['DaVinci'], intellijidea: ['IntelliJ'], visualstudiocode: ['VS Code'], amazonwebservices: ['AWS'],
};

const require = createRequire(join(pkg, 'package.json'));
const all = require(pkg);
const bySlug = new Map(Object.values(all).filter((icon) => icon?.slug).map((icon) => [icon.slug, icon]));

mkdirSync(join(root, 'resources/faceless/logos'), { recursive: true });
const rows = [];
const missing = [];
for (const slug of SLUGS) {
  const icon = bySlug.get(slug);
  if (!icon) { missing.push(slug); continue; }
  copyFileSync(join(pkg, 'icons', `${slug}.svg`), join(root, 'resources/faceless/logos', `${slug}.svg`));
  rows.push([slug, icon.title, `#${icon.hex}`, ...(ALIASES[slug] ? [ALIASES[slug]] : [])]);
}

const header = `/**
 * Catalogue de la bibliotheque de logos (Simple Icons, licence CC0), GENERE par
 * scripts/faceless-logos/import-simple-icons.mjs : ne pas modifier a la main.
 * [slug, nom, couleur de la marque, alias]. Les dessins sont dans resources/faceless/logos/<slug>.svg.
 * Les marques sont des marques deposees de leurs proprietaires : usage pour CITER la marque.
 */
`;
const NL = String.fromCharCode(10);
const lines = rows.map((row) => `  ${JSON.stringify(row)}`).join(`,${NL}`);
writeFileSync(join(root, 'server/data/facelessLogos.js'), `${header}export const FACELESS_LOGOS = [${NL}${lines},${NL}];${NL}`);
console.log(`${rows.length} logos importes. Introuvables : ${missing.join(', ') || 'aucun'}`);
