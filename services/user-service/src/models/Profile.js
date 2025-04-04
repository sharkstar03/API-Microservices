const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    },
    bio: {
      type: String,
      maxlength: 500,
    },
    avatarUrl: {
      type: String,
    },
    socialProfiles: {
      facebook: String,
      twitter: String,
      linkedin: String,
      instagram: String,
    },
    profession: {
      type: String,
      trim: true,
    },
    company: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    interests: [String],
    skills: [String],
    languages: [{
      language: String,
      proficiency: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'native']
      }
    }],
    isPublic: {
      type: Boolean,
      default: false,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
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
profileSchema.index({ firstName: 'text', lastName: 'text', profession: 'text' });
profileSchema.index({ interests: 1 });
profileSchema.index({ skills: 1 });

// Método para obtener el nombre completo
profileSchema.virtual('fullName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.lastName || 'Sin nombre';
});

// Método para actualizar perfil
profileSchema.methods.updateProfileDetails = async function(profileData) {
  Object.keys(profileData).forEach(key => {
    if (this.schema.paths[key]) {
      this[key] = profileData[key];
    }
  });
  this.lastUpdated = new Date();
  return this.save();
};

// Método para agregar intereses
profileSchema.methods.addInterests = async function(newInterests) {
  const updatedInterests = [...new Set([...this.interests, ...newInterests])];
  this.interests = updatedInterests;
  return this.save();
};

// Método para agregar habilidades
profileSchema.methods.addSkills = async function(newSkills) {
  const updatedSkills = [...new Set([...this.skills, ...newSkills])];
  this.skills = updatedSkills;
  return this.save();
};

const Profile = mongoose.model('Profile', profileSchema);

module.exports = Profile;