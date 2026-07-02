import { destroyAuthSession } from '../../utils/auth.js';

export default defineEventHandler(async (event) => {
  await destroyAuthSession(event);
  return { ok: true };
});
