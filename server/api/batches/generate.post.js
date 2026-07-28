// server/api/batches/generate.post.js
const { buildPersonaPrompt } = require('../../utils/buildPersonaPrompt');
const { parseBatchResponse } = require('../../utils/parseBatchResponse');
const { mergeNarrativeMemory } = require('../../utils/mergeNarrativeMemory');
const { prisma } = require('../../utils/prisma');
const { Anthropic } = require('@anthropic-ai/sdk');

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';

function getAnthropicModel() {
  return String(process.env.ANTHROPIC_MODEL || process.env.anthropicModel || DEFAULT_ANTHROPIC_MODEL).trim();
}

module.exports = defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { personaId, batchOptions } = body || {};
    if (!personaId || !batchOptions) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Missing personaId or batchOptions' }));
    }

    // Récupérer le persona
    const persona = await prisma.persona.findUnique({ where: { id: personaId } });
    if (!persona) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Persona not found' }));
    }

    // Construire le prompt
    const prompt = buildPersonaPrompt(persona, batchOptions);

    // Appeler Claude
    const config = useRuntimeConfig();
    const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    let claudeResponse;
    try {
      claudeResponse = await anthropic.messages.create({
        model: getAnthropicModel(),
        max_tokens: 4096,
        system: prompt,
        messages: [
          { role: 'user', content: 'Génère le batch maintenant.' }
        ]
      });
    } catch (err) {
      return sendError(event, createError({ statusCode: 502, statusMessage: 'Erreur appel Claude', data: err }));
    }

    // Parser la réponse Claude
    let parsed;
    try {
      parsed = parseBatchResponse(claudeResponse.content[0].text);
    } catch (err) {
      return sendError(event, createError({ statusCode: 502, statusMessage: 'Erreur parsing Claude', data: err }));
    }

    // Fusion mémoire narrative
    const updatedMemory = mergeNarrativeMemory(persona.narrativeMemory, parsed.memoryUpdate, batchOptions.volume);

    // Transaction : créer Batch + Posts, MAJ mémoire
    let batch;
    try {
      batch = await prisma.$transaction(async (tx) => {
        const newBatch = await tx.batch.create({
          data: {
            personaId,
            arcType: batchOptions.arcType,
            arcDescription: parsed.arcDescription,
            posts: {
              create: parsed.posts.map((post, idx) => ({
                arcPosition: batchOptions.startPosition + idx,
                pillar: post.pillar,
                arcTypeLocal: post.arcTypeLocal,
                format: post.format,
                body: post.body
              }))
            }
          },
          include: { posts: true }
        });
        await tx.persona.update({
          where: { id: personaId },
          data: { narrativeMemory: updatedMemory }
        });
        return newBatch;
      });
    } catch (err) {
      return sendError(event, createError({ statusCode: 502, statusMessage: 'Erreur transaction Prisma', data: err }));
    }

    return parsed;
  } catch (err) {
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Erreur serveur', data: err }));
  }
});
