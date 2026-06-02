const SAFETY_REPLACEMENTS = [
  [
    'CRITICAL - body proportions to reproduce exactly:\n- Very large, full bust with visible cleavage, stretching the top garment\n- Narrow defined waist, pronounced hourglass silhouette\n- Wide hips and rounded glutes\nThese body proportions are NON-NEGOTIABLE and must be clearly visible in the final image.',
    'Feminine figure with natural proportions and hourglass shape.',
  ],
  ['Extremely large, very full breasts causing cleavage', 'Full, prominent bust'],
  ['significantly enlarged breasts', 'full bust'],
  ['very full breasts', 'full bust'],
  ['cleavage and stretching', 'filling'],
  ['NON-NEGOTIABLE', 'important'],
  [
    'Voluptuous hourglass figure with significantly enlarged breasts',
    'Hourglass figure with full bust',
  ],
  ['stretching the top garment', 'filling the top garment'],
  ['visible cleavage', 'natural neckline'],
  ['full and rounded high-set glutes with extreme waist-to-hip ratio', 'rounded glutes with hourglass ratio'],
  [
    'Prominent gluteal muscles, extreme waist-to-hip ratio, shapely posterior chain',
    'Hourglass proportions, curvaceous shape',
  ],
  ['Wide hips and rounded glutes', 'Defined hips'],
];

export function sanitizePromptForSafety(prompt) {
  let sanitized = String(prompt ?? '');

  for (const [oldValue, newValue] of SAFETY_REPLACEMENTS) {
    sanitized = sanitized.split(oldValue).join(newValue);
  }

  sanitized = sanitized.replace(/significantly enlarged breasts[^."\n]*/g, 'full bust');
  sanitized = sanitized.replace(/[Ee]xtremely large[^."\n]*breasts[^."\n]*/g, 'Full, prominent bust');
  sanitized = sanitized.replace(/stretching the (?!top garment)[\w][\w\s]+(?=[.,"\n])/g, 'filling the attire');
  sanitized = sanitized.replace(/(?:fill|filling) the [\w][\w\s]+(?=[.,"\n])/g, 'complement the attire');
  sanitized = sanitized.replace(/Voluptuous hourglass figure[^."\n]*/g, 'Hourglass figure with feminine proportions.');
  sanitized = sanitized.replace(/full and rounded high-set glutes[^."\n]*/g, 'rounded glutes');
  sanitized = sanitized.replace(/causing cleavage[^."\n]*/g, 'filling the garment');

  return sanitized;
}

export function injectBody(sceneJson) {
  const enriched = JSON.parse(JSON.stringify(sceneJson ?? {}));

  let topGarment = 'top garment';
  try {
    const subject = enriched.subject && typeof enriched.subject === 'object' ? enriched.subject : {};
    const wardrobe = subject.wardrobe && typeof subject.wardrobe === 'object' ? subject.wardrobe : {};

    let topRaw = wardrobe.top || wardrobe.top_garment || '';
    if (!topRaw) {
      const clothing = subject.clothing && typeof subject.clothing === 'object' ? subject.clothing : {};
      topRaw = clothing.outfit_description || clothing.top || '';
    }

    if (topRaw) {
      const part = String(topRaw).split(',')[0].split('.')[0].trim().toLowerCase();
      topGarment = part.length > 60 ? part.slice(0, 60) : part;
    }
  } catch {
    // Keep fallback topGarment value.
  }

  const bodyCueWords = [
    'slim',
    'slender',
    'petite',
    'thin',
    'skinny',
    'toned',
    'athletic',
    'lean',
    'small bust',
    'flat chest',
    'flat stomach',
    'curvy',
    'plus size',
    'voluptuous',
    'large frame',
    'small frame',
    'tiny waist',
    'showing off figure',
    'hourglass',
    'silhouette',
    'proportions',
    'measurements',
    'large breast',
    'big breast',
    'huge breast',
    'enormous breast',
    'large chest',
    'big chest',
    'full chest',
    'heavy chest',
    'cleavage',
    'busty',
    'buxom',
    'curvaceous',
    'wide hips',
    'full hips',
    'round hips',
    'big butt',
    'large butt',
    'round butt',
    'big glutes',
    'ample',
    'generously',
  ];

  const skipKeys = new Set(['body', 'face', 'description']);

  const stripBodyCues = (text) => {
    if (typeof text !== 'string') return text;
    let output = text;
    let lowered = output.toLowerCase();

    for (const word of bodyCueWords) {
      if (lowered.includes(word)) {
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        output = output
          .replace(new RegExp(`[^,.]* ${escapedWord}[^,.]*[,.]?`, 'gi'), '')
          .trim()
          .replace(/^[,\s]+|[,\s]+$/g, '');
        lowered = output.toLowerCase();
      }
    }

    return output.trim();
  };

  const deepStrip = (obj, parentKey = '') => {
    if (skipKeys.has(parentKey)) return obj;
    if (typeof obj === 'string') return stripBodyCues(obj);
    if (Array.isArray(obj)) return obj.map((item) => deepStrip(item));
    if (obj && typeof obj === 'object') {
      const copy = {};
      for (const [key, value] of Object.entries(obj)) {
        copy[key] = deepStrip(value, key);
      }
      return copy;
    }
    return obj;
  };

  const cleaned = deepStrip(enriched);

  const madisonBody = {
    physique: `Voluptuous hourglass figure with significantly enlarged breasts that fill the ${topGarment}. Narrow defined waist leading to wider hips, full and rounded high-set glutes with extreme waist-to-hip ratio. Muscle tone visible in core and legs.`,
    anatomy: {
      shoulders: 'Defined, proportional.',
      waist: 'Narrow, defined waist.',
      hips: 'Wide hips with full, high and rounded glutes. Prominent gluteal muscles, extreme waist-to-hip ratio, shapely posterior chain. Not muscular - curvaceous and natural.',
      breasts: `Extremely large, very full breasts causing cleavage and stretching the ${topGarment}.`,
      waist_to_hip_ratio: 'Pronounced hourglass.',
    },
    skin: {
      tone: 'Warm light beige, natural sun-kissed California glow.',
      texture: 'Visible pores, natural skin texture, not airbrushed, raw photo.',
      details: 'No tattoos.',
    },
  };

  const madisonFace = {
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
  };

  if (!cleaned.subject || typeof cleaned.subject !== 'object' || Array.isArray(cleaned.subject)) {
    cleaned.subject = {};
  }

  cleaned.subject.description = 'A young blonde woman named Madison, californian aesthetic, mid-20s.';
  cleaned.subject.body = madisonBody;
  cleaned.subject.face = madisonFace;

  return cleaned;
}

// Python-compatible aliases
export const inject_madison_body = injectBody;
export const _sanitize_prompt_for_safety = sanitizePromptForSafety;
