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
    retryStrategy: (times) => {
      if (times > 8) return null;
      return Math.min(times * 500, 5000);
    },
    reconnectOnError: (err) => {
      const msg = String(err?.message || '').toUpperCase();
      return msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED');
    },
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
