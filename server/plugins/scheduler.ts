import { runScheduledPublications } from '../utils/scheduledPublisher.js';

// A 60s, chaque tick interrogeait Neon plus vite que son delai de mise en
// veille (~5 min): la base ne s endormait jamais et tournait en continu
// 24h/24, epuisant le quota mensuel de CU-hours meme sans aucune visite.
// 10 min laisse le temps a la base de suspendre entre deux verifications,
// au prix d un retard de publication du meme ordre — sans consequence pour
// un calendrier editorial.
const TICK_INTERVAL_MS = 10 * 60_000;

// Le publicateur planifie doit etre active explicitement. La base Neon est
// partagee entre le poste de dev et la production: demarre par defaut, une
// machine de dev publierait pour de vrai sur Instagram.
function isSchedulerEnabled() {
  const raw = String(process.env.SCHEDULER_ENABLED || '').trim().toLowerCase();
  return ['true', '1', 'yes'].includes(raw);
}

export default defineNitroPlugin(() => {
  if (!isSchedulerEnabled()) {
    return;
  }

  let running = false;

  const tick = async () => {
    // Un passage peut durer plus longtemps que l intervalle (container video):
    // sans ce garde, deux passages se chevaucheraient sur le meme contenu.
    if (running) return;
    running = true;

    try {
      const { prisma } = await import('../utils/prisma.js');
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const { results, error } = await runScheduledPublications({ prisma, baseUrl });

      if (error) {
        console.error('[scheduler] Passage interrompu:', error);
      }

      for (const result of results) {
        if (result.outcome === 'published') {
          console.log(`[scheduler] Contenu ${result.id} publie`);
        } else {
          console.error(`[scheduler] Contenu ${result.id} — ${result.outcome}: ${result.reason}`);
        }
      }
    } catch (error) {
      console.error('[scheduler] Erreur inattendue:', error);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, TICK_INTERVAL_MS);
  // Ne pas maintenir le process en vie uniquement pour ce timer.
  timer.unref?.();

  console.log('[scheduler] Publicateur planifie actif (verification chaque minute)');
});
