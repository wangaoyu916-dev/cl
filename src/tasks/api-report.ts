import { logger } from '../logger';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OPENCLAW_HOME = process.env.OPENCLAW_HOME ?? '.';

export async function dailyApiReport(): Promise<void> {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const usageFile = join(OPENCLAW_HOME, 'logs', 'api_usage.log');
  const reportsDir = join(OPENCLAW_HOME, 'logs', 'reports');

  logger.info(`Generating API daily report for ${yesterday}`, { task: 'api-report' });

  let lines: string[] = [];
  try {
    lines = readFileSync(usageFile, 'utf8')
      .split('\n')
      .filter(l => l.startsWith(yesterday));
  } catch {
    logger.warn('API usage log not found, report will be empty', { task: 'api-report' });
  }

  const totalTokens = lines.reduce((sum, line) => {
    const parts = line.trim().split(/\s+/);
    return sum + (parseInt(parts[parts.length - 1] ?? '0', 10) || 0);
  }, 0);
  const callCount = lines.length;
  const avgTokens = callCount > 0 ? Math.round(totalTokens / callCount) : 0;

  const report = [
    `=== API 日报 ${yesterday} ===`,
    `总调用次数: ${callCount}`,
    `总 Token 消耗: ${totalTokens}`,
    `平均单次 Token: ${avgTokens}`,
    '',
  ].join('\n');

  try {
    mkdirSync(reportsDir, { recursive: true });
    writeFileSync(join(reportsDir, `api_report_${yesterday}.log`), report);
  } catch (err) {
    logger.warn(`Could not write report file: ${String(err)}`, { task: 'api-report' });
  }

  logger.info(report.replace(/\n/g, ' | '), { task: 'api-report', callCount, totalTokens });
}
