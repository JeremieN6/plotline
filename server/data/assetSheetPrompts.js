// Prompts de fiche de reference d'un asset (objet ou lieu). Textes en anglais,
// comme app/utils/faceRefPrompt.js. Un prompt complet = COMMON + le bloc du type.

export const ASSET_SHEET_COMMON_PROMPT =
  'Create a professional production reference sheet of this exact object (or place), using the uploaded photos as the only source of truth. All photos show the same subject; each photo is introduced by a short label saying what it shows. Reproduce its shape, color, materials and every visible detail exactly; never add, remove or restyle anything. Views that no photo covers must be a faithful extrapolation of what is visible (same shape, materials, colors, proportions); parts that cannot be inferred are omitted rather than invented. Clean light beige textured studio background, tidy block layout with equal-sized panels, soft neutral studio lighting, photorealistic, true-to-life materials. The same subject, same proportions and same details in every panel. No text, no captions, no labels, no added logos, no watermark, no decorative elements. No people, except where a worn view is requested below, and then never show a face.';

export const ASSET_SHEET_TYPE_PROMPTS = {
  CAR:
    'Layout: vehicle reference sheet. Exterior panels: front three-quarter view, side profile, rear view, top view. Interior block (dashboard, front seats, rear seats, trunk): include it only if at least one photo is labelled interior, and build it strictly from those photos; otherwise omit the block entirely. Close-up panels: headlights, wheels, steering wheel if visible. Blank neutral license plate.',
  HOUSE:
    'Layout: location reference sheet. Exterior panels: main facade, left three-quarter, right three-quarter, rear or garden side, only as far as they can be faithfully extrapolated from the exterior photos. Interior block (3 to 4 key rooms): include it only if at least one photo is labelled interior, and build it strictly from those photos; otherwise omit the block entirely. Close-up panels: front door, windows, key materials (walls, floor, roof).',
  STREET:
    'Layout: outdoor location reference sheet. Wide establishing view, two other angles along the street, close-ups of the ground surface, facades and street furniture. No identifiable people, no readable license plates.',
  JEWEL:
    'Layout: jewelry reference sheet. The isolated piece on a plain background in three angles (front, side, three-quarter). One extreme macro close-up of the key details (links, setting, clasp, engraving if visible). One worn view cropped without any face (neck, ear, wrist or hand, depending on the piece) to fix the real scale; if a photo labelled worn is provided, match it. For rings and signet rings: top view, side profile, inside of the band. Metal and finish must match the photos exactly.',
  SHOES:
    'Layout: footwear reference sheet. Three-quarter front, outer side, inner side, top, sole and heel views. Close-ups: material, stitching, laces. One worn view showing only the feet and lower legs, no face.',
  HAT:
    'Layout: headwear reference sheet. Front, side, back, top and inside lining views. Close-ups: brim, band or ribbon, stitching. One worn view on a neutral featureless mannequin head (no facial features), front and side, to fix size and tilt.',
  PROP:
    'Layout: object reference sheet. Front, side, back and three-quarter views. Close-ups: materials, stitching, closures. One in-context view at neutral scale (held in a hand or on a plain table), no face.',
};

// Utilise seul (sans le bloc COMMON) au 2e essai, quand Gemini ne renvoie aucune image.
export const ASSET_SHEET_FALLBACK_PROMPT =
  'Generate a clean reference sheet of this subject from the photos: several views and close-ups of the same subject on a plain light background, no text.';
