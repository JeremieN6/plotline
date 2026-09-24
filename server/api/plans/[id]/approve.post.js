import { processGenerationJob } from '../../../utils/generationWorker.js';
import { resolveVideoModelOrThrow, runVideoGenerationJob } from '../../../utils/videoGeneration.js';
import { pickPinterestKeyword } from '../../../utils/pinterestKeywordPicker.js';
import { extractQuotedDialogue } from '../../../utils/videoModelSelector.js';
import { chooseCustomPromptWidgetAndPattern } from '../../../utils/customPromptStudioRouting.js';
import { resolveWidgetPrompt } from '../../../utils/widgetEngine.js';
import { buildPersonaDescription } from '../../../utils/personaDescription.js';
import { generateWidgetFields } from '../../../utils/widgetFieldsAssistGenerator.js';

let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

function isVideoFormat(format) {
  return String(format || '').trim().toUpperCase() === 'REEL';
}

function isStoryFormat(format) {
  return String(format || '').trim().toUpperCase() === 'STORY';
}

function isCustomPromptStudioFormat(format) {
  return String(format || '').trim().toUpperCase() === 'CUSTOM_PROMPT_STUDIO';
}

/**
 * Lance la generation d une idee. Les erreurs sont absorbees: une idee ratee ne
 * doit pas empecher les suivantes d aboutir, et le contenu porte deja son propre
 * statut d echec.
 *
 * Definition des formats (2026-09-22): REEL = video avec un personnage
 * clairement visible (persona du catalogue OU personnage fictif) ; FEED =
 * image, le plus souvent avec personnage ; STORY = image ou video SANS aucun
 * personnage obligatoire (decor, ambiance). Le routage ci-dessous suit cette
 * definition plutot qu un simple nom de format.
 */
