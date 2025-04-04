const { Op } = require('sequelize');
const { Product, Category, Image, Inventory } = require('../models');
const Redis = require('ioredis');
const { publishProductEvent } = require('../messaging/publisher');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// Cliente Redis para caché
const redis = new Redis(process.env.REDIS_URL);
const CACHE_EXPIRATION = 60 * 15; // 15 minutos

/**
 * Obtener todos los productos (con paginación, filtrado y ordenamiento)
 */
exports.getAllProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const category = req.query.category;
    const brand = req.query.brand;
    const minPrice = req.query.minPrice;
    const maxPrice = req.query.maxPrice;
    const sortField = req.query.sortField || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const onlyActive = req.query.onlyActive === 'true';
    
    // Generar clave de caché basada en los parámetros de la solicitud
    const cacheKey = `products:${page}:${limit}:${search}:${category}:${brand}:${minPrice}:${maxPrice}:${sortField}:${sortOrder}:${onlyActive}`;
    
    // Verificar si los resultados están en caché
    const cachedResults = await redis.get(cacheKey);
    if (cachedResults) {
      logger.debug('Resultados obtenidos de caché');
      const parsedResults = JSON.parse(cachedResults);
      return res.status(200).json(parsedResults);
    }
    
    // Construir query
    let whereClause = {};
    
    // Filtro por texto
    if (search) {
      whereClause = {
        ...whereClause,
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
          { sku: { [Op.like]: `%${search}%` } },
        ],
      };
    }
    
    // Filtro por categoría
    if (category) {
      whereClause.categoryId = category;
    }
    
    // Filtro por marca
    if (brand) {
      whereClause.brand = brand;
    }
    
    // Filtro por rango de precios
    if (minPrice || maxPrice) {
      whereClause.price = {};
      if (minPrice) whereClause.price[Op.gte] = minPrice;
      if (maxPrice) whereClause.price[Op.lte] = maxPrice;
    }
    
    // Filtrar productos activos
    if (onlyActive) {
      whereClause.isActive = true;
    }
    
    // Opciones de consulta
    const options = {
      where: whereClause,
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug'],
        },
        {
          model: Image,
          as: 'images',
          attributes: ['id', 'url', 'alt', 'isPrimary'],
          required: false,
        },
        {
          model: Inventory,
          as: 'inventory',
          attributes: ['id', 'quantity', 'inStock'],
          required: false,
        },
      ],
      order: [[sortField, sortOrder]],
      limit,
      offset,
      distinct: true,
    };
    
    // Ejecutar consulta
    const { count, rows } = await Product.findAndCountAll(options);
    
    // Preparar respuesta
    const response = {
      status: 'success',
      results: rows.length,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit),
      },
      data: {
        products: rows,
      },
    };
    
    // Guardar en caché
    await redis.set(cacheKey, JSON.stringify(response), 'EX', CACHE_EXPIRATION);
    
    res.status(200).json(response);
  } catch (error) {
    logger.error('Error al obtener productos:', error);
    next(error);
  }
};

/**
 * Obtener un producto por ID o Slug
 */
