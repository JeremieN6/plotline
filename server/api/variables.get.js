import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export default defineEventHandler(async (event) => {
  try {
    const filePath = resolve(process.cwd(), 'server', 'data', 'variables.json');
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Unable to load variables.json',
        data: {
          message: err?.message,
        },
      }),
    );
  }
});