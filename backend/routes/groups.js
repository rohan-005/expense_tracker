const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const GroupMembership = require('../models/GroupMembership');
const User = require('../models/User');
const Expense = require('../models/Expense');
const Split = require('../models/Split');
const Settlement = require('../models/Settlement');
const ImportLog = require('../models/ImportLog');
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

// @desc    Get dynamic balances of the group
// @route   GET /api/groups/:id/balances
// @access  Private
router.get('/:id/balances', protect, async (req, res) => {
  try {
    const groupId = req.params.id;

    // Verify membership
    const userMembership = await GroupMembership.findOne({ group: groupId, user: req.user._id });
    if (!userMembership) {
      return res.status(403).json({ message: 'Not authorized to view balances of this group' });
    }

    // Get all members of the group
    const memberships = await GroupMembership.find({ group: groupId }).populate('user', 'name email avatar_url');
    const members = memberships.map(m => m.user);

    // Get all pending review imports to exclude their row numbers
    const pendingLogs = await ImportLog.find({ status: 'pending_review' });
    const pendingRowNumbers = new Set(pendingLogs.map(l => l.rowNumber));

    // Get all active, non-deleted expenses
    const expenses = await Expense.find({ group: groupId, isDeleted: false });
    const activeExpenses = expenses.filter(e => {
      if (e.rowNumber !== null && pendingRowNumbers.has(e.rowNumber)) {
        return false;
      }
      return true;
    });

    const activeExpenseIds = activeExpenses.map(e => e._id);

    // Get splits for active expenses
    const splits = await Split.find({ expense: { $in: activeExpenseIds } }).populate({
      path: 'expense',
      select: 'paidBy date'
    });

    // Get settlements
    const allSettlements = await Settlement.find({ group: groupId });
    const activeSettlements = allSettlements.filter(s => {
      if (s.rowNumber !== null && pendingRowNumbers.has(s.rowNumber)) {
        return false;
      }
      return true;
    });

    // User maps
    const userIdToMembership = {};
    memberships.forEach(m => {
      userIdToMembership[m.user._id.toString()] = m;
    });

    const splitsPaidByAForB = {}; // key: "userA_userB" -> amount
    const settlementsFromAToB = {}; // key: "userA_userB" -> amount

    // Initialize key pairs
    const getPairKey = (uA, uB) => `${uA.toString()}_${uB.toString()}`;

    // Process splits
    splits.forEach(sp => {
      if (!sp.expense) return;
      const payerId = sp.expense.paidBy.toString();
      const debtorId = sp.user.toString();
      const expenseDate = sp.expense.date;

      // Check debtor membership dates
      const debtorMembership = userIdToMembership[debtorId];
      if (debtorMembership) {
        if (debtorMembership.leaveDate && expenseDate > debtorMembership.leaveDate) return;
        if (debtorMembership.joinDate && expenseDate < debtorMembership.joinDate) return;
      }

      // Check payer membership dates
      const payerMembership = userIdToMembership[payerId];
      if (payerMembership) {
        if (payerMembership.leaveDate && expenseDate > payerMembership.leaveDate) return;
        if (payerMembership.joinDate && expenseDate < payerMembership.joinDate) return;
      }

      if (payerId === debtorId) return;

      const key = getPairKey(payerId, debtorId);
      splitsPaidByAForB[key] = (splitsPaidByAForB[key] || 0) + sp.amountOwed;
    });

    // Process settlements
    activeSettlements.forEach(se => {
      const fromId = se.fromUser.toString();
      const toId = se.toUser.toString();
      const key = getPairKey(fromId, toId);
      settlementsFromAToB[key] = (settlementsFromAToB[key] || 0) + se.amount;
    });

    // Calculate pairwise net balances
    const pairwise = [];
    const netBalances = {}; // userId -> overall net balance

    members.forEach(u => {
      netBalances[u._id.toString()] = 0;
    });

    const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const uA = members[i]._id.toString();
        const uB = members[j]._id.toString();

        const s_A_for_B = splitsPaidByAForB[getPairKey(uA, uB)] || 0;
        const s_B_for_A = splitsPaidByAForB[getPairKey(uB, uA)] || 0;

        const set_A_to_B = settlementsFromAToB[getPairKey(uA, uB)] || 0;
        const set_B_to_A = settlementsFromAToB[getPairKey(uB, uA)] || 0;

        // net = (sum of splits where A paid for B) - (sum of splits where B paid for A) - (settlements A -> B) + (settlements B -> A)
        const netA_B = round2(s_A_for_B - s_B_for_A - set_A_to_B + set_B_to_A);

        if (netA_B !== 0) {
          pairwise.push({
            userA: members[i],
            userB: members[j],
            net: netA_B
          });

          netBalances[uA] = round2(netBalances[uA] + netA_B);
          netBalances[uB] = round2(netBalances[uB] - netA_B);
        }
      }
    }

    const overallBalances = members.map(u => ({
      user: u,
      netBalance: netBalances[u._id.toString()] || 0
    }));

    res.json({
      overall: overallBalances,
      pairwise: pairwise
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error calculating balances' });
  }
});

module.exports = router;
