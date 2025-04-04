/**
 * Biblioteca compartida para los microservicios
 * Contiene utilidades, middlewares y modelos comunes
 */

// Exportar utilidades
const utils = require('./utils');
const middlewares = require('./middlewares');
const errors = require('./errors');
const validators = require('./validators');

module.exports = {
  utils,
  middlewares,
  errors,
  validators,
};