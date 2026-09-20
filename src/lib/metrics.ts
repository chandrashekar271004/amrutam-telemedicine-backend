import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry });

export const httpRequests = new Counter({
  name: 'http_requests_total', help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'], registers: [metricsRegistry]
});
export const httpDuration = new Histogram({
  name: 'http_request_duration_ms', help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route'], buckets: [25, 50, 100, 200, 500, 1000, 2000], registers: [metricsRegistry]
});
