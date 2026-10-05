/**
 * Catalogue de poses (2026-10-05), tire de planches de poses dessinees sur
 * mannequin sans visage fournies par l utilisateur (zip pattern-images, dossier
 * ref-pose, hors depot). Chaque pose est identifiee par le NOM de sa planche.
 *
 * DONNEES SEULEMENT, INACTIVES : aucun code ne lit ce catalogue pour
 * l instant. Decision de l utilisateur : ces poses servent a des photos
 * suggestives de personas adultes fictives, reservees aux comptes influenceur
 * (voir le pattern PORTRAIT_POSE_CATALOGUE de promptPatterns.js, non
 * selectionnable), et ne seront branchees qu une fois un modele de generation
 * plus permissif choisi par l utilisateur. A ce moment-la, conditions a
 * garder : personas fictives adultes issues de la face ref, jamais le visage
 * d une personne reelle.
 *
 * `description` : texte neutre en anglais, destine a etre injecte dans un
 * prompt d image ; les planches elles-memes (images) peuvent servir de
 * reference visuelle si le modele choisi accepte une image de pose.
 */

export const POSE_CATALOG = [
  { id: 'SELFIE_POSE', nom: 'Selfie Pose', planche: 'HS2Q7OBWkAAgcem.jpg', description: 'High-angle selfie framing from the chest up, both arms extended toward the camera as if holding a phone, shoulders slightly forward.' },
  { id: 'CROSSED_ARMS', nom: 'Crossed Arms', planche: 'HS3XgpxWwAAB5Ft.jpg', description: 'Standing three-quarter pose, one arm folded across the other in front of the torso, head slightly lowered, weight shifted onto one hip.' },
  { id: 'PRONE_SIDE_STRETCH', nom: 'Prone Side Stretch', planche: 'HTbm-ulXkAA4JMu.jpg', description: 'Lying on the floor propped on one hand, torso turned and looking back over the shoulder, legs extended behind.' },
  { id: 'RECLINING_FOOT_GRAB', nom: 'Reclining Foot Grab', planche: 'HTbm-ulXkAA4JMu.jpg', description: 'Lying on her back with both legs raised, hands holding the ankles, knees apart, head resting on the floor.' },
  { id: 'KNEELING_BACK_VIEW', nom: 'Kneeling Back View', planche: 'HTbm-ulXkAA4JMu.jpg', description: 'Seen from behind, sitting back on folded legs with feet tucked beside the hips, upright back, hair falling down the back.' },
  { id: 'PRONE_BRIDGE', nom: 'Prone Bridge', planche: 'HTbm-ulXkAA4JMu.jpg', description: 'Chest low to the floor with arms folded under the head, hips raised and legs extended wide, seen from behind.' },
  { id: 'SIDE_SIT', nom: 'Side Sit', planche: 'HTEU4P5WkAE_8zX.jpg', description: 'Sitting on one hip with both legs folded to the side, one hand supporting on the floor, the other raised to the head.' },
  { id: 'SIDE_RECLINE', nom: 'Side Recline', planche: 'HTEU4P5WkAE_8zX.jpg', description: 'Lying on her side propped on one elbow, head resting on her hand, top leg bent with the foot planted.' },
  { id: 'UPRIGHT_KNEEL', nom: 'Upright Kneel', planche: 'HTEU4P5WkAE_8zX.jpg', description: 'Kneeling upright, knees slightly apart, both hands behind the head with elbows open.' },
  { id: 'PRONE_BEND', nom: 'Prone Bend', planche: 'HTEU4P5WkAE_8zX.jpg', description: 'Lying on her stomach propped on the forearms, knees bent and feet raised and crossed behind.' },
  { id: 'FORWARD_KNEEL', nom: 'Forward Kneel', planche: 'HTEU4P5WkAE_8zX.jpg', description: 'On hands and knees leaning forward, arms straight, head lifted toward the camera.' },
  { id: 'BALANCED_SQUAT', nom: 'Balanced Squat', planche: 'HTEU4P5WkAE_8zX.jpg', description: 'Deep squat with knees apart and feet flat, hands raised to the sides of the head.' },
  { id: 'FOUR_LEGGED_GLANCE', nom: 'Four-Legged Glance', planche: 'HThFlcnXAAA3Kyr.jpg', description: 'On hands and knees, looking back toward the camera over one shoulder.' },
  { id: 'PRONE_ELBOW_LIFT', nom: 'Prone Elbow Lift', planche: 'HThFlcnXAAA3Kyr.jpg', description: 'Lying on her stomach propped on both elbows, chin up, feet lifted behind.' },
  { id: 'FORWARD_FOLD_SUPPORT', nom: 'Forward Fold Support', planche: 'HThFlcnXAAA3Kyr.jpg', description: 'Standing and folded forward from the hips, one hand supporting the lower back.' },
  // Nom d origine sur la planche : "Child's Pose Vaeling Fold" (faute de frappe).
  { id: 'CHILDS_POSE_FOLD', nom: "Child's Pose Folded", planche: 'HThFlcnXAAA3Kyr.jpg', description: 'Kneeling with the torso folded forward over the thighs and both arms extended ahead along the floor.' },
  { id: 'SEATED_HAMSTRING_STRETCH', nom: 'Seated Hamstring Stretch', planche: 'HThFlcnXAAA3Kyr.jpg', description: 'Seated on the floor with one leg extended, leaning forward and reaching toward the foot.' },
  { id: 'FOREARM_PLANK', nom: 'Forearm Plank', planche: 'HThFlcnXAAA3Kyr.jpg', description: 'Forearm plank, body in a straight line from head to heels, seen from the side.' },
  { id: 'TOP_DOWN_TWIST', nom: 'Top-Down Twist', planche: 'HTWMJ2GWwAA6bDt.jpg', description: 'Seen from directly above at a high angle, torso twisted, one hand on the hip and the other arm across the waist.' },
  { id: 'FORWARD_GESTURE', nom: 'Forward Gesture', planche: 'HTWMJ2GWwAA6bDt.jpg', description: 'Seen from above, walking toward the camera with one arm extended and the hand pointing at the lens.' },
  { id: 'REACHING_UP', nom: 'Reaching Up', planche: 'HTWMJ2GWwAA6bDt.jpg', description: 'Seen from above, one hand reaching up toward the camera with the palm open, one knee raised.' },
];

// Planches de reference anatomique (dossier ref-pose/autres), non liees a une
// pose : a utiliser plus tard pour durcir les consignes de qualite.
export const ANATOMY_GUIDES = [
  { id: 'HAND_FIST', description: 'A fist must read as a curved arc of knuckles with the thumb wrapped across the fingers, never as a flat row of four equal blocks.' },
  { id: 'TEETH_SMILE', description: 'Teeth in a smile must show slight overlap, uneven edges and a visible gum line, never one smooth identical white strip.' },
];

export function getPoseCatalog() {
  return POSE_CATALOG;
}

export function getPoseByName(name) {
  const key = String(name || '').trim().toLowerCase();
  return POSE_CATALOG.find((pose) => pose.nom.toLowerCase() === key) || null;
}
