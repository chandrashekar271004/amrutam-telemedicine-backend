import { app } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { startTracing } from './lib/tracing';

async function main(){
  await prisma.$connect();
  await redis.connect();
  const tracing=startTracing();
  const server=app.listen(env.PORT,()=>logger.info({port:env.PORT},'API started'));
  const shutdown=async(signal:string)=>{logger.info({signal},'Shutting down'); server.close(async()=>{await tracing?.shutdown(); await redis.quit(); await prisma.$disconnect(); process.exit(0);}); setTimeout(()=>process.exit(1),10000).unref();};
  process.on('SIGTERM',()=>shutdown('SIGTERM')); process.on('SIGINT',()=>shutdown('SIGINT'));
}
main().catch(async err=>{logger.fatal({err},'Startup failed'); await prisma.$disconnect(); process.exit(1);});
