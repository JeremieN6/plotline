/**
 * Resolution d'un widget Studio en prompt final: substitution mecanique des
 * variables `{{cle}}` du template (meme pattern que buildGenerationPrompt.js,
 * adapte aux doubles accolades), puis ajout du negative prompt en fin de
 * texte -- aucun fournisseur de generation (Gemini/Veo/Kling/Seedance) n'a de
 * parametre negative_prompt dedie aujourd'hui.
 */

function substitute(template, replacements) {
  let result = String(template || '');
  for (const [key, value] of Object.entries(replacements)) {
    result = result.split(`{{${key}}}`).join(String(value ?? '').trim());
  }
  return result;
}

export function resolveWidgetPrompt(widget, { personaDescription = '', inputs = {} } = {}) {
  if (!widget) {
    throw new Error('Widget introuvable');
  }

  const replacements = {};
  for (const variable of widget.variables || []) {
    if (variable.source === 'persona') {
      replacements[variable.key] = personaDescription;
    } else if (variable.source === 'upload') {
      // La variable ne porte que l'intention textuelle: le fichier lui-meme
      // est passe a part comme reference image (start frame video, ou part
      // additionnelle Gemini), jamais son URL injectee dans le texte.
      replacements[variable.key] = 'the attached reference image';
    } else {
      replacements[variable.key] = inputs?.[variable.key] ?? '';
    }
  }

  let finalPrompt = substitute(widget.template, replacements);

  if (widget.negativePrompt) {
    finalPrompt = `${finalPrompt} Avoid: ${widget.negativePrompt}.`;
  }

  return { finalPrompt };
}
