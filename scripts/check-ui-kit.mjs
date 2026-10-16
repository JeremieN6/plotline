#!/usr/bin/env node
/**
 * Controle du kit UI (docs/ui-kit/UI.md) sur les fichiers .vue modifies.
 *
 * Lance par le hook Stop de .claude/settings.json : si une page ou un composant
 * touche contient des couleurs en dur ou des couleurs Tailwind par defaut a la
 * place des tokens `ui-`, le tour n est pas termine (exit 2) et le message est
 * renvoye a Claude, qui doit corriger.
 *
 * Perimetre (le kit s applique "au fil de l eau", on ne migre pas ce qu on ne touche pas) :
 *  - fichier NOUVEAU : toutes ses lignes ;
 *  - fichier MODIFIE : seulement les lignes ajoutees ou modifiees (git diff HEAD) ;
 *  - `UI_KIT_STRICT=1` : toutes les lignes de tous les fichiers touches (migration complete d une page).
 * Echappatoire explicite et visible : le mot `ui-kit-ignore` sur la ligne (a reserver
 * aux cas ou le kit n a pas d equivalent, par exemple un champ fichier natif).
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const STRICT = process.env.UI_KIT_STRICT === '1';
const IGNORE_MARK = 'ui-kit-ignore';
const KIT_DIR = 'app/components/ui/';

const PALETTE = '(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)';
const RULES = [
  {
    name: 'couleur en dur',
    hint: 'utilise un token (bg-ui-accent, text-ui-ink, border-ui-line…)',
    test: /\[#[0-9a-fA-F]{3,8}\]|style=["'][^"']*#[0-9a-fA-F]{3,8}\b|:style=["'][^"']*#[0-9a-fA-F]{3,8}\b|\[[^\]\s]*rgba?\([^\]]*\]/,
  },
  {
    name: 'couleur Tailwind par défaut',
    hint: 'remplace par le token ui- équivalent (text-ui-ink-2, bg-ui-subtle, border-ui-line, text-ui-danger-ink…)',
    test: new RegExp(`\\b(?:text|bg|border|ring|from|to|via|divide|placeholder|fill|stroke|accent|outline|decoration)-${PALETTE}-\\d{2,3}(?:/\\d+)?\\b`),
  },
];

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return '';
  }
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

// Evite toute boucle : si le hook a deja bloque ce tour, on laisse finir.
try {
  const input = JSON.parse(readStdin() || '{}');
  if (input?.stop_hook_active) process.exit(0);
} catch {
  // pas de JSON sur stdin (lancement a la main) : on continue
}

const isVue = (file) => file.startsWith('app/') && file.endsWith('.vue') && !file.startsWith(KIT_DIR);
const tracked = git(['diff', '--name-only', 'HEAD']).split('\n').map((s) => s.trim()).filter(Boolean);
const untracked = git(['ls-files', '--others', '--exclude-standard']).split('\n').map((s) => s.trim()).filter(Boolean);
const files = [...new Set([...tracked, ...untracked])].filter(isVue).filter((file) => fs.existsSync(file));
const untrackedSet = new Set(untracked);

/** Numeros des lignes ajoutees ou modifiees d un fichier suivi (git diff -U0). */
function addedLines(file) {
  const lines = new Set();
  const diff = git(['diff', '-U0', 'HEAD', '--', file]);
  for (const match of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    for (let i = 0; i < count; i += 1) lines.add(start + i);
  }
  return lines;
}

const problems = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const scope = STRICT || untrackedSet.has(file) ? null : addedLines(file);
  content.forEach((line, index) => {
    if (scope && !scope.has(index + 1)) return;
    if (line.includes(IGNORE_MARK)) return;
    for (const rule of RULES) {
      if (rule.test.test(line)) {
        problems.push({ file, line: index + 1, rule, excerpt: line.trim().slice(0, 140) });
        break;
      }
    }
  });
}

if (!problems.length) process.exit(0);

const out = [
  `Kit UI (docs/ui-kit/UI.md) : ${problems.length} ligne(s) non conforme(s) dans ${new Set(problems.map((p) => p.file)).size} fichier(s) touché(s).`,
  'Corrige-les avant de terminer : composants Ui* et tokens ui-, jamais de couleur en dur.',
  '',
];
for (const problem of problems.slice(0, 40)) {
  out.push(`- ${problem.file}:${problem.line} [${problem.rule.name}] ${problem.rule.hint}`);
  out.push(`    ${problem.excerpt}`);
}
if (problems.length > 40) out.push(`… et ${problems.length - 40} autre(s).`);
out.push('');
out.push(`Seul cas d'exception : le kit n'a pas d'équivalent (ex. champ fichier natif) → ajoute le mot « ${IGNORE_MARK} » sur la ligne, et dis-le à l'utilisateur.`);
console.error(out.join('\n'));
process.exit(2);
