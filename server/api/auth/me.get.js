import { resolveAuthUser } from '../../utils/auth.js';

export default defineEventHandler(async (event) => {
  const user = await resolveAuthUser(event);
  return { user: user || null };
});
