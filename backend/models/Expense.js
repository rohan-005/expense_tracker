const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    required: true,
    default: 'INR',
  },
  exchangeRate: {
    type: Number,
    default: null,
  },
  convertedAmount: {
    type: Number,
    required: true, // in base currency (INR)
  },
  splitType: {
    type: String,
    enum: ['equal', 'unequal', 'percentage', 'share'],
    default: 'equal',
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  notes: {
    type: String,
    default: '',
  },
  isSettlementFlag: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

module.exports = mongoose.model('Expense', ExpenseSchema);