async function generateForItem({ prisma, runtimeConfig, item, profile, withFaceRef }) {
  try {
    if (isVideoFormat(item.format)) {
      if (withFaceRef) {
        // Persona du catalogue: on reutilise le pipeline Pinterest + Kling
        // Motion Control (runReelWorkflow, via processGenerationJob) au lieu
        // de la generation texte->video generique -- c est le seul chemin qui
        // porte deja les gardes qualite (rejet des clips source trop courts,
        // sans visage/haut du corps visible) plutot que d en dupliquer une
        // version affaiblie ici.
        const { keyword, category } = await pickPinterestKeyword({
          format: 'REEL',
          niche: profile.niche,
          style: profile.style,
        });

        await processGenerationJob({
          influencerId: profile.id,
          workflowType: 'pinterest',
          contentType: 'reel',
          keyword,
          tagCategory: category,
          contentId: item.contentId,
          withFaceRef: true,
        });
        return;
      }

      // Personnage fictif (pas de face ref a verrouiller): le modele depend de
      // ce qu il y a vraiment a produire, pas d une regle fixe.
      //
      // - Une repartie entre guillemets dans l idee => il y a un texte a faire
      //   dire. Omni Flash est alors justifie par le contenu lui-meme (seul
      //   modele du projet avec lip-sync natif), pas choisi par defaut.
      // - Sans repartie (mouvement, ambiance, action) => Omni Flash n apporte
      //   rien puisqu il n y a aucune levre a synchroniser ; Kling/Veo restent
      //   le choix eprouve pour du mouvement pur (selectVideoModel, deja
      //   utilise ailleurs dans le projet pour ce meme arbitrage).
      const quoted = extractQuotedDialogue(item.prompt);

      if (quoted) {
        const model = resolveVideoModelOrThrow({
          prompt: item.prompt,
          withFaceRef: false,
          influencer: profile,
          runtimeConfig,
          forcedModel: 'omniflash',
        });

        await runVideoGenerationJob({
          prisma,
          runtimeConfig,
          contentId: item.contentId,
          prompt: item.prompt,
          model,
          withFaceRef: false,
          influencer: profile,
          scenePrompt: quoted.scene,
          dialogueText: quoted.dialogue,
        });

        return;
      }

      const model = resolveVideoModelOrThrow({
        prompt: item.prompt,
        withFaceRef: false,
        influencer: profile,
        runtimeConfig,
      });

      await runVideoGenerationJob({
        prisma,
        runtimeConfig,
        contentId: item.contentId,
        prompt: item.prompt,
        model,
        withFaceRef: false,
        influencer: profile,
        scenePrompt: item.prompt,
      });

      return;
    }

    if (isCustomPromptStudioFormat(item.format)) {
      // Format experimental (2026-09-23) : genere depuis la base de prompts
      // maison (server/data/widgets.js + server/data/promptPatterns.js)
      // plutot qu une recherche Pinterest -- objectif de l utilisateur :
      // comparer les deux sources, reduire a terme la dependance a Pinterest.
      // Le widget est choisi selon la presence d une face ref, et
      // volontairement restreint a deux widgets deja eprouves (voir
      // customPromptStudioRouting.js pour le detail de l exclusion des 3
      // autres) ; le pattern actif pour ce widget (un seul par widget dans ce
      // lot, jamais un pattern au ton plus pousse -- voir promptPatterns.js)
      // est fusionne dedans.
      const { widget } = chooseCustomPromptWidgetAndPattern(withFaceRef);
      if (!widget) {
        throw new Error('Aucun widget Studio automatisable pour ce profil (CUSTOM_PROMPT_STUDIO)');
      }

      const personaDescription = widget.requiresPersona ? buildPersonaDescription(profile) : '';
      // L idee ecrite par Claude pour ce creneau sert de matiere premiere au
      // meme mecanisme "idee -> champs" deja utilise dans le Studio manuel
      // (widgetFieldsAssistGenerator.js), pas d un nouvel appel dedie.
      const inputs = await generateWidgetFields({
        widget,
        idea: item.prompt,
        personaDescription,
        apiKey: runtimeConfig.anthropicApiKey,
      });
      const { finalPrompt } = resolveWidgetPrompt(widget, { personaDescription, inputs });

      if ((widget.typeGeneration || []).includes('VIDEO')) {
        // Seul widget video autorise ici : SCENARIO_BLOG, sans face ref --
        // exactement le chemin Omni Flash deja valide par
        // /api/external/video-jobs (scene + script separes, pas de
        // verrouillage d identite).
        const model = resolveVideoModelOrThrow({
          prompt: finalPrompt,
          withFaceRef: false,
          influencer: profile,
          runtimeConfig,
          forcedModel: 'omniflash',
        });

        await runVideoGenerationJob({
          prisma,
          runtimeConfig,
          contentId: item.contentId,
          prompt: finalPrompt,
          model,
          withFaceRef: false,
          influencer: profile,
          scenePrompt: finalPrompt,
          dialogueText: inputs.scriptText || undefined,
        });
        return;
      }

      // Seul widget image autorise ici : PORTRAIT_STUDIO, toujours avec face
      // ref (c est un widget requiresPersona).
      await processGenerationJob({
        influencerId: profile.id,
        workflowType: 'free',
        contentType: 'feed',
        prompt: finalPrompt,
        contentId: item.contentId,
        withFaceRef: true,
      });
      return;
    }

    if (isStoryFormat(item.format)) {
      // Une Story n a jamais de personnage: elle vient toujours d un mot-cle
      // Pinterest, jamais du prompt libre ecrit par Claude (qui ne decrit pas
      // une recherche Pinterest exploitable). Bug corrige le 2026-09-22: ce
      // format echouait a 100% ("No Pinterest video found for query:
      // undefined"), faute de mot-cle du tout.
      const { keyword, category } = await pickPinterestKeyword({
        format: 'STORY',
        niche: profile.niche,
        style: profile.style,
      });

      await processGenerationJob({
        influencerId: profile.id,
        workflowType: 'pinterest',
        contentType: 'story',
        keyword,
        tagCategory: category,
        contentId: item.contentId,
      });
      return;
    }

    await processGenerationJob({
      influencerId: profile.id,
      workflowType: 'free',
      contentType: String(item.format || 'FEED').toLowerCase(),
      prompt: item.prompt,
      contentId: item.contentId,
      withFaceRef,
    });
  } catch (error) {
    await prisma.generatedContent.updateMany({
      where: { id: item.contentId },
      data: {
        status: 'FAILED',
        errorMessage: String(error?.statusMessage || error?.message || 'Generation impossible'),
      },
    }).catch(() => {});
  }
}

