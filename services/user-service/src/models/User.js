const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Por favor ingrese un email válido',
      ],
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'premium'],
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    preferences: {
      language: {
        type: String,
        default: 'es',
      },
      theme: {
        type: String,
        default: 'light',
      },
      notifications: {
        email: {
          type: Boolean,
          default: true,
        },
        push: {
          type: Boolean,
          default: true,
        },
        sms: {
          type: Boolean,
          default: false,
        },
      },
    },
    metadata: {
      registrationIP: String,
      userAgent: String,
      registrationSource: String,
    },
    isDeleted: {
      type: Boolean,
      default: false,
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
userSchema.index({ name: 'text', email: 'text' });
userSchema.index({ isActive: 1, isVerified: 1 });

// Método para filtrar usuarios activos
userSchema.statics.findActive = function () {
  return this.find({ isActive: true, isDeleted: false });
};

// Método para filtrar por rol
userSchema.statics.findByRole = function (role) {
  return this.find({ role, isActive: true, isDeleted: false });
};

// Método para actualizar perfil
userSchema.methods.updateProfile = async function (profileData) {
  Object.assign(this, profileData);
  return this.save();
};

// Método para desactivar usuario
userSchema.methods.deactivate = async function () {
  this.isActive = false;
  return this.save();
};

// Método para reactivar usuario
userSchema.methods.reactivate = async function () {
  this.isActive = true;
  return this.save();
};

// Método para formatear respuesta de usuario
userSchema.methods.formatResponse = function () {
  return {
    id: this._id,
    userId: this.userId,
    name: this.name,
    email: this.email,
    role: this.role,
    isActive: this.isActive,
    isVerified: this.isVerified,
    preferences: this.preferences,
    createdAt: this.createdAt,
  };
};

const User = mongoose.model('User', userSchema);

module.exports = User;