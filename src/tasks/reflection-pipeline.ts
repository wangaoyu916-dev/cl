import { logger } from '../logger';
import { statSync } from 'fs';

const ACTIVITY_LOG = process.env.ACTIVITY_LOG_PATH ?? `${process.env.OPENCLAW_HOME ?? '.'}/logs/activity.log`;
const IDLE_THRESHOLD_MS = parseInt(process.env.REFLECTION_IDLE_THRESHOLD_MS ?? '3600000', 10); // 1 hour

export async function reflectionPipeline(): Promise<void> {
  // Skip when idle: if activity log hasn't been touched within IDLE_THRESHOLD_MS,
  // no conversations occurred — saves ~50% token usage on low-traffic hours
  try {
    const { mtimeMs } = statSync(ACTIVITY_LOG);
    const idleMs = Date.now() - mtimeMs;
    if (idleMs > IDLE_THRESHOLD_MS) {
      logger.info(`No activity for ${Math.round(idleMs / 60000)}min — skipping reflection`, {
        task: 'reflection-pipeline',
        idleMs,
      });
      return;
    }
  } catch {
    // Activity log doesn't exist yet — assume active to avoid skipping on fresh installs
    logger.debug('Activity log not found, proceeding with reflection', { task: 'reflection-pipeline' });
  }

  logger.info('Starting reflection pipeline', { task: 'reflection-pipeline' });
  // TODO: analyze recent interactions and update strategy
  logger.info('Reflection pipeline completed', { task: 'reflection-pipeline' });
}
