import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitStats {
  failures: number;
  successes: number;
  lastFailureTime?: number;
  state: CircuitState;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuits: Map<string, CircuitStats> = new Map();

  // Configuration
  private readonly failureThreshold = 5; // Open circuit after 5 failures
  private readonly successThreshold = 2; // Close circuit after 2 successes in half-open
  private readonly timeout = 60000; // Wait 60s before attempting half-open
  private readonly resetTimeout = 300000; // Reset stats after 5 minutes of success

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const circuit = this.getOrCreateCircuit(key);

    // Check if circuit is open
    if (circuit.state === CircuitState.OPEN) {
      const timeSinceLastFailure = Date.now() - (circuit.lastFailureTime || 0);

      if (timeSinceLastFailure < this.timeout) {
        this.logger.warn(`Circuit breaker OPEN for ${key}, rejecting request`);

        if (fallback) {
          this.logger.log(`Using fallback for ${key}`);
          return fallback();
        }

        throw new ServiceUnavailableException(
          `Service temporarily unavailable (circuit breaker open for ${key})`
        );
      }

      // Transition to half-open
      circuit.state = CircuitState.HALF_OPEN;
      this.logger.log(`Circuit breaker transitioning to HALF-OPEN for ${key}`);
    }

    try {
      const result = await fn();
      this.onSuccess(key);
      return result;
    } catch (error) {
      this.onFailure(key);

      if (fallback) {
        this.logger.log(`Using fallback for ${key} after error`);
        return fallback();
      }

      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(key: string): void {
    const circuit = this.getOrCreateCircuit(key);
    circuit.successes++;
    circuit.failures = 0;

    if (circuit.state === CircuitState.HALF_OPEN) {
      if (circuit.successes >= this.successThreshold) {
        circuit.state = CircuitState.CLOSED;
        this.logger.log(`Circuit breaker CLOSED for ${key}`);
      }
    }

    // Reset stats after sustained success
    if (circuit.state === CircuitState.CLOSED && circuit.successes > 10) {
      circuit.successes = 0;
      circuit.failures = 0;
      delete circuit.lastFailureTime;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(key: string): void {
    const circuit = this.getOrCreateCircuit(key);
    circuit.failures++;
    circuit.successes = 0;
    circuit.lastFailureTime = Date.now();

    if (circuit.failures >= this.failureThreshold) {
      circuit.state = CircuitState.OPEN;
      this.logger.error(
        `Circuit breaker OPENED for ${key} after ${circuit.failures} failures`
      );
    }
  }

  /**
   * Get or create circuit for a key
   */
  private getOrCreateCircuit(key: string): CircuitStats {
    if (!this.circuits.has(key)) {
      this.circuits.set(key, {
        failures: 0,
        successes: 0,
        state: CircuitState.CLOSED,
      });
    }

    return this.circuits.get(key)!;
  }

  /**
   * Get circuit state
   */
  getState(key: string): CircuitState {
    return this.getOrCreateCircuit(key).state;
  }

  /**
   * Reset circuit manually
   */
  reset(key: string): void {
    this.circuits.set(key, {
      failures: 0,
      successes: 0,
      state: CircuitState.CLOSED,
    });
    this.logger.log(`Circuit breaker manually reset for ${key}`);
  }

  /**
   * Get all circuit states
   */
  getAllStates(): Record<string, CircuitState> {
    const states: Record<string, CircuitState> = {};
    this.circuits.forEach((circuit, key) => {
      states[key] = circuit.state;
    });
    return states;
  }
}
