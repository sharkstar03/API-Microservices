const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

// Configuración de conexión a MySQL
const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE || 'products',
  process.env.MYSQL_USER || 'root',
  process.env.MYSQL_PASSWORD || 'root_password',
  {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    dialect: 'mysql',
    logging: (msg) => logger.debug(msg),
    dialectOptions: {
      // Configuraciones específicas para MySQL
      dateStrings: true,
      typeCast: true,
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

// Importar modelos
const ProductModel = require('./product')(sequelize);
const CategoryModel = require('./category')(sequelize);
const InventoryModel = require('./inventory')(sequelize);
const ImageModel = require('./image')(sequelize);
const ReviewModel = require('./review')(sequelize);

// Definir relaciones entre modelos
CategoryModel.hasMany(ProductModel, { as: 'products', foreignKey: 'categoryId' });
ProductModel.belongsTo(CategoryModel, { as: 'category', foreignKey: 'categoryId' });

ProductModel.hasMany(ImageModel, { as: 'images', foreignKey: 'productId' });
ImageModel.belongsTo(ProductModel, { as: 'product', foreignKey: 'productId' });

ProductModel.hasOne(InventoryModel, { as: 'inventory', foreignKey: 'productId' });
InventoryModel.belongsTo(ProductModel, { as: 'product', foreignKey: 'productId' });

ProductModel.hasMany(ReviewModel, { as: 'reviews', foreignKey: 'productId' });
ReviewModel.belongsTo(ProductModel, { as: 'product', foreignKey: 'productId' });

// Exportar modelos y conexión
module.exports = {
  sequelize,
  Product: ProductModel,
  Category: CategoryModel,
  Inventory: InventoryModel,
  Image: ImageModel,
  Review: ReviewModel,
};