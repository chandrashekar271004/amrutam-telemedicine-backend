import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { env } from '../config/env';

export function startTracing() {
  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT) return undefined;
  const sdk = new NodeSDK({
    serviceName: env.OTEL_SERVICE_NAME,
    traceExporter: new OTLPTraceExporter({ url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces` }),
    instrumentations: [getNodeAutoInstrumentations()]
  });
  sdk.start();
  return sdk;
}
