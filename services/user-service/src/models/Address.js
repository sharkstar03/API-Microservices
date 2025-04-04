const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['shipping', 'billing', 'home', 'work', 'other'],
      default: 'shipping',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    addressLine1: {
      type: String,
      required: true,
      trim: true,
    },
    addressLine2: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    instructions: {
      type: String,
      trim: true,
    },
    coordinates: {
      latitude: Number,
      longitude: Number,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Crear índices para búsquedas comunes
addressSchema.index({ userId: 1, isDefault: 1 });
addressSchema.index({ userId: 1, type: 1 });
addressSchema.index({ 
  city: 'text', 
  state: 'text', 
  country: 'text', 
  postalCode: 'text' 
});

// Middleware para asegurar que solo hay una dirección por defecto por tipo
addressSchema.pre('save', async function(next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { 
        userId: this.userId, 
        type: this.type, 
        _id: { $ne: this._id } 
      },
      { isDefault: false }
    );
  }
  next();
});

// Método para actualizar dirección
addressSchema.methods.updateDetails = async function(addressData) {
  Object.keys(addressData).forEach(key => {
    if (this.schema.paths[key]) {
      this[key] = addressData[key];
    }
  });
  return this.save();
};

// Método para establecer dirección como predeterminada
addressSchema.methods.setAsDefault = async function() {
  // Primero, desactivar otras direcciones predeterminadas del mismo tipo
  await this.constructor.updateMany(
    { 
      userId: this.userId, 
      type: this.type, 
      isDefault: true,
      _id: { $ne: this._id } 
    },
    { isDefault: false }
  );
  
  // Luego, establecer esta como predeterminada
  this.isDefault = true;
  return this.save();
};

// Método para formatear respuesta
addressSchema.methods.formatResponse = function() {
  return {
    id: this._id,
    type: this.type,
    isDefault: this.isDefault,
    name: this.name,
    addressLine1: this.addressLine1,
    addressLine2: this.addressLine2,
    city: this.city,
    state: this.state,
    postalCode: this.postalCode,
    country: this.country,
    phoneNumber: this.phoneNumber,
    instructions: this.instructions,
    isVerified: this.isVerified,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Address = mongoose.model('Address', addressSchema);

module.exports = Address;