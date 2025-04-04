const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Review = sequelize.define('Review', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5,
      },
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    isVerifiedPurchase: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isApproved: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isHelpful: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    isNotHelpful: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    images: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    adminResponse: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    adminResponseDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    moderatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    moderationDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    moderationNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ipAddress: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  }, {
    tableName: 'product_reviews',
    timestamps: true,
    indexes: [
      {
        fields: ['productId'],
      },
      {
        fields: ['userId'],
      },
      {
        fields: ['rating'],
      },
      {
        fields: ['isApproved'],
      },
      {
        fields: ['isVerifiedPurchase'],
      },
    ],
    hooks: {
      afterCreate: async (review, options) => {
        // Actualizar el promedio de calificación y el conteo de reseñas del producto
        await updateProductRatingStats(review.productId, options.transaction);
      },
      afterUpdate: async (review, options) => {
        // Si cambió la calificación o la aprobación, actualizar estadísticas del producto
        if (review.changed('rating') || review.changed('isApproved')) {
          await updateProductRatingStats(review.productId, options.transaction);
        }
      },
      afterDestroy: async (review, options) => {
        // Actualizar estadísticas del producto después de eliminar una reseña
        await updateProductRatingStats(review.productId, options.transaction);
      },
    },
  });

  // Función para actualizar las estadísticas de calificación del producto
  async function updateProductRatingStats(productId, transaction) {
    const { Product } = sequelize.models;
    
    // Calcular el promedio de calificación y el conteo de reseñas aprobadas
    const [results] = await sequelize.query(`
      SELECT 
        COUNT(*) as reviewCount,
        ROUND(AVG(rating), 1) as averageRating
      FROM product_reviews
      WHERE productId = :productId AND isApproved = true
    `, {
      replacements: { productId },
      type: sequelize.QueryTypes.SELECT,
      transaction,
    });

    // Actualizar el producto con las nuevas estadísticas
    await Product.update({
      reviewCount: results.reviewCount || 0,
      averageRating: results.averageRating || 0,
    }, {
      where: { id: productId },
      transaction,
    });
  }

  return Review;
};