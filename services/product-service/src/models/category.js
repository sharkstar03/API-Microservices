const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Category = sequelize.define('Category', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    slug: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
    },
    parentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'categories',
        key: 'id',
      },
    },
    image: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
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
    tableName: 'categories',
    timestamps: true,
    paranoid: true, // Soft delete
    hooks: {
      beforeCreate: (category) => {
        if (!category.slug) {
          // Generar slug a partir del nombre
          category.slug = category.name
            .toLowerCase()
            .replace(/[^\w ]+/g, '')
            .replace(/ +/g, '-');
        }
      },
      beforeUpdate: (category) => {
        if (category.changed('name') && !category.changed('slug')) {
          // Actualizar slug si cambió el nombre
          category.slug = category.name
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
        fields: ['slug'],
        unique: true,
      },
      {
        fields: ['parentId'],
      },
      {
        fields: ['isActive'],
      },
    ],
  });

  // Configuración de asociación propia para categorías padre-hijo
  Category.associate = (models) => {
    Category.hasMany(models.Category, { 
      as: 'children', 
      foreignKey: 'parentId' 
    });
    Category.belongsTo(models.Category, { 
      as: 'parent', 
      foreignKey: 'parentId' 
    });
  };

  // Métodos adicionales
  Category.prototype.toJSON = function() {
    const values = { ...this.get() };
    delete values.deletedAt;
    return values;
  };

  return Category;
};