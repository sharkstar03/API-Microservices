const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Inventory = sequelize.define('Inventory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    reservedQuantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    inStock: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    lowStockThreshold: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      validate: {
        min: 0,
      },
    },
    lastRestockDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    backorderAllowed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    backorderLimit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
      },
    },
    warehouseLocation: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    sku: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    barcode: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    lastUpdatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    tableName: 'inventory',
    timestamps: true,
    indexes: [
      {
        fields: ['productId'],
        unique: true,
      },
      {
        fields: ['sku'],
      },
      {
        fields: ['inStock'],
      },
    ],
    hooks: {
      beforeSave: (inventory) => {
        // Actualizar estado de stock basado en la cantidad
        if (inventory.quantity <= 0) {
          inventory.inStock = false;
        } else {
          inventory.inStock = true;
        }
      },
    },
  });

  // Método para calcular stock disponible (descontando reservas)
  Inventory.prototype.getAvailableStock = function() {
    return Math.max(0, this.quantity - this.reservedQuantity);
  };

  // Método para verificar si el producto está en bajo stock
  Inventory.prototype.isLowStock = function() {
    return this.quantity <= this.lowStockThreshold;
  };

  // Método para reducir inventario (ej: cuando se crea una orden)
  Inventory.prototype.reduceStock = async function(amount, isReserved = false) {
    if (amount <= 0) {
      throw new Error('La cantidad a reducir debe ser mayor que cero');
    }

    if (isReserved) {
      // Si estamos liberando una reserva
      if (this.reservedQuantity < amount) {
        throw new Error('No hay suficiente cantidad reservada para reducir');
      }
      this.reservedQuantity -= amount;
    } else {
      // Si estamos reduciendo el stock real
      if (this.quantity < amount) {
        throw new Error('No hay suficiente stock para reducir');
      }
      this.quantity -= amount;
    }

    return this.save();
  };

  // Método para reservar inventario (ej: cuando se agrega al carrito)
  Inventory.prototype.reserveStock = async function(amount) {
    if (amount <= 0) {
      throw new Error('La cantidad a reservar debe ser mayor que cero');
    }

    if (this.getAvailableStock() < amount) {
      throw new Error('No hay suficiente stock disponible para reservar');
    }

    this.reservedQuantity += amount;
    return this.save();
  };

  // Método para agregar inventario
  Inventory.prototype.addStock = async function(amount) {
    if (amount <= 0) {
      throw new Error('La cantidad a agregar debe ser mayor que cero');
    }

    this.quantity += amount;
    this.lastRestockDate = new Date();
    return this.save();
  };

  return Inventory;
};