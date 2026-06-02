import { MADISON_JSON_TEMPLATE } from './promptTemplates.js';

export const OUTFIT_MAP = {
  'white crop top + high waist jeans': {
    top_garment: 'white crop top',
    top_description: 'White fitted crop top, stretched tight over her large bust',
    bottom_description: 'High-waist white denim jeans, fitted at the waist',
  },
  'black bikini': {
    top_garment: 'black bikini top',
    top_description: 'Black triangle bikini top, stretched over very large breasts, causing visible cleavage',
    bottom_description: 'Matching black string bikini bottoms',
  },
  'beige linen dress': {
    top_garment: 'beige linen dress',
    top_description: 'Loose beige linen dress, draped over her curves, slightly fitted at the bust',
    bottom_description: 'Same beige linen dress flowing below the hips',
  },
  'oversized grey hoodie': {
    top_garment: 'oversized grey hoodie',
    top_description: 'Oversized grey hoodie worn casually, slightly off one shoulder',
    bottom_description: 'Hoodie covers upper thighs, no visible bottom',
  },
  'satin slip dress nude': {
    top_garment: 'nude satin slip dress',
    top_description: 'Thin nude satin slip dress, clinging to her curves and full bust',
    bottom_description: 'Same satin slip dress flowing past the hips',
  },
  'sport bra + leggings': {
    top_garment: 'sports bra',
    top_description: 'Black sports bra, stretched over full natural bust, minimal coverage',
    bottom_description: 'High-waist black leggings, fitted and form-hugging',
  },
  'blazer only no shirt': {
    top_garment: 'blazer',
    top_description: 'Oversized blazer worn directly on skin with no shirt, slightly open in front',
    bottom_description: 'Blazer barely covers hips, minimal visible bottom',
  },
  'floral summer dress': {
    top_garment: 'floral summer dress',
    top_description: 'Floral print summer dress, fitted at the bust, light flowing fabric',
    bottom_description: 'Same floral dress flowing loosely past the hips',
  },
  'white button-down shirt half open': {
    top_garment: 'white button-down shirt',
    top_description: 'White button-down shirt, half open, slightly off one shoulder, knotted at waist',
    bottom_description: 'Shirt drapes over hips, no visible separate bottom',
  },
  'long cardigan + cycling shorts': {
    top_garment: 'long cardigan',
    top_description: 'Long oversized cardigan, open front, cozy texture',
    bottom_description: 'Black cycling shorts, form-fitting and high-waisted',
  },
};

export const LIGHTING_MAP = {
  'golden hour warm backlight': {
    type: 'Golden hour sunlight from behind the subject',
    quality: 'Warm golden-orange, directional backlight',
    shadows: 'Long soft shadows toward camera, warm rim light glow',
  },
  'soft diffused indoor': {
    type: 'Soft indoor ambient light',
    quality: 'Diffused, even, no harsh shadows',
    shadows: 'Very soft, almost shadowless',
  },
  'bright natural window light': {
    type: 'Natural daylight from large window',
    quality: 'Bright, crisp, cool-white directional light',
    shadows: 'Clean, defined directional shadows from window',
  },
  'warm sunset side light': {
    type: 'Warm sunset golden light from the side',
    quality: 'Warm amber-orange, strong directional side light',
    shadows: 'Deep warm side shadows, dramatic and moody',
  },
  'cool morning light': {
    type: 'Soft cool morning daylight',
    quality: 'Soft, cool-blue, diffused morning light',
    shadows: 'Gentle, minimal, cool-toned shadows',
  },
  'candlelight intimate': {
    type: 'Warm flickering candlelight',
    quality: 'Intimate, warm orange-amber glow',
    shadows: 'Deep moody shadows with warm highlights',
  },
  'overcast outdoor soft': {
    type: 'Overcast outdoor daylight',
    quality: 'Flat, even, milky-white diffused light',
    shadows: 'Near shadowless, very soft and even',
  },
  'harsh midday sun editorial': {
    type: 'Harsh direct midday sunlight',
    quality: 'High contrast, bright white, editorial quality',
    shadows: 'Sharp, deep, hard shadows',
  },
};

