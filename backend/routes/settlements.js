const express = require('express');
const router = express.Router();
const Settlement = require('../models/Settlement');
const GroupMembership = require('../models/GroupMembership');
const User = require('../models/User');
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
    const membership = await GroupMembership.findOne({
      where: { groupId: groupId, userId: req.user.id }
    });
    if (!membership) {
      return res.status(403).json({ message: 'Not authorized to view settlements in this group' });
    }

    const settlements = await Settlement.findAll({
      where: { groupId: groupId },
      include: [
        { model: User, as: 'fromUser', attributes: ['id', 'name', 'email', 'avatar_url'] },
        { model: User, as: 'toUser', attributes: ['id', 'name', 'email', 'avatar_url'] }
      ],
      order: [
        ['date', 'DESC'],
        ['created_at', 'DESC']
      ]
    });

    const response = settlements.map(s => {
      const json = s.toJSON();
      return { ...json, _id: json.id };
    });

    res.json(response);
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
    const membership = await GroupMembership.findOne({
      where: { groupId: groupId, userId: req.user.id }
    });
    if (!membership) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Verify fromUser and toUser are members
    const fromMember = await GroupMembership.findOne({
      where: { groupId: groupId, userId: fromUser }
    });
    const toMember = await GroupMembership.findOne({
      where: { groupId: groupId, userId: toUser }
    });

    if (!fromMember || !toMember) {
      return res.status(400).json({ message: 'Both users must be members of the group' });
    }

    const settlement = await Settlement.create({
      groupId: groupId,
      fromUserId: fromUser,
      toUserId: toUser,
      amount: parseFloat(amount),
      date: date ? new Date(date) : new Date(),
    });

    const populated = await Settlement.findByPk(settlement.id, {
      include: [
        { model: User, as: 'fromUser', attributes: ['id', 'name', 'email', 'avatar_url'] },
        { model: User, as: 'toUser', attributes: ['id', 'name', 'email', 'avatar_url'] }
      ]
    });

    const json = populated.toJSON();
    res.status(201).json({ ...json, _id: json.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error recording settlement' });
  }
});

module.exports = router;
