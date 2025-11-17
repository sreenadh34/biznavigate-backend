import { Injectable, Logger } from '@nestjs/common';

/**
 * Distributed Tracing Service
 * In production, integrate with OpenTelemetry, Jaeger, or Zipkin
 */

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  tags: Record<string, any>;
  logs: Array<{ timestamp: number; message: string; level: string }>;
  status: 'pending' | 'success' | 'error';
}

@Injectable()
export class TracingService {
  private readonly logger = new Logger(TracingService.name);
  private spans: Map<string, Span> = new Map();

  /**
   * Start a new trace
   */
  startTrace(operationName: string, tags: Record<string, any> = {}): string {
    const traceId = this.generateId();
    const spanId = this.generateId();

    const span: Span = {
      traceId,
      spanId,
      operationName,
      startTime: Date.now(),
      tags: { ...tags },
      logs: [],
      status: 'pending',
    };

    this.spans.set(traceId, span);

    this.logger.debug(`Started trace [${traceId}]: ${operationName}`, tags);

    // TODO: Send to actual tracing backend
    // Example: opentelemetry.startSpan(operationName, { traceId, tags })

    return traceId;
  }

  /**
   * Start a child span within an existing trace
   */
  startSpan(
    traceId: string,
    operationName: string,
    tags: Record<string, any> = {}
  ): string {
    const parentSpan = this.spans.get(traceId);
    if (!parentSpan) {
      this.logger.warn(`Parent trace ${traceId} not found, starting new trace`);
      return this.startTrace(operationName, tags);
    }

    const spanId = this.generateId();
    const span: Span = {
      traceId,
      spanId,
      parentSpanId: parentSpan.spanId,
      operationName,
      startTime: Date.now(),
      tags: { ...tags },
      logs: [],
      status: 'pending',
    };

    this.spans.set(spanId, span);

    this.logger.debug(
      `Started span [${spanId}] in trace [${traceId}]: ${operationName}`,
      tags
    );

    return spanId;
  }

  /**
   * End a trace or span
   */
  endSpan(spanId: string, status: 'success' | 'error' = 'success'): void {
    const span = this.spans.get(spanId);
    if (!span) {
      this.logger.warn(`Span ${spanId} not found`);
      return;
    }

    span.endTime = Date.now();
    span.status = status;

    const duration = span.endTime - span.startTime;

    this.logger.debug(
      `Ended span [${spanId}]: ${span.operationName} (${duration}ms, ${status})`
    );

    // TODO: Send to actual tracing backend
    // Example: opentelemetry.endSpan(span)
  }

  /**
   * Add tags to a span
   */
  addTags(spanId: string, tags: Record<string, any>): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.tags = { ...span.tags, ...tags };
    }
  }

  /**
   * Log an event in a span
   */
  log(spanId: string, message: string, level: string = 'info'): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        message,
        level,
      });
    }
  }

  /**
   * Get span details
   */
  getSpan(spanId: string): Span | undefined {
    return this.spans.get(spanId);
  }

  /**
   * Get all spans for a trace
   */
  getTraceSpans(traceId: string): Span[] {
    return Array.from(this.spans.values()).filter(
      (span) => span.traceId === traceId
    );
  }

  /**
   * Clean up old spans (call periodically)
   */
  cleanup(olderThanMs: number = 3600000): void {
    const cutoff = Date.now() - olderThanMs;
    let cleaned = 0;

    this.spans.forEach((span, id) => {
      if (span.endTime && span.endTime < cutoff) {
        this.spans.delete(id);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} old spans`);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
