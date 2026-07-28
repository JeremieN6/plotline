import { Anthropic } from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = 'Tu es un expert en prompts pour la generation d\'images avec Gemini. Tu reformules des descriptions en prompts optimises pour generer des photos Instagram realistes d\'une influenceuse IA. Tu retournes UNIQUEMENT le prompt reformule, sans explication ni commentaire.';
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';

function getAnthropicApiKey() {
  const config = useRuntimeConfig();
  return config?.anthropicApiKey || process.env.ANTHROPIC_API_KEY || process.env.anthropicApiKey || '';
}

function getAnthropicModel() {
  return String(process.env.ANTHROPIC_MODEL || process.env.anthropicModel || DEFAULT_ANTHROPIC_MODEL).trim();
}

function extractTextFromClaudeResponse(response) {
  const textPart = response?.content?.find((part) => part?.type === 'text');
  return String(textPart?.text || '').trim();
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const rawPrompt = String(body?.rawPrompt || '').trim();
    const influencerName = String(body?.influencerName || '').trim();
    const influencerStyle = String(body?.influencerStyle || '').trim();
    const influencerNiche = String(body?.influencerNiche || '').trim();

    if (!rawPrompt) {
      return sendError(
        event,
        createError({
          statusCode: 400,
          statusMessage: 'Missing required field: rawPrompt',
        }),
      );
    }

    const apiKey = getAnthropicApiKey();
    if (!apiKey) {
      return sendError(
        event,
        createError({
          statusCode: 500,
          statusMessage: 'Anthropic API key is not configured',
        }),
      );
    }

    const anthropic = new Anthropic({ apiKey });
    const userPrompt = `Influenceuse : ${influencerName}. Style : ${influencerStyle}. Niche : ${influencerNiche}. Description de l'utilisateur : ${rawPrompt}. Genere un prompt Gemini optimise en anglais pour cette scene.`;

    const response = await anthropic.messages.create({
      model: getAnthropicModel(),
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const optimizedPrompt = extractTextFromClaudeResponse(response);
    if (!optimizedPrompt) {
      return sendError(
        event,
        createError({
          statusCode: 502,
          statusMessage: 'Claude returned an empty optimized prompt',
        }),
      );
    }

    return { optimizedPrompt };
  } catch (err) {
    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: err?.message || 'Prompt optimization failed',
        data: {
          name: err?.name,
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});
