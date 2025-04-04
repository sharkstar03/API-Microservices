const Ajv = require('ajv');
const { ValidationError } = require('../errors');

// Crear instancia de Ajv con opciones
const ajv = new Ajv({
  allErrors: true,
  removeAdditional: true, // Eliminar propiedades adicionales
  useDefaults: true, // Aplicar valores por defecto
  coerceTypes: true, // Convertir tipos (string a número, etc.)
});

/**
 * Valida datos contra un esquema JSON
 * @param {Object} schema - Esquema JSON
 * @param {Object} data - Datos a validar
 * @returns {Object} - Datos validados
 * @throws {ValidationError} - Si los datos no son válidos
 */
const validateSchema = (schema, data) => {
  const validate = ajv.compile(schema);
  const isValid = validate(data);
  
  if (!isValid) {
    throw new ValidationError('Datos de entrada inválidos', {
      errors: formatAjvErrors(validate.errors)
    });
  }
  
  return data;
};

/**
 * Formatea los errores de AJV en un formato más amigable
 * @param {Array} errors - Errores de AJV
 * @returns {Array} - Errores formateados
 */
const formatAjvErrors = (errors) => {
  return errors.map(error => {
    const path = error.instancePath || '';
    const field = path.replace(/^\//, '') || error.params.missingProperty || 'input';
    
    let message = error.message || 'Error de validación';
    
    // Personalizar mensajes para tipos específicos de error
    switch (error.keyword) {
      case 'required':
        message = `El campo '${error.params.missingProperty}' es requerido`;
        break;
      case 'type':
        message = `El campo debe ser de tipo ${error.params.type}`;
        break;
      case 'enum':
        message = `El valor debe ser uno de: ${error.params.allowedValues.join(', ')}`;
        break;
      case 'format':
        message = `El formato es inválido (${error.params.format})`;
        break;
      case 'minimum':
        message = `El valor debe ser mayor o igual a ${error.params.limit}`;
        break;
      case 'maximum':
        message = `El valor debe ser menor o igual a ${error.params.limit}`;
        break;
      case 'minLength':
        message = `La longitud mínima es ${error.params.limit}`;
        break;
      case 'maxLength':
        message = `La longitud máxima es ${error.params.limit}`;
        break;
      case 'pattern':
        message = `El valor no coincide con el patrón requerido`;
        break;
    }
    
    return {
      field,
      message,
      path: error.instancePath,
      keyword: error.keyword,
      params: error.params
    };
  });
};

/**
 * Esquemas predefinidos para validaciones comunes
 */
const schemas = {
  // Usuario
  userCreate: {
    type: 'object',
    required: ['userId', 'email', 'name'],
    properties: {
      userId: { type: 'string', minLength: 1 },
      email: { type: 'string', format: 'email' },
      name: { type: 'string', minLength: 2 },
      role: { type: 'string', enum: ['user', 'admin', 'premium'] },
    },
    additionalProperties: false
  },
  
  userUpdate: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 2 },
      role: { type: 'string', enum: ['user', 'admin', 'premium'] },
      isActive: { type: 'boolean' },
      preferences: {
        type: 'object',
        properties: {
          language: { type: 'string' },
          theme: { type: 'string' },
          notifications: {
            type: 'object',
            properties: {
              email: { type: 'boolean' },
              push: { type: 'boolean' },
              sms: { type: 'boolean' }
            }
          }
        }
      }
    },
    additionalProperties: false
  },
  
  // Perfil
  profileUpdate: {
    type: 'object',
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      phoneNumber: { type: 'string' },
      dateOfBirth: { type: 'string', format: 'date' },
      gender: { type: 'string', enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
      bio: { type: 'string', maxLength: 500 },
      profession: { type: 'string' },
      company: { type: 'string' },
      website: { type: 'string', format: 'uri' },
      isPublic: { type: 'boolean' },
      socialProfiles: {
        type: 'object',
        properties: {
          facebook: { type: 'string' },
          twitter: { type: 'string' },
          linkedin: { type: 'string' },
          instagram: { type: 'string' }
        }
      }
    },
    additionalProperties: false
  },
  
  // Dirección
  addressCreate: {
    type: 'object',
    required: ['name', 'addressLine1', 'city', 'state', 'postalCode', 'country'],
    properties: {
      type: { type: 'string', enum: ['shipping', 'billing', 'home', 'work', 'other'] },
      isDefault: { type: 'boolean' },
      name: { type: 'string' },
      addressLine1: { type: 'string' },
      addressLine2: { type: 'string' },
      city: { type: 'string' },
      state: { type: 'string' },
      postalCode: { type: 'string' },
      country: { type: 'string' },
      phoneNumber: { type: 'string' },
      instructions: { type: 'string' },
      coordinates: {
        type: 'object',
        properties: {
          latitude: { type: 'number' },
          longitude: { type: 'number' }
        }
      }
    },
    additionalProperties: false
  },
  
  // ID de MongoDB
  mongoId: {
    type: 'string',
    pattern: '^[0-9a-fA-F]{24}$'
  },
  
  // Parámetros de paginación
  pagination: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
      sort: { type: 'string' },
      order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
    }
  }
};

module.exports = {
  validateSchema,
  schemas
};