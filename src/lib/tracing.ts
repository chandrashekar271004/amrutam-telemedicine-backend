import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { env } from '../config/env.js';

export function startTracing() {
  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return undefined;
  }

  const traceExporter = new OTLPTraceExporter({
    url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
  });

  const sdk = new NodeSDK({
    serviceName: env.OTEL_SERVICE_NAME,
    traceExporter,
    instrumentations: [
      new HttpInstrumentation()
    ]
  });

  sdk.start();

  return sdk;
}