export const LOCATION_MAP = {
  'bedroom mirror': 'Bedroom seen through a large full-length mirror, unmade white linen bedding, window with soft natural light, white walls',
  'beach at sunset': 'Sandy beach at golden hour, warm ocean horizon, gentle waves, pink-orange sky',
  'cafe terrace paris': 'Parisian cafe terrace, small round tables, rattan chairs, cobblestone street, soft afternoon light',
  'poolside luxury': 'Edge of a luxury pool, clear turquoise water, white marble tiles, sun deck chairs in background',
  'rooftop city view': 'Urban rooftop, open city skyline stretching to the horizon, late afternoon sky',
  'bathroom vanity': 'Modern bathroom with large vanity mirror, marble countertop, warm vanity strip lighting',
  'hotel room morning': 'Minimalist hotel room, soft white bed linen, large window with morning light flooding in',
  'forest path golden hour': 'Forest path lined with tall trees, golden light filtering through leaves, dappled light patterns on the ground',
  'kitchen counter': 'Modern white kitchen, marble countertop, natural light from a nearby window',
  'balcony with city skyline': 'Open balcony with metal railing, city skyline visible below, open blue sky above',
  'linen sofa living room': 'Cozy living room, natural linen sofa, books and plants on shelves, warm ambient lamplight',
  'outdoor terrace white stone': 'Mediterranean-style outdoor terrace, white stone walls, terracotta pots, warm blue-sky backdrop',
};

export const POSE_MAP = {
  'mirror selfie arm raised': {
    pose_description: 'Standing facing a full-length mirror, arm raised holding smartphone to take a selfie, body slightly angled',
    camera_type: 'Smartphone camera mirror selfie',
    lens_type: 'Wide-angle smartphone lens',
    camera_angle: 'Eye-level from the mirror reflection',
  },
  'over shoulder looking back': {
    pose_description: 'Walking away from camera, head turned to look back over shoulder with natural ease',
    camera_type: 'DSLR candid capture',
    lens_type: '50mm portrait lens',
    camera_angle: 'Eye-level from behind, slight three-quarter angle',
  },
  'sitting legs crossed candid': {
    pose_description: 'Sitting casually on a surface, legs loosely crossed, relaxed candid posture',
    camera_type: 'DSLR candid portrait',
    lens_type: '35mm lens',
    camera_angle: 'Eye-level, candid',
  },
  'standing profile arms relaxed': {
    pose_description: 'Standing in profile view, arms relaxed at sides, neutral confident stance',
    camera_type: 'DSLR editorial portrait',
    lens_type: '85mm portrait lens',
    camera_angle: 'Profile view, eye-level',
  },
  'lying on bed reading': {
    pose_description: 'Lying on bed on stomach, propped comfortably on elbows, looking at phone or reading',
    camera_type: 'DSLR angled shot from above',
    lens_type: '35mm lens',
    camera_angle: 'Slightly high angle, looking down',
  },
  'walking looking down': {
    pose_description: 'Walking casually, looking down at phone, candid street-style movement',
    camera_type: 'DSLR candid street photography',
    lens_type: '35mm lens',
    camera_angle: 'Eye-level, candid from the front',
  },
  'leaning against wall': {
    pose_description: 'Leaning relaxed against a wall, arms loosely at sides, confident casual stance',
    camera_type: 'DSLR portrait',
    lens_type: '50mm lens',
    camera_angle: 'Eye-level, straight on',
  },
  'head tilted soft smile': {
    pose_description: 'Standing or sitting, head gently tilted to one side, warm natural expression',
    camera_type: 'DSLR close portrait',
    lens_type: '85mm portrait lens',
    camera_angle: 'Slightly above eye-level',
  },
  'sitting on floor hugging knees': {
    pose_description: 'Sitting on floor, knees pulled up to chest, arms wrapped around knees, intimate pose',
    camera_type: 'DSLR intimate portrait',
    lens_type: '50mm lens',
    camera_angle: 'Eye-level from slightly above',
  },
  'standing in doorway backlit': {
    pose_description: 'Standing in a doorway, body backlit by light pouring in from behind, slightly silhouetted with details visible',
    camera_type: 'DSLR backlit portrait',
    lens_type: '35mm lens',
    camera_angle: 'Eye-level, straight-on from the front',
  },
};

