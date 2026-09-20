import request from 'supertest'; import { describe,it,expect } from 'vitest'; import { app } from '../src/app.js';
describe('health',()=>{it('reports liveness',async()=>{const r=await request(app).get('/health/live'); expect(r.status).toBe(200); expect(r.body.status).toBe('ok');});});
