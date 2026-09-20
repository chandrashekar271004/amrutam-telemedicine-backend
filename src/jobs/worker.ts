import { Queue, Worker } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../lib/logger';

const connection={url:env.REDIS_URL};
export const notificationQueue=new Queue('notifications',{connection});
new Worker('notifications',async job=>{logger.info({jobId:job.id,type:job.name},'Processing async job');}, {connection,concurrency:10});
logger.info('Notification worker started');
