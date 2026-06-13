const mongoose = require('mongoose');

const GroupMembershipSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'member'],
    default: 'member',
  },
  joinDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  leaveDate: {
    type: Date,
    default: null,
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

// Set compound unique index to prevent duplicate memberships
GroupMembershipSchema.index({ group: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('GroupMembership', GroupMembershipSchema);
