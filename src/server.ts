import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { startTracing } from './lib/tracing.js';

async function main() {
  // Initialize OpenTelemetry before loading the application
  // so HTTP/Express/Redis/other instrumentations can be registered.
  const tracing = startTracing();

  const [{ app }, { prisma }, { redis }] = await Promise.all([
    import('./app.js'),
    import('./lib/prisma.js'),
    import('./lib/redis.js')
  ]);
  await prisma.$connect();
  await redis.connect();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'API started');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');

    server.close(async () => {
      await tracing?.shutdown();
      await redis.quit();
      await prisma.$disconnect();
      process.exit(0);
    });

    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(async (err) => {
  logger.fatal({ err }, 'Startup failed');
  process.exit(1);
});
