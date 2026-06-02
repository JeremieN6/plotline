import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { Anthropic } from '@anthropic-ai/sdk';

import { buildGenerationPrompt } from '../../utils/buildGenerationPrompt.js';
import { injectBody } from '../../utils/injectBody.js';
import {
  PROMPT_CAPTION_CONTEXTUALIZED,
  PROMPT_JSON_TO_IMAGE,
} from '../../utils/promptTemplates.js';

let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

function mimeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

function extFromMime(mimeType) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'jpg';
}

function resolvePublicPath(filePathOrPublicUrl) {
  if (!filePathOrPublicUrl) return null;
  if (filePathOrPublicUrl.startsWith('/')) {
    return path.join(process.cwd(), 'public', filePathOrPublicUrl.replace(/^\/+/, ''));
  }
  return path.resolve(process.cwd(), filePathOrPublicUrl);
}

function formatSceneDescription(concept) {
  return [
    concept.location && `Location: ${concept.location}`,
    concept.outfit && `Outfit: ${concept.outfit}`,
    concept.pose && `Pose: ${concept.pose}`,
    concept.mood && `Mood: ${concept.mood}`,
    concept.lighting && `Lighting: ${concept.lighting}`,
  ]
    .filter(Boolean)
    .join(' | ');
}

export default defineEventHandler(async (event) => {
  try {
    const prisma = await getPrisma();
    const body = await readBody(event);
    const { influencerId, location, outfit, pose, mood, lighting } = body || {};

    if (!influencerId || !location || !outfit || !pose || !mood || !lighting) {
      return sendError(
        event,
        createError({
          statusCode: 400,
          statusMessage: 'Missing required fields: influencerId, location, outfit, pose, mood, lighting',
        }),
      );
    }

    const influencer = await prisma.influencer.findUnique({
      where: { id: influencerId },
      select: {
        id: true,
        name: true,
        faceRefPath: true,
      },
    });

    if (!influencer) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Influencer not found' }));
    }

    if (!influencer.faceRefPath) {
      return sendError(
        event,
        createError({
          statusCode: 400,
          statusMessage: 'Influencer face reference is missing. Upload a face ref first.',
        }),
      );
    }

    const faceRefAbsolutePath = resolvePublicPath(influencer.faceRefPath);
    const faceRefBuffer = await fs.readFile(faceRefAbsolutePath);
    const faceRefMime = mimeFromExt(faceRefAbsolutePath);
    const faceRefBase64 = faceRefBuffer.toString('base64');

    const concept = { location, outfit, pose, mood, lighting };
    const sceneJsonText = buildGenerationPrompt(concept, 'feed', '4:5');
    const sceneJson = injectBody(JSON.parse(sceneJsonText));

    const prompt = PROMPT_JSON_TO_IMAGE.replace('{scene_json}', JSON.stringify(sceneJson, null, 2));

    if (!process.env.GEMINI_API_KEY) {
      return sendError(event, createError({ statusCode: 500, statusMessage: 'Missing GEMINI_API_KEY' }));
    }

    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const imageResponse = await genai.models.generateContent({
      model: 'gemini-2.0-flash-preview-image-generation',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: faceRefMime,
                data: faceRefBase64,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    });

    const parts = imageResponse?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part) => part?.inlineData?.data);
    if (!imagePart) {
      return sendError(
        event,
        createError({ statusCode: 502, statusMessage: 'Gemini did not return an image payload' }),
      );
    }

    const generatedDir = path.join(process.cwd(), 'public', 'uploads', 'generated');
    await fs.mkdir(generatedDir, { recursive: true });

    const imageMime = imagePart.inlineData.mimeType || 'image/jpeg';
    const extension = extFromMime(imageMime);
    const filename = `generated_${Date.now()}.${extension}`;
    const generatedPath = path.join(generatedDir, filename);

    await fs.writeFile(generatedPath, Buffer.from(imagePart.inlineData.data, 'base64'));

    const imageUrl = `/uploads/generated/${filename}`;

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY || process.env.anthropicApiKey;
    let caption = '';

    if (anthropicApiKey) {
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      const captionPrompt = PROMPT_CAPTION_CONTEXTUALIZED.replace('{influencer_name}', influencer.name)
        .replace('{content_type}', 'feed')
        .replace('{scene_description}', formatSceneDescription(concept));

      const captionResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: captionPrompt }],
      });

      const textPart = captionResponse.content?.find((part) => part.type === 'text');
      caption = (textPart?.text || '').trim();
    }

    const generatedContent = await prisma.generatedContent.create({
      data: {
        influencerId: influencer.id,
        imageUrl,
        caption,
        platform: 'INSTAGRAM',
        format: 'FEED',
      },
    });

    return {
      id: generatedContent.id,
      influencerId: influencer.id,
      imageUrl,
      caption,
      scene: sceneJson,
    };
  } catch (err) {
    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Image generation failed',
        data: err,
      }),
    );
  }
});
