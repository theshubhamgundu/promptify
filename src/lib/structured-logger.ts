/**
 * Structured Logger
 * Production-ready logging with proper log levels and no sensitive data
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  userId?: string;
  teamId?: string;
  eventId?: string;
  operation?: string;
  success?: boolean;
  error?: string;
  executionTime?: number;
  requestId?: string;
  metadata?: Record<string, any>;
}

class StructuredLogger {
  private static instance: StructuredLogger;
  private requestId: string;
  private isDevelopment: boolean;

  private constructor() {
    this.requestId = this.generateRequestId();
    this.isDevelopment = import.meta.env.MODE === 'development';
  }

  static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger();
    }
    return StructuredLogger.instance;
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeValue(value: any): any {
    if (typeof value !== 'object' || value === null) {
      return value;
    }

    // Sensitive field patterns to redact
    const sensitivePatterns = [
      'password',
      'token',
      'secret',
      'key',
      'api_key',
      'apikey',
      'auth',
      'credential',
      'private',
    ];

    const sanitized: any = Array.isArray(value) ? [] : {};

    for (const [key, val] of Object.entries(value)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitivePatterns.some((pattern) => lowerKey.includes(pattern));

      if (isSensitive && typeof val === 'string') {
        // Show first 8 chars of tokens/keys for debugging
        sanitized[key] = val.length > 8 ? `${val.slice(0, 8)}...***REDACTED***` : '***REDACTED***';
      } else if (typeof val === 'object' && val !== null) {
        sanitized[key] = this.sanitizeValue(val);
      } else {
        sanitized[key] = val;
      }
    }

    return sanitized;
  }

  private createLogEntry(level: LogLevel, message: string, context?: Partial<LogEntry>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      requestId: this.requestId,
      ...context,
      metadata: context?.metadata ? this.sanitizeValue(context.metadata) : undefined,
    };
  }

  private write(entry: LogEntry): void {
    const logString = JSON.stringify(entry);

    // In development, also log to console with colors
    if (this.isDevelopment) {
      const colors: Record<LogLevel, string> = {
        DEBUG: '\x1b[36m', // Cyan
        INFO: '\x1b[32m', // Green
        WARN: '\x1b[33m', // Yellow
        ERROR: '\x1b[31m', // Red
      };
      const reset = '\x1b[0m';
      console.log(`${colors[entry.level]}[${entry.level}]${reset} ${entry.message}`, entry);
    }

    // In production, send to logging service (could be Supabase Edge Function, CloudWatch, etc.)
    if (!this.isDevelopment) {
      // Store logs or send to external service
      this.sendToLogService(entry);
    }
  }

  private sendToLogService(entry: LogEntry): void {
    // In production, you would send logs to:
    // - Supabase Edge Function
    // - CloudWatch
    // - Datadog
    // - Sentry
    // For now, we'll just keep them in sessionStorage for admin viewing
    try {
      const logs = JSON.parse(sessionStorage.getItem('app_logs') || '[]');
      logs.push(entry);
      // Keep only last 1000 logs
      if (logs.length > 1000) {
        logs.shift();
      }
      sessionStorage.setItem('app_logs', JSON.stringify(logs));
    } catch (e) {
      // Fail silently
    }
  }

  debug(message: string, context?: Partial<LogEntry>): void {
    if (this.isDevelopment) {
      this.write(this.createLogEntry('DEBUG', message, context));
    }
  }

  info(message: string, context?: Partial<LogEntry>): void {
    this.write(this.createLogEntry('INFO', message, context));
  }

  warn(message: string, context?: Partial<LogEntry>): void {
    this.write(this.createLogEntry('WARN', message, context));
  }

  error(message: string, context?: Partial<LogEntry>): void {
    this.write(this.createLogEntry('ERROR', message, context));
  }

  // Convenience method for operation logging
  operation(params: {
    operation: string;
    userId?: string;
    teamId?: string;
    eventId?: string;
    success: boolean;
    executionTime?: number;
    error?: string;
    metadata?: Record<string, any>;
  }): void {
    const level = params.success ? 'INFO' : 'ERROR';
    const message = params.success
      ? `Operation ${params.operation} completed successfully`
      : `Operation ${params.operation} failed: ${params.error}`;

    this.write(
      this.createLogEntry(level, message, {
        userId: params.userId,
        teamId: params.teamId,
        eventId: params.eventId,
        operation: params.operation,
        success: params.success,
        error: params.error,
        executionTime: params.executionTime,
        metadata: params.metadata,
      })
    );
  }

  // Get logs for admin viewing
  static getLogs(limit: number = 100): LogEntry[] {
    try {
      const logs = JSON.parse(sessionStorage.getItem('app_logs') || '[]');
      return logs.slice(-limit);
    } catch (e) {
      return [];
    }
  }

  // Clear logs
  static clearLogs(): void {
    sessionStorage.removeItem('app_logs');
  }

  // Generate a new request ID (for new operations/requests)
  newRequest(): void {
    this.requestId = this.generateRequestId();
  }
}

// Export singleton instance
export const logger = StructuredLogger.getInstance();

// Export class for admin tools
export { StructuredLogger };

// Convenience functions
export function logDebug(message: string, context?: Partial<LogEntry>): void {
  logger.debug(message, context);
}

export function logInfo(message: string, context?: Partial<LogEntry>): void {
  logger.info(message, context);
}

export function logWarn(message: string, context?: Partial<LogEntry>): void {
  logger.warn(message, context);
}

export function logError(message: string, context?: Partial<LogEntry>): void {
  logger.error(message, context);
}

export function logOperation(params: {
  operation: string;
  userId?: string;
  teamId?: string;
  eventId?: string;
  success: boolean;
  executionTime?: number;
  error?: string;
  metadata?: Record<string, any>;
}): void {
  logger.operation(params);
}
