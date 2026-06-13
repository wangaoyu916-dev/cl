import cron from 'node-cron';
import { logger } from './logger';
import { runTask, getRunningTasks } from './task-runner';
import { gatewayWatchdog } from './tasks/gateway-watchdog';
import { reflectionPipeline, sessionLengthCheck } from './tasks/reflection-pipeline';
import { autoMonitoring } from './tasks/monitoring';
import { memorySync, memoryOptimization, memoryMaintenancePipeline } from './tasks/memory';
import { backupPrimary, backupSecondary, backupValidation } from './tasks/backup';
import { learningQueueObserver } from './tasks/learning';
import { memoryHealthCheck } from './tasks/memory';
import { contextUpdate } from './tasks/context-update';

// ─── Schedule Registry ────────────────────────────────────────────────────────

const TZ = process.env.TZ ?? 'Asia/Shanghai';

const schedules: Array<{ cron: string; name: string; fn: () => Promise<void> }> = [
  // Every 5 minutes
  {
    cron: '*/5 * * * *',
    name: 'gateway-watchdog',
    fn: gatewayWatchdog,
  },

  // Every 30 minutes — staggered by 1 minute to avoid simultaneous load spike
  {
    cron: '*/30 * * * *',
    name: 'reflection-pipeline',
    fn: reflectionPipeline,
  },
  {
    cron: '1-59/30 * * * *',
    name: 'session-length-check',
    fn: sessionLengthCheck,
  },

  // Every hour — staggered at :00, :02, :04 to spread I/O
  {
    cron: '0 * * * *',
    name: 'auto-monitoring',
    fn: autoMonitoring,
  },
  {
    cron: '2 * * * *',
    name: 'memory-sync',
    fn: memorySync,
  },
  {
    cron: '4 * * * *',
    name: 'memory-optimization',
    fn: memoryOptimization,
  },

  // Daily 00:00 — primary backup first, secondary runs 2 min later
  {
    cron: '0 0 * * *',
    name: 'backup-primary',
    fn: backupPrimary,
  },
  {
    cron: '2 0 * * *',
    name: 'backup-secondary',
    fn: backupSecondary,
  },

  // Daily 00:10 — validate last night's backup
  {
    cron: '10 0 * * *',
    name: 'backup-validation',
    fn: backupValidation,
  },

  // Daily 00:15 — learning queue observation (post-backup so data is fresh)
  {
    cron: '15 0 * * *',
    name: 'learning-queue',
    fn: learningQueueObserver,
  },

  // Daily 00:20 — memory health check
  {
    cron: '20 0 * * *',
    name: 'memory-health-check',
    fn: memoryHealthCheck,
  },

  // Daily 07:00 — context update at business start
  {
    cron: '0 7 * * *',
    name: 'context-update',
    fn: contextUpdate,
  },

  // Daily 23:00 — memory maintenance pipeline (before midnight backup window)
  {
    cron: '0 23 * * *',
    name: 'memory-maintenance',
    fn: memoryMaintenancePipeline,
  },
];

// ─── Bootstrap ────────────────────────────────────────────────────────────────

function start(): void {
  logger.info('OpenClaw Scheduler starting', {
    timezone: TZ,
    taskCount: schedules.length,
  });

  for (const { cron: expression, name, fn } of schedules) {
    if (!cron.validate(expression)) {
      logger.error(`Invalid cron expression "${expression}" for task "${name}" — skipping`);
      continue;
    }

    cron.schedule(
      expression,
      () => { void runTask(name, fn); },
      { timezone: TZ, name }
    );

    logger.info(`Registered: ${name}  [${expression}]`);
  }

  logger.info('All tasks registered. Scheduler running.');
}

// ─── Health endpoint ──────────────────────────────────────────────────────────

function logStatus(): void {
  const running = getRunningTasks();
  logger.info('Scheduler heartbeat', {
    uptime: Math.floor(process.uptime()),
    runningTasks: running.length > 0 ? running : 'none',
  });
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

function shutdown(signal: string): void {
  logger.info(`Received ${signal}. Shutting down scheduler gracefully…`);
  // node-cron does not expose a global stop-all API; individual scheduled tasks
  // finish their current run and no new ones are triggered after process exit.
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', err => {
  logger.error('Uncaught exception', { err: err.message, stack: err.stack });
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

// Status heartbeat every 10 minutes
setInterval(logStatus, 10 * 60 * 1000);

start();
