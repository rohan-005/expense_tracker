const express = require('express');
const router = express.Router();
const Settlement = require('../models/Settlement');
const GroupMembership = require('../models/GroupMembership');
const { protect } = require('../middleware/auth');

// @desc    Get all settlements in a group
// @route   GET /api/settlements
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { groupId } = req.query;
    if (!groupId) {
      return res.status(400).json({ message: 'groupId query parameter is required' });
    }

    // Verify membership
    const membership = await GroupMembership.findOne({ group: groupId, user: req.user._id });
    if (!membership) {
      return res.status(403).json({ message: 'Not authorized to view settlements in this group' });
    }

    const settlements = await Settlement.find({ group: groupId })
      .populate('fromUser', 'name email avatar_url')
      .populate('toUser', 'name email avatar_url')
      .sort({ date: -1, created_at: -1 });

    res.json(settlements);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving settlements' });
  }
});

// @desc    Record a new settlement
// @route   POST /api/settlements
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { groupId, fromUser, toUser, amount, date } = req.body;

    if (!groupId || !fromUser || !toUser || !amount) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Verify membership of requester
    const membership = await GroupMembership.findOne({ group: groupId, user: req.user._id });
    if (!membership) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Verify fromUser and toUser are members
    const fromMember = await GroupMembership.findOne({ group: groupId, user: fromUser });
    const toMember = await GroupMembership.findOne({ group: groupId, user: toUser });

    if (!fromMember || !toMember) {
      return res.status(400).json({ message: 'Both users must be members of the group' });
    }

    const settlement = await Settlement.create({
      group: groupId,
      fromUser,
      toUser,
      amount: parseFloat(amount),
      date: date ? new Date(date) : new Date(),
    });

    const populated = await Settlement.findById(settlement._id)
      .populate('fromUser', 'name email avatar_url')
      .populate('toUser', 'name email avatar_url');

    res.status(201).json(populated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error recording settlement' });
  }
});

module.exports = router;
