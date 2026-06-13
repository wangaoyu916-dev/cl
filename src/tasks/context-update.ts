import { logger } from '../logger';
import { statfsSync } from 'fs';

const OPENCLAW_HOME = process.env.OPENCLAW_HOME ?? '.';
const DISK_ALERT_THRESHOLD_PCT = parseInt(process.env.DISK_ALERT_THRESHOLD_PCT ?? '85', 10);

export async function contextUpdate(): Promise<void> {
  logger.info('Running daily context update', { task: 'context-update' });
  // TODO: refresh external context sources (knowledge bases, configs, policies)

  await checkDiskUsage();

  logger.info('Context update completed', { task: 'context-update' });
}

async function checkDiskUsage(): Promise<void> {
  try {
    const stats = statfsSync(OPENCLAW_HOME);
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bfree * stats.bsize;
    const usedPct = Math.round(((totalBytes - freeBytes) / totalBytes) * 100);

    if (usedPct > DISK_ALERT_THRESHOLD_PCT) {
      logger.warn(`Disk usage ${usedPct}% exceeds threshold ${DISK_ALERT_THRESHOLD_PCT}%`, {
        task: 'context-update',
        usedPct,
        freeGb: Math.round(freeBytes / 1024 / 1024 / 1024),
      });
    } else {
      logger.debug(`Disk usage: ${usedPct}%`, { task: 'context-update' });
    }
  } catch (err) {
    logger.warn(`Disk check failed: ${String(err)}`, { task: 'context-update' });
  }
}
