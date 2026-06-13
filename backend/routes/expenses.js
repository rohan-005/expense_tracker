const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const Split = require('../models/Split');
const Comment = require('../models/Comment');
const GroupMembership = require('../models/GroupMembership');
const { protect } = require('../middleware/auth');

// @desc    Get all active expenses in a group
// @route   GET /api/expenses
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { groupId } = req.query;
    if (!groupId) {
      return res.status(400).json({ message: 'groupId is required' });
    }

    // Check membership
    const membership = await GroupMembership.findOne({ group: groupId, user: req.user._id });
    if (!membership) {
      return res.status(403).json({ message: 'Not authorized to view this group\'s expenses' });
    }

    // Find all active (non-soft-deleted) expenses
    const expenses = await Expense.find({ group: groupId, isDeleted: false })
      .populate('paidBy', 'name email avatar_url')
      .populate('createdBy', 'name email avatar_url')
      .sort({ date: -1, created_at: -1 });

    // For each expense, load its splits
    const expensesWithSplits = [];
    for (const exp of expenses) {
      const splits = await Split.find({ expense: exp._id }).populate('user', 'name email avatar_url');
      expensesWithSplits.push({
        ...exp.toObject(),
        splits,
      });
    }

    res.json(expensesWithSplits);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving expenses' });
  }
});

// @desc    Get specific expense details and its comments
// @route   GET /api/expenses/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('paidBy', 'name email avatar_url')
      .populate('createdBy', 'name email avatar_url');

    if (!expense || expense.isDeleted) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check membership
    const membership = await GroupMembership.findOne({ group: expense.group, user: req.user._id });
    if (!membership) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const splits = await Split.find({ expense: expense._id }).populate('user', 'name email avatar_url');
    const comments = await Comment.find({ expense: expense._id })
      .populate('user', 'name email avatar_url')
      .sort({ created_at: 1 });

    res.json({
      ...expense.toObject(),
      splits,
      comments,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving expense details' });
  }
});

// Helper for rounding to 2 decimals using round-half-up
const round2 = (num) => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

