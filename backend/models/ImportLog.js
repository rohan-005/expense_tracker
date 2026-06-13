const mongoose = require('mongoose');

const ImportLogSchema = new mongoose.Schema({
  rowNumber: {
    type: Number,
    required: true,
  },
  rawData: {
    type: Object,
    required: true,
  },
  issueType: {
    type: String,
    required: true,
  },
  actionTaken: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['resolved', 'pending_review'],
    default: 'pending_review',
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

module.exports = mongoose.model('ImportLog', ImportLogSchema);