exports.getProductById = async (req, res, next) => {
  try {
    const identifier = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    
    // Generar clave de caché
    const cacheKey = `product:${identifier}`;
    
    // Verificar si el producto está en caché
    const cachedProduct = await redis.get(cacheKey);
    if (cachedProduct) {
      logger.debug(`Producto ${identifier} obtenido de caché`);
      const parsedProduct = JSON.parse(cachedProduct);
      return res.status(200).json(parsedProduct);
    }
    
    // Construir query
    const whereClause = isUuid 
      ? { id: identifier }
      : { slug: identifier };
    
    // Buscar producto
    const product = await Product.findOne({
      where: whereClause,
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug'],
        },
        {
          model: Image,
          as: 'images',
          attributes: ['id', 'url', 'alt', 'isPrimary'],
        },
        {
          model: Inventory,
          as: 'inventory',
          attributes: ['id', 'quantity', 'inStock', 'lowStockThreshold'],
        },
      ],
    });
    
    if (!product) {
      return next(new AppError('Producto no encontrado', 404));
    }
    
    // Preparar respuesta
    const response = {
      status: 'success',
      data: {
        product,
      },
    };
    
    // Guardar en caché
    await redis.set(cacheKey, JSON.stringify(response), 'EX', CACHE_EXPIRATION);
    
    res.status(200).json(response);
  } catch (error) {
    logger.error(`Error al obtener producto ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Crear un nuevo producto
 */
exports.createProduct = async (req, res, next) => {
  try {
    const {
      sku,
      name,
      description,
      shortDescription,
      price,
      salePrice,
      onSale,
      categoryId,
      brand,
      weight,
      dimensions,
      attributes,
      tags,
      featuredImage,
      isActive,
      isFeatured,
      isDigital,
      downloadUrl,
      metaTitle,
      metaDescription,
      slug,
      inventory,
      images,
    } = req.body;
    
    // Verificar si el SKU ya existe
    const existingProduct = await Product.findOne({ where: { sku } });
    if (existingProduct) {
      return next(new AppError('Ya existe un producto con este SKU', 409));
    }
    
    // Verificar si la categoría existe
    if (categoryId) {
      const category = await Category.findByPk(categoryId);
      if (!category) {
        return next(new AppError('Categoría no encontrada', 404));
      }
    }
    
    // Crear producto en transacción
    const result = await sequelize.transaction(async (t) => {
      // Crear producto
      const product = await Product.create({
        sku,
        name,
        description,
        shortDescription,
        price,
        salePrice,
        onSale,
        categoryId,
        brand,
        weight,
        dimensions,
        attributes,
        tags,
        featuredImage,
        isActive,
        isFeatured,
        isDigital,
        downloadUrl,
        metaTitle,
        metaDescription,
        slug,
        createdBy: req.user ? req.user.id : null,
      }, { transaction: t });
      
      // Crear inventario si se proporcionó
      if (inventory) {
        await Inventory.create({
          productId: product.id,
          ...inventory,
        }, { transaction: t });
      }
      
      // Crear imágenes si se proporcionaron
      if (images && Array.isArray(images)) {
        const imagePromises = images.map(image => 
          Image.create({
            productId: product.id,
            ...image,
          }, { transaction: t })
        );
        await Promise.all(imagePromises);
      }
      
      return product;
    });
    
    // Obtener producto con relaciones para respuesta
    const product = await Product.findByPk(result.id, {
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug'],
        },
        {
          model: Image,
          as: 'images',
          attributes: ['id', 'url', 'alt', 'isPrimary'],
        },
        {
          model: Inventory,
          as: 'inventory',
          attributes: ['id', 'quantity', 'inStock', 'lowStockThreshold'],
        },
      ],
    });
    
    // Limpiar caché relacionada con productos
    await redis.del('products:*');
    
    // Publicar evento de producto creado
    await publishProductEvent('product.created', {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      price: product.price,
      createdAt: product.createdAt,
    });
    
    res.status(201).json({
      status: 'success',
      data: {
        product,
      },
    });
  } catch (error) {
    logger.error('Error al crear producto:', error);
    next(error);
  }
};

/**
 * Actualizar un producto
 */
exports.updateProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    
    // Verificar si el producto existe
    const product = await Product.findByPk(productId);
    if (!product) {
      return next(new AppError('Producto no encontrado', 404));
    }
    
    // Actualizar en transacción
    await sequelize.transaction(async (t) => {
      // Extraer datos del inventario si se proporcionan
      const { inventory, images, ...productData } = req.body;
      
      // Actualizar producto
      await product.update({
        ...productData,
        updatedBy: req.user ? req.user.id : null,
      }, { transaction: t });
      
      // Actualizar inventario si se proporciona
      if (inventory) {
        const existingInventory = await Inventory.findOne({ 
          where: { productId },
          transaction: t,
        });
        
        if (existingInventory) {
          await existingInventory.update(inventory, { transaction: t });
        } else {
          await Inventory.create({
            productId,
            ...inventory,
          }, { transaction: t });
        }
      }
      
      // Actualizar imágenes si se proporcionan
      if (images && Array.isArray(images)) {
        // Eliminar imágenes existentes
        if (req.body.replaceImages) {
          await Image.destroy({
            where: { productId },
            transaction: t,
          });
        }
        
        // Crear nuevas imágenes
        const imagePromises = images.map(image => {
          if (image.id) {
            // Actualizar imagen existente
            return Image.update(
              { ...image },
              { 
                where: { id: image.id, productId },
                transaction: t,
              }
            );
          } else {
            // Crear nueva imagen
            return Image.create({
              productId,
              ...image,
            }, { transaction: t });
          }
        });
        
        await Promise.all(imagePromises);
      }
    });
    
    // Obtener producto actualizado con relaciones
    const updatedProduct = await Product.findByPk(productId, {
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug'],
        },
        {
          model: Image,
          as: 'images',
          attributes: ['id', 'url', 'alt', 'isPrimary'],
        },
        {
          model: Inventory,
          as: 'inventory',
          attributes: ['id', 'quantity', 'inStock', 'lowStockThreshold'],
        },
      ],
    });
    
    // Limpiar caché
    await redis.del(`product:${productId}`);
    await redis.del(`product:${product.slug}`);
    await redis.del('products:*');
    
    // Publicar evento de producto actualizado
    await publishProductEvent('product.updated', {
      productId: updatedProduct.id,
      sku: updatedProduct.sku,
      name: updatedProduct.name,
      price: updatedProduct.price,
      updatedAt: updatedProduct.updatedAt,
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Producto eliminado correctamente',
    });
  } catch (error) {
    logger.error(`Error al eliminar producto ${req.params.id}:`, error);
    next(error);
  }
};
      data: {
        product: updatedProduct,
      },
    });
  } catch (error) {
    logger.error(`Error al actualizar producto ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Eliminar un producto (soft delete)
 */
exports.deleteProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    
    // Verificar si el producto existe
    const product = await Product.findByPk(productId);
    if (!product) {
      return next(new AppError('Producto no encontrado', 404));
    }
    
    // Soft delete
    await product.destroy();
    
    // Limpiar caché
    await redis.del(`product:${productId}`);
    await redis.del(`product:${product.slug}`);
    await redis.del('products:*');
    
    // Publicar evento de producto eliminado
    await publishProductEvent('product.deleted', {
      productId: product.id,
      sku: product.sku,
      deletedAt: new Date().toISOString(),
    });
    
    res.status(200).json({
      status: 'success',