import { logger } from './logger';

const runningTasks = new Set<string>();

export interface TaskResult {
  success: boolean;
  durationMs: number;
  error?: string;
}

/**
 * Wraps a task with: execution lock (skip if already running), retry logic, timing, and structured logging.
 */
export async function runTask(
  name: string,
  fn: () => Promise<void>,
  options: { maxRetries?: number; retryDelayMs?: number } = {}
): Promise<TaskResult> {
  const { maxRetries = 2, retryDelayMs = 5000 } = options;

  if (runningTasks.has(name)) {
    logger.warn(`Task already running, skipping`, { task: name });
    return { success: false, durationMs: 0, error: 'already_running' };
  }

  runningTasks.add(name);
  const start = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        logger.info(`Retrying (attempt ${attempt}/${maxRetries})`, { task: name });
        await delay(retryDelayMs * attempt);
      }
      await fn();
      const durationMs = Date.now() - start;
      logger.info(`Completed in ${durationMs}ms`, { task: name, durationMs });
      runningTasks.delete(name);
      return { success: true, durationMs };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.error(`Failed (attempt ${attempt}/${maxRetries}): ${lastError.message}`, {
        task: name,
        attempt,
        stack: lastError.stack,
      });
    }
  }

  runningTasks.delete(name);
  const durationMs = Date.now() - start;
  return { success: false, durationMs, error: lastError?.message };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getRunningTasks(): string[] {
  return [...runningTasks];
}
