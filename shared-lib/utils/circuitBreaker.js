const logger = require('./logger');
const { ServiceError } = require('../errors');

/**
 * Estados del Circuit Breaker
 */
const CircuitState = {
  CLOSED: 'CLOSED',   // Operación normal - permite solicitudes
  OPEN: 'OPEN',       // Estado de fallo - bloquea solicitudes
  HALF_OPEN: 'HALF_OPEN', // Modo de prueba - permite solicitudes limitadas
};

/**
 * Implementación de Circuit Breaker
 * Patrón para prevenir fallos en cascada al detectar fallas en servicios externos
 */
class CircuitBreaker {
  /**
   * Constructor
   * @param {Function} request - Función que se ejecutará (debe devolver Promise)
   * @param {Object} options - Opciones de configuración
   */
  constructor(request, options = {}) {
    this.request = request;
    this.state = CircuitState.CLOSED;
    this.failureThreshold = options.failureThreshold || 5;
    this.failureCount = 0;
    this.resetTimeout = options.resetTimeout || 30000; // 30 segundos
    this.lastFailureTime = null;
    this.successThreshold = options.successThreshold || 2;
    this.successCount = 0;
    this.timeout = options.timeout || 10000; // 10 segundos
    this.fallbackFn = options.fallback || null;
    this.name = options.name || 'service';
    this.isFailure = options.isFailure || this._defaultIsFailure;
    
    logger.debug(`Circuit Breaker iniciado para ${this.name} en estado ${this.state}`);
  }

  /**
   * Función por defecto para determinar si una respuesta es un fallo
   * @param {Error} error - Error que se produjo
   * @returns {boolean} - Verdadero si es un fallo
   */
  _defaultIsFailure(error) {
    return error !== null && error !== undefined;
  }

  /**
   * Ejecuta la función encapsulada en el Circuit Breaker
   * @param  {...any} args - Argumentos para pasar a la función
   * @returns {Promise} - Resultado de la función
   */
  async fire(...args) {
    if (this.state === CircuitState.OPEN) {
      // Verificar si el tiempo de reseteo ha pasado
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.resetTimeout) {
        this._toHalfOpen();
      } else {
        return this._handleOpenCircuit();
      }
    }

    try {
      // Ejecutar la función con tiempo límite
      const result = await this._executeWithTimeout(args);
      
      this._handleSuccess();
      return result;
    } catch (error) {
      return this._handleFailure(error);
    }
  }

  /**
   * Ejecuta la función con un límite de tiempo
   * @param {Array} args - Argumentos para la función
   * @returns {Promise} - Resultado de la función
   */
  async _executeWithTimeout(args) {
    return Promise.race([
      this.request(...args),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timed out after ${this.timeout}ms`));
        }, this.timeout);
      })
    ]);
  }

  /**
   * Maneja el caso de éxito en la ejecución
   */
  _handleSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.successThreshold) {
        this._toClose();
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Resetear contador de fallos en caso de éxito
      this.failureCount = 0;
    }
  }

  /**
   * Maneja el caso de fallo en la ejecución
   * @param {Error} error - Error producido
   * @returns {*} - Resultado del fallback o error
   */
  _handleFailure(error) {
    // Verificar si se considera un fallo según la función personalizada
    if (this.isFailure(error)) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      logger.warn(`Fallo en Circuit Breaker ${this.name}: ${error.message}. Conteo: ${this.failureCount}/${this.failureThreshold}`);
      
      if (this.state === CircuitState.CLOSED && this.failureCount >= this.failureThreshold) {
        this._toOpen();
      } else if (this.state === CircuitState.HALF_OPEN) {
        this._toOpen();
      }
    }

    if (this.fallbackFn) {
      return this.fallbackFn(error);
    }
    
    throw error;
  }

  /**
   * Maneja el caso cuando el circuito está abierto
   * @returns {*} - Resultado del fallback o error
   */
  _handleOpenCircuit() {
    const openCircuitError = new ServiceError(
      `Circuit Breaker está abierto para ${this.name}. El servicio no está disponible temporalmente.`,
      {
        service: this.name,
        state: this.state,
        lastFailure: this.lastFailureTime,
        resetTimeout: this.resetTimeout,
      }
    );
    
    logger.warn(`Circuit Breaker en estado OPEN para ${this.name}. Bloqueando solicitud.`);
    
    if (this.fallbackFn) {
      return this.fallbackFn(openCircuitError);
    }
    
    throw openCircuitError;
  }

  /**
   * Cambia el estado a abierto
   */
  _toOpen() {
    logger.info(`Circuit Breaker ${this.name} cambiando a estado OPEN`);
    this.state = CircuitState.OPEN;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = Date.now();
  }

  /**
   * Cambia el estado a semi-abierto
   */
  _toHalfOpen() {
    logger.info(`Circuit Breaker ${this.name} cambiando a estado HALF_OPEN`);
    this.state = CircuitState.HALF_OPEN;
    this.failureCount = 0;
    this.successCount = 0;
  }

  /**
   * Cambia el estado a cerrado
   */
  _toClose() {
    logger.info(`Circuit Breaker ${this.name} cambiando a estado CLOSED`);
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  /**
   * Resetea el estado del Circuit Breaker
   */
  reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    logger.info(`Circuit Breaker ${this.name} reseteado a estado CLOSED`);
  }
}

module.exports = {
  CircuitBreaker,
  CircuitState
};