/**
 * Approuve un plan: chaque idee conservee devient un contenu a generer.
 *
 * C est le seul endroit ou le planificateur engage des credits, d ou la revue
 * prealable. La reponse est immediate et la generation se poursuit en tache de
 * fond: attendre dix generations dans une requete HTTP la ferait couper.
 */
export default defineEventHandler(async (event) => {
  try {
    const planId = String(event.context?.params?.id || '').trim();
    if (!planId) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Parametre id requis' }));
    }

    const prisma = await getPrisma();
    const authModule = await import('../../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    const plan = await prisma.contentPlan.findFirst({
      where: { id: planId, profile: { is: { userId: user.id } } },
      select: {
        id: true,
        status: true,
        campaignId: true,
        profile: {
          select: {
            id: true,
            name: true,
            faceRefPath: true,
            bodyPrompt: true,
            hairPrompt: true,
            identityProfile: true,
            silhouette: true,
            niche: true,
            style: true,
            // Necessaires a buildPersonaDescription(), utilise par le format
            // CUSTOM_PROMPT_STUDIO (widget PORTRAIT_STUDIO).
            gender: true,
            eyeColor: true,
            ethnicity: true,
            particularities: true,
          },
        },
        items: {
          where: { keep: true, contentId: null },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            prompt: true,
            caption: true,
            hashtags: true,
            platform: true,
            format: true,
            scheduledAt: true,
          },
        },
      },
    });

    if (!plan) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Plan introuvable' }));
    }

    if (plan.status === 'DISCARDED') {
      return sendError(event, createError({ statusCode: 409, statusMessage: 'Ce plan a ete abandonne' }));
    }

    if (!plan.items.length) {
      return sendError(event, createError({
        statusCode: 409,
        statusMessage: 'Aucune idee a generer: tout a deja ete produit ou ecarte',
      }));
    }

    const profile = plan.profile;
    const withFaceRef = Boolean(String(profile?.faceRefPath || '').trim());

    // On cree d abord tous les contenus et on les relie au plan: si la generation
    // echoue plus loin, on sait deja ce qui a ete engage et on ne le refera pas.
    const prepared = [];
    for (const item of plan.items) {
      const caption = [item.caption, item.hashtags].filter(Boolean).join('\n\n') || null;

      const content = await prisma.generatedContent.create({
        data: {
          influencerId: profile.id,
          campaignId: plan.campaignId || null,
          ambassadorId: withFaceRef ? profile.id : null,
          prompt: item.prompt,
          caption,
          platform: item.platform,
          format: item.format,
          status: 'PROCESSING',
          scheduledAt: item.scheduledAt,
        },
        select: { id: true },
      });

      await prisma.contentPlanItem.update({
        where: { id: item.id },
        data: { contentId: content.id },
      });

      prepared.push({ ...item, contentId: content.id });
    }

    await prisma.contentPlan.update({
      where: { id: plan.id },
      data: { status: 'APPROVED' },
    });

    const runtimeConfig = useRuntimeConfig(event);

    // En serie: dix generations lancees d un coup satureraient les fournisseurs.
    (async () => {
      for (const item of prepared) {
        await generateForItem({ prisma, runtimeConfig, item, profile, withFaceRef });
      }
    })();

    return {
      planId: plan.id,
      status: 'APPROVED',
      launched: prepared.length,
      contentIds: prepared.map((item) => item.contentId),
    };
  } catch (err) {
    if (err?.statusCode) {
      return sendError(event, err);
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Approbation du plan impossible',
        data: { code: err?.code, message: err?.message },
      }),
    );
  }
});
