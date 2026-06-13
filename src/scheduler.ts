import cron from 'node-cron';
import { logger } from './logger';
import { runTask, getRunningTasks } from './task-runner';
import { gatewayWatchdog } from './tasks/gateway-watchdog';
import { reflectionPipeline } from './tasks/reflection-pipeline';
import { autoMonitoring } from './tasks/monitoring';
import { memorySync, memoryMaintenancePipeline } from './tasks/memory';
import { backupPrimary, backupSecondary, backupValidation } from './tasks/backup';
import { learningQueueObserver } from './tasks/learning';
import { contextUpdate } from './tasks/context-update';
import { dailyApiReport } from './tasks/api-report';
import { dreamProtocol } from './tasks/dream-protocol';

// ─── Schedule Registry ────────────────────────────────────────────────────────
//
// Optimized schedule (OC-SCHED-OPT-001):
// - Session length check merged into gateway-watchdog
// - Memory optimization merged into memory-sync
// - Memory health check merged into memory-maintenance pipeline
// - All tasks staggered to eliminate top-of-hour pile-up
// - Backup window moved to 23:45 so backup + validation + queue fit cleanly in 00:xx
//
// Final time map:
//   */5        Gateway Watchdog (+ session check)
//   hourly:10  Auto Monitoring (+ API quota check)
//   hourly:25  Memory Sync (+ optimization)
//   hourly:45  Reflection Pipeline (reduced to hourly; idle-skip saves ~50% tokens)
//   02:00      Dream Protocol
//   07:00      Context Update (+ disk check)
//   08:00      Daily API Report
//   23:00      Memory Maintenance Pipeline (+ health check)
//   23:45      Backup Primary
//   23:47      Backup Secondary  (2 min gap to prevent I/O collision)
//   00:05      Backup Validation
//   00:20      Learning Queue Observer
// ─────────────────────────────────────────────────────────────────────────────

const TZ = process.env.TZ ?? 'Asia/Shanghai';

const schedules: Array<{ cron: string; name: string; fn: () => Promise<void> }> = [
  // Every 5 minutes — gateway health + session length check
  {
    cron: '*/5 * * * *',
    name: 'gateway-watchdog',
    fn: gatewayWatchdog,
  },

  // Hourly :10 — metrics + API quota alert
  {
    cron: '10 * * * *',
    name: 'auto-monitoring',
    fn: autoMonitoring,
  },

  // Hourly :25 — memory sync + optimization (merged)
  {
    cron: '25 * * * *',
    name: 'memory-sync',
    fn: memorySync,
  },

  // Hourly :45 — reflection pipeline (reduced from every 30min; idle-skip logic inside)
  {
    cron: '45 * * * *',
    name: 'reflection-pipeline',
    fn: reflectionPipeline,
  },

  // Daily 02:00 — Dream Protocol (nightly deep consolidation)
  {
    cron: '0 2 * * *',
    name: 'dream-protocol',
    fn: dreamProtocol,
  },

  // Daily 07:00 — context refresh + disk check
  {
    cron: '0 7 * * *',
    name: 'context-update',
    fn: contextUpdate,
  },

  // Daily 08:00 — API cost/usage daily report
  {
    cron: '0 8 * * *',
    name: 'api-daily-report',
    fn: dailyApiReport,
  },

  // Daily 23:00 — memory maintenance pipeline (health check + sync + optimize)
  {
    cron: '0 23 * * *',
    name: 'memory-maintenance',
    fn: memoryMaintenancePipeline,
  },

  // Daily 23:45 — primary backup (before midnight; gives 15 min before next day tasks)
  {
    cron: '45 23 * * *',
    name: 'backup-primary',
    fn: backupPrimary,
  },
  // Daily 23:47 — secondary backup (2 min after primary to spread I/O)
  {
    cron: '47 23 * * *',
    name: 'backup-secondary',
    fn: backupSecondary,
  },

  // Daily 00:05 — validate last night's backup
  {
    cron: '5 0 * * *',
    name: 'backup-validation',
    fn: backupValidation,
  },

  // Daily 00:20 — learning queue observer (after backup validation confirms data integrity)
  {
    cron: '20 0 * * *',
    name: 'learning-queue',
    fn: learningQueueObserver,
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

// ─── Heartbeat ────────────────────────────────────────────────────────────────

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
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', err => {
  logger.error('Uncaught exception', { err: err.message, stack: err.stack });
});
process.on('unhandledRejection', reason => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

setInterval(logStatus, 10 * 60 * 1000);

start();
