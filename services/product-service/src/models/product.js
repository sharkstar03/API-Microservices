const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Product = sequelize.define('Product', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sku: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    shortDescription: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    salePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0,
      },
    },
    onSale: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    brand: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    weight: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    dimensions: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    attributes: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    tags: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    featuredImage: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isDigital: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    downloadUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    averageRating: {
      type: DataTypes.FLOAT(2, 1),
      defaultValue: 0,
      validate: {
        min: 0,
        max: 5,
      },
    },
    reviewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    metaTitle: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    metaDescription: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    tableName: 'products',
    timestamps: true,
    paranoid: true, // Soft delete
    hooks: {
      beforeCreate: (product) => {
        if (!product.slug) {
          // Generar slug a partir del nombre
          product.slug = product.name
            .toLowerCase()
            .replace(/[^\w ]+/g, '')
            .replace(/ +/g, '-');
        }
      },
      beforeUpdate: (product) => {
        if (product.changed('name') && !product.changed('slug')) {
          // Actualizar slug si cambió el nombre
          product.slug = product.name
            .toLowerCase()
            .replace(/[^\w ]+/g, '')
            .replace(/ +/g, '-');
        }
      },
    },
    indexes: [
      {
        fields: ['name'],
      },
      {
        fields: ['categoryId'],
      },
      {
        fields: ['brand'],
      },
      {
        fields: ['isActive'],
      },
      {
        fields: ['isFeatured'],
      },
      {
        fields: ['slug'],
        unique: true,
      },
    ],
  });

  // Métodos adicionales
  Product.prototype.toJSON = function() {
    const values = { ...this.get() };
    delete values.deletedAt;
    return values;
  };

  return Product;
};