import { Injectable, Logger } from '@nestjs/common';

/**
 * Metrics Service for tracking business and technical metrics
 * In production, integrate with Prometheus, Datadog, or similar
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private metrics: Map<string, number> = new Map();
  private counters: Map<string, number> = new Map();

  /**
   * Record a metric value
   */
  recordMetric(name: string, value: number, tags: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, tags);
    this.metrics.set(key, value);

    // TODO: Send to actual metrics backend
    // Example: prometheus.gauge(name, value, tags)
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, tags: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + 1);

    // TODO: Send to actual metrics backend
    // Example: prometheus.counter(name).inc(tags)
  }

  /**
   * Record timing/duration
   */
  recordTiming(name: string, durationMs: number, tags: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, tags);
    this.metrics.set(`${key}.duration_ms`, durationMs);

    // TODO: Send to actual metrics backend
    // Example: prometheus.histogram(name, durationMs, tags)

    this.logger.debug(`Timing [${name}]: ${durationMs}ms`, tags);
  }

  /**
   * Record processing success
   */
  recordSuccess(operation: string, tags: Record<string, string> = {}): void {
    this.incrementCounter(`${operation}.success`, tags);
  }

  /**
   * Record processing failure
   */
  recordFailure(operation: string, error: string, tags: Record<string, string> = {}): void {
    this.incrementCounter(`${operation}.failure`, { ...tags, error });
  }

  /**
   * Get current metric value
   */
  getMetric(name: string, tags: Record<string, string> = {}): number | undefined {
    const key = this.getMetricKey(name, tags);
    return this.metrics.get(key) || this.counters.get(key);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, number> {
    const all: Record<string, number> = {};

    this.metrics.forEach((value, key) => {
      all[key] = value;
    });

    this.counters.forEach((value, key) => {
      all[key] = value;
    });

    return all;
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.metrics.clear();
    this.counters.clear();
  }

  private getMetricKey(name: string, tags: Record<string, string>): string {
    if (Object.keys(tags).length === 0) {
      return name;
    }

    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');

    return `${name}{${tagStr}}`;
  }
}

/**
 * Business Metrics specifically for WhatsApp message processing
 */
@Injectable()
export class WhatsAppMetricsService {
  constructor(private readonly metrics: MetricsService) {}

  /**
   * Track message received
   */
  trackMessageReceived(businessId: string, source: string = 'whatsapp'): void {
    this.metrics.incrementCounter('whatsapp.messages.received', {
      business_id: businessId,
      source,
    });
  }

  /**
   * Track AI processing time
   */
  trackAiProcessingTime(durationMs: number, intent: string): void {
    this.metrics.recordTiming('ai.processing.duration', durationMs, { intent });
  }

  /**
   * Track intent detection
   */
  trackIntentDetected(intent: string, confidence: number): void {
    this.metrics.incrementCounter('ai.intent.detected', { intent });
    this.metrics.recordMetric('ai.intent.confidence', confidence, { intent });
  }

  /**
   * Track action execution
   */
  trackActionExecuted(action: string, success: boolean): void {
    const status = success ? 'success' : 'failure';
    this.metrics.incrementCounter('whatsapp.action.executed', { action, status });
  }

  /**
   * Track response sent
   */
  trackResponseSent(channel: string, success: boolean): void {
    const status = success ? 'success' : 'failure';
    this.metrics.incrementCounter('whatsapp.response.sent', { channel, status });
  }

  /**
   * Track lead state change
   */
  trackLeadStateChange(fromState: string, toState: string): void {
    this.metrics.incrementCounter('lead.state.changed', {
      from: fromState,
      to: toState,
    });
  }

  /**
   * Track DLQ message
   */
  trackDeadLetterQueue(reason: string): void {
    this.metrics.incrementCounter('message.dlq', { reason });
  }

  /**
   * Track circuit breaker state
   */
  trackCircuitBreakerState(circuit: string, state: string): void {
    this.metrics.incrementCounter('circuit_breaker.state', { circuit, state });
  }
}
