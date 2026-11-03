import test from 'node:test';
import assert from 'node:assert/strict';

import {
  askFacelessAdvice, buildAdviceSystemPrompt, buildAdviceUserMessage, normalizeAdviceHistory, summarizePlanForAdvice,
} from '../server/utils/facelessAdvice.js';

const plan = {
  title: 'Cold-mail',
  scenes: [
    { say: 'Arrête de prospecter au hasard.', layout: 'hook', text: 'Stop au **hasard**' },
    { say: '', layout: 'list', items: [{ text: 'SPF' }, { text: 'DKIM' }] },
  ],
};

test('avis : le plan est resume scene par scene, meme incomplet', () => {
  const text = summarizePlanForAdvice(plan);
  assert.match(text, /Scène 1 \[hook\] ; dit : « Arrête de prospecter au hasard\. »/);
  assert.match(text, /Scène 2 \[list\] ; dit : \(vide\) ; éléments : SPF \/ DKIM/);
  assert.equal(summarizePlanForAdvice(null), '');
});

test('avis : historique borne et nettoye', () => {
  const history = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
  const out = normalizeAdviceHistory([...history, { role: 'system', content: 'x' }, { role: 'user', content: '  ' }, null]);
  assert.equal(out.length, 8);
  assert.equal(out.at(-1).content, 'm11');
  assert.deepEqual(normalizeAdviceHistory('nope'), []);
});

test('avis : le message contient brief, texte source, plan et question ; sans plan il le dit', () => {
  const withPlan = buildAdviceUserMessage({ question: 'Est-ce bon ?', idea: 'Cold-mail', sourceText: 'Article...', plan });
  assert.match(withPlan, /BRIEF DU CREATEUR/);
  assert.match(withPlan, /TEXTE SOURCE/);
  assert.match(withPlan, /PLAN ACTUEL/);
  assert.match(withPlan, /QUESTION :\nEst-ce bon \?/);
  const without = buildAdviceUserMessage({ question: 'Comment faire ?', idea: 'Cold-mail' });
  assert.match(without, /Pas de plan pour l instant/);
});

test('avis : le prompt systeme interdit de modifier le plan et demande de la franchise', () => {
  const system = buildAdviceSystemPrompt({ targetSeconds: 45 });
  assert.match(system, /ne modifies RIEN/);
  assert.match(system, /dis-le et dis pourquoi/);
  assert.match(system, /Ne renvoie jamais de JSON/);
  assert.match(system, /45 s/);
});

test('avis : appel Claude avec historique puis question ; reponse en texte', async () => {
  let request;
  const answer = await askFacelessAdvice({
    question: 'Et la fin ?',
    history: [{ role: 'user', content: 'Premier avis ?' }, { role: 'assistant', content: 'Garde l accroche.' }],
    idea: 'Cold-mail',
    plan,
    createMessage: async (req) => { request = req; return { content: [{ type: 'text', text: 'La fin est correcte.' }] }; },
  });
  assert.equal(answer, 'La fin est correcte.');
  assert.deepEqual(request.messages.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.match(request.messages.at(-1).content, /Et la fin \?/);
  await assert.rejects(() => askFacelessAdvice({ question: ' ', createMessage: async () => ({}) }));
  await assert.rejects(() => askFacelessAdvice({ question: 'x', createMessage: async () => ({ content: [] }) }), /vide/);
});