export const MOOD_MAP = {
  'playful smile': 'playful smile, bright and expressive eyes',
  'sultry soft look': 'sultry expression, soft half-smile, relaxed gaze',
  'candid laugh eyes closed': 'candid natural laugh, eyes closed with joy',
  'serene gaze distance': 'serene, gaze drifting into the distance',
  'confident direct eye contact': 'confident, direct eye contact with the camera',
  'contemplative looking away': 'contemplative, eyes softly looking slightly off-frame',
  'warm natural smile': 'warm, genuine natural smile',
  'relaxed eyes half-closed': 'relaxed expression, eyes softly half-closed',
  'focused reading or scrolling': 'focused, eyes looking downward, absorbed in thought',
};

const HAIR_STYLES = [
  'loose beach waves',
  'messy bun',
  'straight and down',
  'high ponytail',
  'low casual bun',
  'half-up half-down waves',
];

const ACCESSORIES = [
  'Small gold necklace',
  'Silver hoop earrings',
  'Dainty gold pendant necklace',
  'Gold bracelet and small earrings',
  'None',
  'Small gold stud earrings',
];

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)] || '';
}

export function buildGenerationPrompt(concept, format = 'feed', ratio) {
  const safeConcept = concept ?? {};
  const outfitRaw = String(safeConcept.outfit ?? '').toLowerCase();
  const lightingRaw = String(safeConcept.lighting ?? '').toLowerCase();
  const poseRaw = String(safeConcept.pose ?? '').toLowerCase();
  const moodRaw = String(safeConcept.mood ?? '').toLowerCase();
  const locationRaw = String(safeConcept.location ?? '').toLowerCase();

  const outfit = OUTFIT_MAP[outfitRaw] ?? {
    top_garment: outfitRaw || 'top garment',
    top_description: `${safeConcept.outfit ?? 'Outfit description'}, fitted over the bust`,
    bottom_description: 'Matching bottom',
  };

  const lighting = LIGHTING_MAP[lightingRaw] ?? {
    type: String(safeConcept.lighting ?? 'Natural light'),
    quality: 'Natural, photorealistic',
    shadows: 'Natural shadows',
  };

  const pose = POSE_MAP[poseRaw] ?? {
    pose_description: String(safeConcept.pose ?? 'Natural standing pose'),
    camera_type: 'DSLR portrait',
    lens_type: '50mm lens',
    camera_angle: 'Eye-level',
  };

  const expression = MOOD_MAP[moodRaw] ?? String(safeConcept.mood ?? 'neutral expression');
  const background = LOCATION_MAP[locationRaw] ?? `${safeConcept.location ?? 'aesthetic location'}, natural light`;
  const aspectRatio = ratio || (String(format).toLowerCase() === 'story' ? '9:16' : '4:5');

  const replacements = {
    '{top_garment}': outfit.top_garment,
    '{top_description}': outfit.top_description,
    '{bottom_description}': outfit.bottom_description,
    '{accessories}': randomItem(ACCESSORIES),
    '{hair_style}': randomItem(HAIR_STYLES),
    '{expression}': expression,
    '{pose_description}': pose.pose_description,
    '{location}': String(safeConcept.location ?? ''),
    '{background_description}': background,
    '{lighting_type}': lighting.type,
    '{lighting_quality}': lighting.quality,
    '{shadow_description}': lighting.shadows,
    '{camera_type}': pose.camera_type,
    '{lens_type}': pose.lens_type,
    '{camera_angle}': pose.camera_angle,
    '{aspect_ratio}': aspectRatio,
  };

  let template = JSON.stringify(JSON.parse(JSON.stringify(MADISON_JSON_TEMPLATE)));
  for (const [key, value] of Object.entries(replacements)) {
    template = template.split(key).join(String(value));
  }

  return template;
}