// @desc    Create a new expense
// @route   POST /api/expenses
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const {
      groupId,
      description,
      amount,
      currency,
      splitType,
      paidBy,
      date,
      notes,
      splitsData, // [{ userId: string, val: number }] or [userIds]
    } = req.body;

    if (!groupId || !description || amount === undefined || !paidBy) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Check membership
    const isMember = await GroupMembership.findOne({ group: groupId, user: req.user._id });
    if (!isMember) {
      return res.status(403).json({ message: 'Not authorized to add expenses to this group' });
    }

    // Handle currency & converted amount
    const isUSD = currency === 'USD';
    const rate = isUSD ? 83 : null;
    const baseAmount = isUSD ? amount * 83 : amount;
    const convertedAmount = round2(baseAmount);

    const expense = await Expense.create({
      group: groupId,
      description,
      amount,
      currency: currency || 'INR',
      exchangeRate: rate,
      convertedAmount,
      splitType: splitType || 'equal',
      paidBy,
      date: date ? new Date(date) : new Date(),
      createdBy: req.user._id,
      notes: notes || '',
    });

    // Calculate splits
    let computedSplits = [];

    if (splitType === 'equal') {
      // splitsData is array of userIds
      const userIds = Array.isArray(splitsData) ? splitsData : [];
      if (userIds.length === 0) {
        return res.status(400).json({ message: 'Equal splits require userIds array in splitsData' });
      }
      const splitAmt = round2(convertedAmount / userIds.length);
      let sum = 0;
      userIds.forEach((uId, idx) => {
        let owed = splitAmt;
        if (idx === userIds.length - 1) {
          owed = round2(convertedAmount - sum);
        }
        sum += owed;
        computedSplits.push({
          expense: expense._id,
          user: uId,
          amountOwed: owed,
        });
      });
    } else if (splitType === 'unequal') {
      // splitsData is array of { userId, val } (val is amount in currency)
      const data = Array.isArray(splitsData) ? splitsData : [];
      let sum = 0;
      data.forEach((item, idx) => {
        const itemBase = isUSD ? item.val * 83 : item.val;
        const owed = round2(itemBase);
        sum += owed;
        computedSplits.push({
          expense: expense._id,
          user: item.userId,
          amountOwed: owed,
        });
      });
      // Adjust last item rounding to make sure sum matches convertedAmount
      if (computedSplits.length > 0 && Math.abs(sum - convertedAmount) > 0.01) {
        const lastIdx = computedSplits.length - 1;
        const diff = round2(convertedAmount - (sum - computedSplits[lastIdx].amountOwed));
        computedSplits[lastIdx].amountOwed = diff;
      }
    } else if (splitType === 'percentage') {
      // splitsData is array of { userId, val } (val is percentage, e.g. 30)
      const data = Array.isArray(splitsData) ? splitsData : [];
      let sum = 0;
      data.forEach((item, idx) => {
        let owed = round2((convertedAmount * item.val) / 100);
        sum += owed;
        computedSplits.push({
          expense: expense._id,
          user: item.userId,
          amountOwed: owed,
        });
      });
      if (computedSplits.length > 0) {
        const lastIdx = computedSplits.length - 1;
        const diff = round2(convertedAmount - (sum - computedSplits[lastIdx].amountOwed));
        computedSplits[lastIdx].amountOwed = diff;
      }
    } else if (splitType === 'share') {
      // splitsData is array of { userId, val } (val is shares, e.g. 2)
      const data = Array.isArray(splitsData) ? splitsData : [];
      const totalShares = data.reduce((acc, curr) => acc + curr.val, 0);
      if (totalShares === 0) {
        return res.status(400).json({ message: 'Total shares cannot be zero' });
      }
      let sum = 0;
      data.forEach((item, idx) => {
        let owed = round2((convertedAmount * item.val) / totalShares);
        sum += owed;
        computedSplits.push({
          expense: expense._id,
          user: item.userId,
          amountOwed: owed,
        });
      });
      if (computedSplits.length > 0) {
        const lastIdx = computedSplits.length - 1;
        const diff = round2(convertedAmount - (sum - computedSplits[lastIdx].amountOwed));
        computedSplits[lastIdx].amountOwed = diff;
      }
    }

    // Save all splits
    await Split.insertMany(computedSplits);

    // Fetch complete expense object with splits populated to return
    const fullExpense = await Expense.findById(expense._id)
      .populate('paidBy', 'name email avatar_url')
      .populate('createdBy', 'name email avatar_url');
    
    const splits = await Split.find({ expense: expense._id }).populate('user', 'name email avatar_url');

    res.status(201).json({
      ...fullExpense.toObject(),
      splits,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error creating expense' });
  }
});

// @desc    Soft delete an expense
// @route   DELETE /api/expenses/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check membership
    const membership = await GroupMembership.findOne({ group: expense.group, user: req.user._id });
    if (!membership) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    expense.isDeleted = true;
    await expense.save();

    res.json({ message: 'Expense deleted successfully', id: expense._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error deleting expense' });
  }
});

// @desc    Post a comment to an expense
// @route   POST /api/expenses/:id/comments
// @access  Private
router.post('/:id/comments', protect, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const expense = await Expense.findById(req.params.id);
    if (!expense || expense.isDeleted) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check membership
    const membership = await GroupMembership.findOne({ group: expense.group, user: req.user._id });
    if (!membership) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const comment = await Comment.create({
      expense: expense._id,
      user: req.user._id,
      message,
    });

    const populatedComment = await Comment.findById(comment._id).populate('user', 'name email avatar_url');

    // Notify other sockets in the room
    if (req.io) {
      req.io.to(req.params.id).emit('new_comment', populatedComment);
    }

    res.status(201).json(populatedComment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error posting comment' });
  }
});

module.exports = router;
