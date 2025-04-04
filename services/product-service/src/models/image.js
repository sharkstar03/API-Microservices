const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Image = sequelize.define('Image', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    thumbnailUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    alt: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    width: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    height: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'File size in bytes',
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Image MIME type',
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    tableName: 'product_images',
    timestamps: true,
    indexes: [
      {
        fields: ['productId'],
      },
      {
        fields: ['isPrimary'],
      },
    ],
    hooks: {
      beforeCreate: async (image, options) => {
        // Si esta imagen se marca como primaria, desmarcar otras imágenes primarias del mismo producto
        if (image.isPrimary) {
          await sequelize.models.Image.update(
            { isPrimary: false },
            { 
              where: { 
                productId: image.productId,
                isPrimary: true,
              },
              transaction: options.transaction,
            }
          );
        }
      },
      beforeUpdate: async (image, options) => {
        // Si esta imagen se marca como primaria, desmarcar otras imágenes primarias del mismo producto
        if (image.changed('isPrimary') && image.isPrimary) {
          await sequelize.models.Image.update(
            { isPrimary: false },
            { 
              where: { 
                productId: image.productId,
                id: { [sequelize.Sequelize.Op.ne]: image.id },
                isPrimary: true,
              },
              transaction: options.transaction,
            }
          );
        }
      },
    },
  });

  return Image;
};