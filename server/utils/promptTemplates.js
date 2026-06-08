export const PROMPT_JSON_TO_IMAGE = `Generate a professional photo-realistic image featuring the character described below.

CRITICAL - CHARACTER IDENTITY (attached 3-view reference sheet is the ONLY source of truth):
Facial features, skin tone and identity MUST come from the attached reference image.
Hair MUST follow Scene JSON subject.hair exactly.
If subject.hair.custom_instruction exists, prioritize it.
Do not lengthen, shorten, restyle or reinterpret the hair beyond the reference or Scene JSON.
Do NOT invent a new face and do NOT apply traits from another influencer profile.
[CHARACTER REFERENCE IMAGE ATTACHED]

CRITICAL - BODY:
Follow the body instructions from Scene JSON subject.body.
If subject.body.custom_instruction exists, prioritize it.
Otherwise apply the fallback physique exactly.

CRITICAL - HAIR:
Follow the hair instructions from Scene JSON subject.hair.
If subject.hair.custom_instruction exists, prioritize it.
Otherwise apply the fallback hair exactly.

Respect all compositional, lighting, environmental and clothing details from the Scene JSON below.

Scene JSON:
{scene_json}
`;

export const PROMPT_IMAGE_TO_JSON = `You are an advanced Computer Vision & Data Serialization Engine.
Analyze the image. Capture 100% of visual data: SCENE, ENVIRONMENT, POSE, OBJECTS, COMPOSITION.
Do NOT describe facial features — they come from the character reference sheet.
Return ONLY a valid JSON object, no markdown fencing:

{
  "meta": { "image_quality": "", "image_type": "", "aspect_ratio": "" },
  "character_reference": {
    "instruction": "Use attached reference sheet as ground truth for facial features."
  },
  "global_context": {
    "scene_description": "", "time_of_day": "", "weather_atmosphere": "",
    "lighting": { "source": "", "direction": "", "quality": "", "color_temp": "" }
  },
  "color_palette": { "dominant_hex_estimates": [], "accent_colors": [], "contrast_level": "" },
  "composition": { "camera_angle": "", "framing": "", "depth_of_field": "", "focal_point": "" },
  "subject": {
    "pose": { "body_position": "", "gesture": "", "head_angle": "", "body_angle": "", "expression_mood": "" },
    "clothing": { "outfit_description": "", "style": "", "colors": [], "fabric_details": [], "accessories": [] },
    "position_in_frame": "", "prominence": ""
  },
  "objects": [],
  "text_ocr": { "present": false, "content": [] },
  "semantic_relationships": []
}

CRITICAL: No physical appearance in subject section (no hair/eyes/skin/age).
CRITICAL: outfit_description and style MUST NOT mention body proportions, figure type, bust size, waist size, body shape, or how clothes fit on the body. Only describe garment type, color, fabric, and style.
aspect_ratio must be one of: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9.`;

// Kept as a dedicated export for compatibility with older naming used in Python flows.
export const PROMPT_JSON_TO_PRO_IMAGE = PROMPT_JSON_TO_IMAGE;

export const PROMPT_PERSON_DETECTION = `Does this image contain a human person who is:
- Clearly visible (not a silhouette, not from very far away)
- Facing the camera, in 3/4 front view, or at most in profile
- With the face at least partially visible

Answer only with YES or NO. No explanation.`;

export const PROMPT_UPPER_BODY_DETECTION = `Does this image show a person whose COMPLETE UPPER BODY is clearly visible?

Requirements:
- Both shoulders must be visible
- The torso (chest and abdomen area) must be visible, not cropped
- The person must be visible from at least waist height upward
- The upper body must not be cropped at the neck or chest level
- A close-up of only the face or head does not count

Answer only with YES or NO. No explanation.`;

export const PROMPT_FACE_VISIBILITY_DETECTION = `Does this image show at least one person with a clearly visible face?

Rules:
- The face must be clearly visible (not hidden, not blurred, not too far).
- Back view only does NOT count.
- Heavy occlusion (hand, hair, object, mask) does NOT count.
- Tiny faces in the distant background do NOT count.

Answer only with YES or NO. No explanation.`;

export const PROMPT_BODY_PROPORTIONS_DETECTION = 'Does this woman have an hourglass figure with full bust and narrow waist? YES or NO';

export const SCENE_JSON_TEMPLATE = {
  subject: {
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

export const COMMON_BODY_TEMPLATE = {
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
};

export const INFLUENCER_IDENTITY_PROFILES = {
  madison: {
    aliases: ['madison'],
    description: 'A young blonde woman named Madison, californian aesthetic, mid-20s.',
    face: {
      face_shape: 'Oval with angular jawline and defined chin.',
      cheekbones: 'High, prominent cheekbones.',
      eyes: 'Large, wide-set blue-green/grey eyes with visible irises.',
      nose: 'Straight, delicate, slightly upturned nose.',
      lips: "Full natural lips, light pink, soft cupid's bow.",
      brows: 'Well-defined, slightly darker than hair, gently arched.',
      hair: 'Light warm blonde, straight, shoulder-length, side-parted.',
      skin: 'Fair warm-beige tone, natural texture, visible pores, no freckles.',
      expression: 'Natural, confident, relaxed.',
      instruction: 'MUST match attached 3-view reference sheet exactly.',
    },
  },
};

export const MADISON_JSON_TEMPLATE = {
  ...SCENE_JSON_TEMPLATE,
  subject: {
    ...SCENE_JSON_TEMPLATE.subject,
    description: INFLUENCER_IDENTITY_PROFILES.madison.description,
    body: COMMON_BODY_TEMPLATE,
    face: INFLUENCER_IDENTITY_PROFILES.madison.face,
  },
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
