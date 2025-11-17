import { Injectable, Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes to close from half-open
  timeout: number; // Time in ms before trying again
  monitoringPeriod: number; // Time window for failure counting
}

/**
 * Circuit Breaker pattern implementation
 * Prevents cascading failures when downstream services are down
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private circuits: Map<
    string,
    {
      state: CircuitState;
      failureCount: number;
      successCount: number;
      lastFailureTime: number;
      nextAttemptTime: number;
    }
  > = new Map();

  private readonly defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000, // 1 minute
    monitoringPeriod: 120000, // 2 minutes
  };

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(
    circuitName: string,
    fn: () => Promise<T>,
    config: Partial<CircuitBreakerConfig> = {}
  ): Promise<T> {
    const circuitConfig = { ...this.defaultConfig, ...config };
    const circuit = this.getOrCreateCircuit(circuitName);

    // Check if circuit is open
    if (circuit.state === CircuitState.OPEN) {
      if (Date.now() < circuit.nextAttemptTime) {
        const error = new Error(
          `Circuit breaker [${circuitName}] is OPEN. Service temporarily unavailable.`
        );
        this.logger.warn(error.message);
        throw error;
      }

      // Timeout elapsed, try half-open
      circuit.state = CircuitState.HALF_OPEN;
      circuit.successCount = 0;
      this.logger.log(`Circuit breaker [${circuitName}] entering HALF_OPEN state`);
    }

    try {
      const result = await fn();

      // Success
      this.onSuccess(circuitName, circuitConfig);
      return result;
    } catch (error) {
      // Failure
      this.onFailure(circuitName, circuitConfig);
      throw error;
    }
  }

  /**
   * Check if circuit is allowing requests
   */
  isOpen(circuitName: string): boolean {
    const circuit = this.circuits.get(circuitName);
    if (!circuit) return false;

    return (
      circuit.state === CircuitState.OPEN &&
      Date.now() < circuit.nextAttemptTime
    );
  }

  /**
   * Get circuit state
   */
  getState(circuitName: string): CircuitState {
    const circuit = this.circuits.get(circuitName);
    return circuit?.state || CircuitState.CLOSED;
  }

  /**
   * Manually reset circuit
   */
  reset(circuitName: string): void {
    const circuit = this.circuits.get(circuitName);
    if (circuit) {
      circuit.state = CircuitState.CLOSED;
      circuit.failureCount = 0;
      circuit.successCount = 0;
      circuit.nextAttemptTime = 0;
      this.logger.log(`Circuit breaker [${circuitName}] manually reset`);
    }
  }

  /**
   * Get all circuit statuses
   */
  getAllCircuitStatuses(): Record<string, any> {
    const statuses: Record<string, any> = {};
    this.circuits.forEach((circuit, name) => {
      statuses[name] = {
        state: circuit.state,
        failureCount: circuit.failureCount,
        successCount: circuit.successCount,
        lastFailureTime: circuit.lastFailureTime
          ? new Date(circuit.lastFailureTime).toISOString()
          : null,
        nextAttemptTime: circuit.nextAttemptTime
          ? new Date(circuit.nextAttemptTime).toISOString()
          : null,
      };
    });
    return statuses;
  }

  private getOrCreateCircuit(name: string) {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, {
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
      });
    }
    return this.circuits.get(name)!;
  }

  private onSuccess(circuitName: string, config: CircuitBreakerConfig): void {
    const circuit = this.circuits.get(circuitName)!;

    if (circuit.state === CircuitState.HALF_OPEN) {
      circuit.successCount++;

      if (circuit.successCount >= config.successThreshold) {
        circuit.state = CircuitState.CLOSED;
        circuit.failureCount = 0;
        circuit.successCount = 0;
        this.logger.log(`Circuit breaker [${circuitName}] closed after recovery`);
      }
    } else if (circuit.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      circuit.failureCount = 0;
    }
  }

  private onFailure(circuitName: string, config: CircuitBreakerConfig): void {
    const circuit = this.circuits.get(circuitName)!;
    circuit.failureCount++;
    circuit.lastFailureTime = Date.now();

    // Reset old failures outside monitoring period
    if (
      circuit.lastFailureTime &&
      Date.now() - circuit.lastFailureTime > config.monitoringPeriod
    ) {
      circuit.failureCount = 1;
    }

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Failed during testing, go back to open
      circuit.state = CircuitState.OPEN;
      circuit.nextAttemptTime = Date.now() + config.timeout;
      this.logger.warn(
        `Circuit breaker [${circuitName}] reopened after failure in HALF_OPEN state`
      );
    } else if (circuit.failureCount >= config.failureThreshold) {
      // Too many failures, open the circuit
      circuit.state = CircuitState.OPEN;
      circuit.nextAttemptTime = Date.now() + config.timeout;
      this.logger.error(
        `Circuit breaker [${circuitName}] opened after ${circuit.failureCount} failures`
      );
    }
  }
}
