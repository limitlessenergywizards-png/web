import winston from 'winston';
import path from 'path';

// Define custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp, phase }) => {
        const phaseStr = phase ? `[${phase}] ` : '';
        return `${timestamp} ${level}: ${phaseStr}${message}`;
    })
);

// Define custom format for file output (JSON or text)
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp, phase }) => {
        const phaseStr = phase ? `[${phase}] ` : '';
        return `${timestamp} ${level}: ${phaseStr}${message}`;
    })
);

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports: [
        new winston.transports.Console({
            format: consoleFormat
        }),
        new winston.transports.File({
            filename: path.join(process.cwd(), 'logs', 'asavia.log'),
            format: fileFormat
        })
    ]
});

export default logger;
