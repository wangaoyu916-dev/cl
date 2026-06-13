import { createLogger, format, transports } from 'winston';

export const logger = createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, task, ...meta }) => {
      const taskLabel = task ? `[${task}]` : '';
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} ${level.toUpperCase()} ${taskLabel} ${message}${metaStr}`;
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: 'logs/scheduler-error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
    new transports.File({
      filename: 'logs/scheduler.log',
      maxsize: 50 * 1024 * 1024,
      maxFiles: 10,
    }),
  ],
});
