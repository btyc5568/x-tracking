const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: 6,
      select: false,
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    preferences: {
      reportDeliveryTime: {
        type: String,
        default: '06:00', // Default: 6:00 AM
      },
      reportType: {
        type: String,
        enum: ['brief', 'standard', 'comprehensive'],
        default: 'standard',
      },
      notificationSettings: {
        email: {
          dailyReport: {
            type: Boolean,
            default: true,
          },
          sentimentAlerts: {
            type: Boolean,
            default: true,
          },
          trendingTopics: {
            type: Boolean,
            default: false,
          },
          highPriorityPosts: {
            type: Boolean,
            default: true,
          },
        },
        inApp: {
          dailyReport: {
            type: Boolean,
            default: true,
          },
          sentimentAlerts: {
            type: Boolean,
            default: true,
          },
          trendingTopics: {
            type: Boolean,
            default: true,
          },
          highPriorityPosts: {
            type: Boolean,
            default: true,
          },
        },
      },
      focusCategories: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Category',
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

// Encrypt password using bcrypt
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema); 