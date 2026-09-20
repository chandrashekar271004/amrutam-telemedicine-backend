import swaggerUi from 'swagger-ui-express';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { createRequire } from 'node:module';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { apiRateLimit } from './middleware/rateLimit.js';
import { requestId } from './middleware/requestId.js';
import { errorHandler } from './middleware/error.js';
import { httpRequests, httpDuration, metricsRegistry } from './lib/metrics.js';
import authRoutes from './modules/auth/routes.js';
import userRoutes from './modules/users/routes.js';
import doctorRoutes from './modules/doctors/routes.js';
import availabilityRoutes from './modules/availability/routes.js';
import consultationRoutes from './modules/consultations/routes.js';
import prescriptionRoutes from './modules/prescriptions/routes.js';
import searchRoutes from './modules/search/routes.js';
import adminRoutes from './modules/admin/routes.js';
import bookingRoutes from './modules/bookings/routes.js';

const require = createRequire(import.meta.url);
const pinoHttp = require('pino-http');

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(requestId);
app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN.split(',').map(s => s.trim()), credentials: true }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(apiRateLimit);
app.use((req,res,next)=>{const start=process.hrtime.bigint(); res.on('finish',()=>{const ms=Number(process.hrtime.bigint()-start)/1e6; const route=req.route?.path||req.path; httpRequests.inc({method:req.method,route,status:String(res.statusCode)}); httpDuration.observe({method:req.method,route},ms);}); next();});

app.get('/health/live', (_req,res)=>res.json({status:'ok'}));
app.get('/health/ready', async (_req,res)=>{try{await prisma.$queryRaw`SELECT 1`; if(!redis.isReady) throw new Error('redis not ready'); res.json({status:'ok',dependencies:{postgres:'ok',redis:'ok'}});}catch{res.status(503).json({status:'not_ready'});}});
app.get('/metrics', async (_req,res)=>{res.setHeader('Content-Type',metricsRegistry.contentType); res.end(await metricsRegistry.metrics());});
const openApiPath = path.join(process.cwd(), 'docs', 'openapi.yaml');
const openApiDocument = YAML.parse(fs.readFileSync(openApiPath, 'utf8'));

app.get('/openapi.yaml', (_req, res) => {
  res.sendFile('openapi.yaml', {
    root: path.join(process.cwd(), 'docs'),
  });
});

app.get('/openapi.json', (_req, res) => {
  res.json(openApiDocument);
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.use('/api/v1/auth',authRoutes);
app.use('/api/v1/users',userRoutes);
app.use('/api/v1/doctors',doctorRoutes);
app.use('/api/v1/availability',availabilityRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/consultations',consultationRoutes);
app.use('/api/v1/prescriptions',prescriptionRoutes);
app.use('/api/v1/search',searchRoutes);
app.use('/api/v1/admin',adminRoutes);
app.use((_req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'Route not found'}}));
app.use(errorHandler);
