import IORedis from 'ioredis';
import { Queue } from 'bullmq';

let generationQueue;

function resolveRedisUrl() {
  try {
    if (typeof useRuntimeConfig === 'function') {
      const config = useRuntimeConfig();
      if (config?.redisUrl) {
        return config.redisUrl;
      }
    }
  } catch {
    // Fallback to environment variables.
  }

  return process.env.REDIS_URL || 'redis://localhost:6379';
}

function buildUpstashRedisOptions() {
  return {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: { rejectUnauthorized: false },
    retryStrategy: (times) => Math.min(times * 50, 2000),
    reconnectOnError: () => true,
    lazyConnect: false,
  };
}

export function getGenerationQueue() {
  if (!generationQueue) {
    const queueConnection = new IORedis(resolveRedisUrl(), buildUpstashRedisOptions());
    generationQueue = new Queue('generation', {
      connection: queueConnection,
    });
  }

  return generationQueue;
}
