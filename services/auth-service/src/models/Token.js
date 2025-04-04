const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['refresh', 'reset', 'verification'],
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    userAgent: String,
    ipAddress: String,
  },
  {
    timestamps: true,
  }
);

// Índice para ayudar en la limpieza de tokens expirados
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Índice para búsquedas rápidas por usuario y tipo
tokenSchema.index({ userId: 1, type: 1 });

// Índice para búsquedas rápidas por token
tokenSchema.index({ token: 1 });

// Método estático para encontrar un token válido
tokenSchema.statics.findValidToken = async function (token, type) {
  return this.findOne({
    token,
    type,
    used: false,
    expiresAt: { $gt: new Date() },
  });
};

// Método estático para invalidar tokens antiguos del mismo tipo y usuario
tokenSchema.statics.invalidateTokens = async function (userId, type) {
  return this.updateMany(
    {
      userId,
      type,
      used: false,
    },
    {
      used: true,
    }
  );
};

// Método para marcar un token como usado
tokenSchema.methods.markAsUsed = async function () {
  this.used = true;
  return this.save();
};

const Token = mongoose.model('Token', tokenSchema);

module.exports = Token;