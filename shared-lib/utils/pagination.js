/**
 * Funciones de utilidad para paginación
 */

/**
 * Configura los parámetros de paginación para consultas
 * @param {Object} query - Objeto de consulta HTTP
 * @returns {Object} - Configuración de paginación
 */
const getPaginationParams = (query) => {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    
    return {
      page,
      limit,
      skip
    };
  };
  
  /**
   * Genera información de paginación para incluir en la respuesta
   * @param {number} page - Número de página actual
   * @param {number} limit - Límite de elementos por página
   * @param {number} totalItems - Total de elementos
   * @returns {Object} - Información de paginación
   */
  const getPaginationInfo = (page, limit, totalItems) => {
    const totalPages = Math.ceil(totalItems / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    return {
      totalItems,
      totalPages,
      currentPage: page,
      itemsPerPage: limit,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null
    };
  };
  
  /**
   * Crea links HATEOAS para paginación
   * @param {string} baseUrl - URL base para los links
   * @param {number} page - Número de página actual
   * @param {number} limit - Límite de elementos por página
   * @param {number} totalItems - Total de elementos
   * @param {Object} query - Parámetros de consulta adicionales
   * @returns {Object} - Links HATEOAS
   */
  const getPaginationLinks = (baseUrl, page, limit, totalItems, query = {}) => {
    const totalPages = Math.ceil(totalItems / limit);
    
    // Copia y limpia los parámetros de consulta
    const queryParams = { ...query };
    delete queryParams.page;
    delete queryParams.limit;
    
    // Convierte los parámetros restantes a una cadena de consulta
    let queryString = Object.entries(queryParams)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    
    if (queryString) {
      queryString = `&${queryString}`;
    }
    
    // Genera los enlaces de paginación
    const links = {
      self: `${baseUrl}?page=${page}&limit=${limit}${queryString}`,
      first: `${baseUrl}?page=1&limit=${limit}${queryString}`,
      last: totalPages > 0 ? `${baseUrl}?page=${totalPages}&limit=${limit}${queryString}` : null
    };
    
    if (page < totalPages) {
      links.next = `${baseUrl}?page=${page + 1}&limit=${limit}${queryString}`;
    }
    
    if (page > 1) {
      links.prev = `${baseUrl}?page=${page - 1}&limit=${limit}${queryString}`;
    }
    
    return links;
  };
  
  /**
   * Genera la respuesta paginada completa
   * @param {Array} data - Datos a paginar
   * @param {number} page - Número de página actual
   * @param {number} limit - Límite de elementos por página
   * @param {number} totalItems - Total de elementos
   * @param {string} baseUrl - URL base para los links
   * @param {Object} query - Parámetros de consulta adicionales
   * @returns {Object} - Respuesta paginada
   */
  const getPaginatedResponse = (data, page, limit, totalItems, baseUrl, query = {}) => {
    return {
      data,
      pagination: getPaginationInfo(page, limit, totalItems),
      links: getPaginationLinks(baseUrl, page, limit, totalItems, query)
    };
  };
  
  module.exports = {
    getPaginationParams,
    getPaginationInfo,
    getPaginationLinks,
    getPaginatedResponse
  };