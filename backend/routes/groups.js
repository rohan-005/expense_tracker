const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const GroupMembership = require('../models/GroupMembership');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// @desc    Get all groups the logged-in user belongs to
// @route   GET /api/groups
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const memberships = await GroupMembership.find({
      user: req.user._id,
      // Optional: you can filter active ones only, but typically we want all historical ones too
    }).populate({
      path: 'group',
      populate: {
        path: 'createdBy',
        select: 'name email avatar_url'
      }
    });

    const groups = memberships
      .filter(m => m.group && m.group.isActive)
      .map(m => ({
        ...m.group.toObject(),
        role: m.role,
        joinDate: m.joinDate,
        leaveDate: m.leaveDate,
      }));

    res.json(groups);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving groups' });
  }
});

// @desc    Create a new group
// @route   POST /api/groups
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { name, category } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    const group = await Group.create({
      name,
      category: category || 'Home',
      createdBy: req.user._id,
    });

    // Automatically create admin membership for the creator
    await GroupMembership.create({
      group: group._id,
      user: req.user._id,
      role: 'admin',
      joinDate: new Date(),
    });

    res.status(201).json(group);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error creating group' });
  }
});

// @desc    Get details of a specific group (including members)
// @route   GET /api/groups/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    // Check if user is a member of the group
    const membership = await GroupMembership.findOne({
      group: req.params.id,
      user: req.user._id,
    });

    if (!membership) {
      return res.status(403).json({ message: 'Not authorized to view this group' });
    }

    const group = await Group.findById(req.params.id).populate('createdBy', 'name email avatar_url');
    if (!group || !group.isActive) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Get all memberships in the group
    const allMemberships = await GroupMembership.find({ group: group._id })
      .populate('user', 'name email avatar_url');

    const members = allMemberships.map(m => ({
      _id: m.user._id,
      name: m.user.name,
      email: m.user.email,
      avatar_url: m.user.avatar_url,
      role: m.role,
      joinDate: m.joinDate,
      leaveDate: m.leaveDate,
    }));

    res.json({
      ...group.toObject(),
      members,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving group details' });
  }
});

// @desc    Add a member to a group
// @route   POST /api/groups/:id/members
// @access  Private
router.post('/:id/members', protect, async (req, res) => {
  try {
    const { email, role, joinDate } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Member email is required' });
    }

    // Check if current user is member (or admin, depending on strictness - let's allow members to invite too, or only admin)
    const requesterMembership = await GroupMembership.findOne({
      group: req.params.id,
      user: req.user._id,
    });

    if (!requesterMembership) {
      return res.status(403).json({ message: 'Not authorized to manage this group' });
    }

    const targetUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (!targetUser) {
      return res.status(404).json({ message: 'User with this email not found' });
    }

    // Check if already a member
    const existingMembership = await GroupMembership.findOne({
      group: req.params.id,
      user: targetUser._id,
    });

    if (existingMembership) {
      // If they left earlier, we can reactivate them or return error. Let's reactivate by clearing leaveDate if they left.
      if (existingMembership.leaveDate) {
        existingMembership.leaveDate = null;
        existingMembership.joinDate = joinDate ? new Date(joinDate) : new Date();
        await existingMembership.save();
        return res.json({ message: 'Member reactivated successfully', membership: existingMembership });
      }
      return res.status(400).json({ message: 'User is already a member of this group' });
    }

    const newMembership = await GroupMembership.create({
      group: req.params.id,
      user: targetUser._id,
      role: role || 'member',
      joinDate: joinDate ? new Date(joinDate) : new Date(),
    });

    res.status(201).json(newMembership);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error adding member' });
  }
});

// @desc    Mark a member as left (soft delete/set leaveDate)
// @route   PUT /api/groups/:id/members/:userId/leave
// @access  Private
router.put('/:id/members/:userId/leave', protect, async (req, res) => {
  try {
    // Check requester is in group
    const requesterMembership = await GroupMembership.findOne({
      group: req.params.id,
      user: req.user._id,
    });

    if (!requesterMembership) {
      return res.status(403).json({ message: 'Not authorized to manage this group' });
    }

    const membershipToUpdate = await GroupMembership.findOne({
      group: req.params.id,
      user: req.params.userId,
    });

    if (!membershipToUpdate) {
      return res.status(404).json({ message: 'Membership not found' });
    }

    membershipToUpdate.leaveDate = new Date();
    await membershipToUpdate.save();

    res.json({ message: 'Member successfully marked as left', membership: membershipToUpdate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error updating membership status' });
  }
});

module.exports = router;
