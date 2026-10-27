import { activeFacelessJobCount, waitForActiveFacelessJobs } from '../utils/facelessVideoJob.js';

// Une video faceless se genere en tache de fond DANS le process web. A l arret
// (deploiement : pm2 envoie SIGTERM), on laisse les generations en cours finir
// au lieu de les abandonner en PROCESSING pour toujours.
// Delai maximum d attente : FACELESS_SHUTDOWN_WAIT_MS (defaut 5 min). Il doit
// rester inferieur a NITRO_SHUTDOWN_TIMEOUT et au kill_timeout de pm2, sinon le
// process est tue avant la fin de l attente.
const DEFAULT_WAIT_MS = 5 * 60_000;

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', async () => {
    const pending = activeFacelessJobCount();
    if (!pending) return;

    const waitMs = Number.parseInt(process.env.FACELESS_SHUTDOWN_WAIT_MS || '', 10) || DEFAULT_WAIT_MS;
    console.log(`[faceless] arret demande : attente de ${pending} generation(s) (max ${Math.round(waitMs / 1000)} s)`);
    const left = await waitForActiveFacelessJobs(waitMs);
    console.log(left ? `[faceless] ${left} generation(s) interrompue(s) a l arret` : '[faceless] generations terminees, arret');
  });
});
