import { logger } from '../logger';
import { readFileSync } from 'fs';

const OPENCLAW_HOME = process.env.OPENCLAW_HOME ?? '.';
const API_DAILY_TOKEN_THRESHOLD = parseInt(process.env.API_DAILY_TOKEN_THRESHOLD ?? '500000', 10);

export async function autoMonitoring(): Promise<void> {
  logger.info('Running auto monitoring', { task: 'auto-monitoring' });
  // TODO: collect system metrics (CPU, memory, error rates) and emit alerts

  // API quota check
  await checkApiQuota();

  logger.info('Auto monitoring completed', { task: 'auto-monitoring' });
}

async function checkApiQuota(): Promise<void> {
  const usageFile = `${OPENCLAW_HOME}/logs/api_usage.log`;
  const today = new Date().toISOString().slice(0, 10);

  try {
    const content = readFileSync(usageFile, 'utf8');
    const todayTokens = content
      .split('\n')
      .filter(line => line.startsWith(today))
      .reduce((sum, line) => {
        const parts = line.trim().split(/\s+/);
        return sum + (parseInt(parts[parts.length - 1] ?? '0', 10) || 0);
      }, 0);

    if (todayTokens > API_DAILY_TOKEN_THRESHOLD) {
      logger.warn(`API daily token usage ${todayTokens} exceeds threshold ${API_DAILY_TOKEN_THRESHOLD}`, {
        task: 'auto-monitoring',
        todayTokens,
        threshold: API_DAILY_TOKEN_THRESHOLD,
      });
    } else {
      logger.debug(`API usage today: ${todayTokens} tokens`, { task: 'auto-monitoring' });
    }
  } catch {
    logger.debug('API usage log not found, skipping quota check', { task: 'auto-monitoring' });
  }
}
