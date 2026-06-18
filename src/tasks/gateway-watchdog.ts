import { logger } from '../logger';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:8080/health';
const TIMEOUT_MS = parseInt(process.env.WATCHDOG_TIMEOUT_MS ?? '10000', 10);
const ALERT_THRESHOLD = parseInt(process.env.WATCHDOG_ALERT_THRESHOLD_MS ?? '3000', 10);
const MAX_SESSION_MINUTES = parseInt(process.env.MAX_SESSION_MINUTES ?? '120', 10);

export async function gatewayWatchdog(): Promise<void> {
  await checkGateway();
  await checkSessionLengths();
}

async function checkGateway(): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const start = Date.now();
    const res = await fetch(GATEWAY_URL, { signal: controller.signal });
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      throw new Error(`Gateway returned HTTP ${res.status}`);
    }

    if (latencyMs > ALERT_THRESHOLD) {
      logger.warn(`Gateway latency ${latencyMs}ms exceeds threshold ${ALERT_THRESHOLD}ms`, {
        task: 'gateway-watchdog',
        latencyMs,
      });
    } else {
      logger.debug(`Gateway healthy, latency=${latencyMs}ms`, { task: 'gateway-watchdog' });
    }
  } finally {
    clearTimeout(timer);
  }
}

async function checkSessionLengths(): Promise<void> {
  // Merged from standalone session-length-check task
  logger.debug(`Checking sessions (max ${MAX_SESSION_MINUTES}min)`, { task: 'gateway-watchdog' });
  // TODO: scan active sessions, warn or terminate those exceeding MAX_SESSION_MINUTES
}
