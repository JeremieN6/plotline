export const PROMPT_JSON_TO_IMAGE = `Generate a professional photo-realistic image featuring the character described below.

CRITICAL - CHARACTER IDENTITY (attached 3-view reference sheet is the ONLY source of truth):
The face MUST be a 1:1 match with the attached reference sheet. Key identifying features:
- Oval face with angular jawline and defined chin
- High prominent cheekbones
- Large wide-set blue-green/grey eyes
- Straight delicate slightly upturned nose
- Full natural lips, light pink
- Well-defined brows, slightly darker than hair, gently arched
- Light warm blonde straight hair, shoulder-length, side-parted
- Fair warm-beige skin, natural texture visible
Do NOT invent a new face. This is ALWAYS the same person - match the reference sheet exactly.
[CHARACTER REFERENCE IMAGE ATTACHED]

CRITICAL - body proportions to reproduce exactly:
- Very large, full bust with visible cleavage, stretching the top garment
- Narrow defined waist, pronounced hourglass silhouette
- Wide hips and rounded glutes
These body proportions are NON-NEGOTIABLE and must be clearly visible in the final image.

Respect all compositional, lighting, environmental and clothing details from the Scene JSON below.

Scene JSON:
{scene_json}
`;

export const PROMPT_IMAGE_TO_JSON = `Analyze the attached Pinterest image and return ONLY valid JSON.

Output requirements:
- Return raw JSON only (no markdown, no comments).
- Keep it concise but specific.
- Use this exact schema:
{
  "subject": {
    "wardrobe": {
      "top": "string",
      "bottom": "string",
      "accessories": "string"
    },
    "pose": "string"
  },
  "scene": {
    "location": "string",
    "background": "string",
    "lighting": {
      "type": "string",
      "quality": "string",
      "shadows": "string"
    }
  },
  "camera": {
    "type": "string",
    "lens": "string",
    "angle": "string",
    "composition": "string",
    "style": "string"
  },
  "mood": "string"
}

If a detail is unclear, infer a plausible value from the image and keep it realistic.`;

// Kept as a dedicated export for compatibility with older naming used in Python flows.
export const PROMPT_JSON_TO_PRO_IMAGE = PROMPT_JSON_TO_IMAGE;

export const MADISON_JSON_TEMPLATE = {
  subject: {
    description: 'A young blonde woman named Madison, californian aesthetic, mid-20s.',
    body: {
      physique:
        'Voluptuous hourglass figure with significantly enlarged breasts that fill the {top_garment}. Narrow defined waist leading to wider hips and prominent glutes. Muscle tone visible in core and legs.',
      anatomy: {
        shoulders: 'Defined, proportional.',
        waist: 'Narrow, defined waist.',
        hips: 'Wide hips with prominent glutes.',
        breasts: 'Extremely large, very full breasts causing cleavage and stretching the {top_garment}.',
        waist_to_hip_ratio: 'Pronounced hourglass.',
      },
      skin: {
        tone: 'Warm light beige, natural sun-kissed California glow.',
        texture: 'Visible pores, natural skin texture, not airbrushed, raw photo.',
        details: 'No tattoos.',
      },
    },
    face: {
      face_shape: 'Oval with angular jawline and defined chin.',
      cheekbones: 'High, prominent cheekbones.',
      eyes: 'Large, wide-set blue-green/grey eyes with visible irises.',
      nose: 'Straight, delicate, slightly upturned nose.',
      lips: "Full natural lips, light pink, soft cupid's bow.",
      brows: 'Well-defined, slightly darker than hair, gently arched.',
      hair: 'Light warm blonde, straight, {hair_style}.',
      skin: 'Fair warm-beige tone, natural texture, visible pores, no freckles.',
      expression: 'Natural, confident, {expression}.',
      instruction: 'MUST match attached 3-view reference sheet exactly.',
    },
    wardrobe: {
      top: '{top_description}',
      bottom: '{bottom_description}',
      accessories: '{accessories}',
    },
    pose: '{pose_description}',
  },
  scene: {
    location: '{location}',
    background: '{background_description}',
    lighting: {
      type: '{lighting_type}',
      quality: '{lighting_quality}',
      shadows: '{shadow_description}',
    },
  },
  camera: {
    type: '{camera_type}',
    lens: '{lens_type}',
    angle: '{camera_angle}',
    focus: 'Sharp focus on the subject.',
    composition: '{aspect_ratio} aspect ratio.',
    style: 'Realistic, candid photo style, raw photography, no filters.',
  },
  negative_constraints: [
    'no tattoos',
    'no extra limbs',
    'no distorted fingers',
    'no fused skin textures',
    'no beautify smoothing',
    'no airbrushed artificial skin',
    'no watermarks',
    'no text overlays',
    'no CGI look',
    'no plastic skin',
  ],
};

export const PROMPT_CAPTION_CONTEXTUALIZED = `You are {influencer_name}'s creative caption writer.

Generate a short, engaging Instagram caption in English (2-4 lines max).
- Natural and authentic first-person voice
- Flirty/playful tone when appropriate (never vulgar)
- Creates curiosity and encourages comments
- NO hashtags in the text body
- NEVER repeat the same structure twice

Content type: {content_type}
Scene description:
{scene_description}

Tone guidance based on content type:
- feed: elegant lifestyle, aspirational but relatable
- story: casual, spontaneous, behind-the-scenes feel
- reel: dynamic energy, playful, hook-driven

Return ONLY the caption text, no quotes, no explanation.`;

export const HASHTAG_BLOCK_LIFESTYLE =
  '#lifestyle #dailyvibes #selfcare #softlife #routine #citylife #cozystyle #aesthetic #mood #dailylife';

export const HASHTAG_BLOCK_BEACH =
  '#beachvibes #sunsetlover #oceanbreeze #summermood #saltlife #goldenhour #coastalliving #seaside #vacationmode #beachday';

export const HASHTAG_BLOCK_OUTFIT =
  '#outfitinspo #ootd #streetstyle #fashionmood #styleinspo #lookbook #minimalstyle #wardrobe #fashiondaily #styleedit';

export const HASHTAG_BLOCKS = {
  lifestyle: HASHTAG_BLOCK_LIFESTYLE,
  beach: HASHTAG_BLOCK_BEACH,
  outfit: HASHTAG_BLOCK_OUTFIT,
};
