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
    const memberships = await GroupMembership.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: Group,
          as: 'group',
          include: [
            { model: User, as: 'createdBy', attributes: ['id', 'name', 'email', 'avatar_url'] }
          ]
        }
      ]
    });

    const groups = memberships
      .filter(m => m.group && m.group.isActive)
      .map(m => {
        const g = m.group.toJSON();
        return {
          ...g,
          _id: g.id,
          role: m.role,
          joinDate: m.joinDate,
          leaveDate: m.leaveDate,
        };
      });

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
      createdById: req.user.id,
    });

    // Automatically create admin membership for the creator
    await GroupMembership.create({
      groupId: group.id,
      userId: req.user.id,
      role: 'admin',
      joinDate: new Date(),
    });

    const json = group.toJSON();
    res.status(201).json({ ...json, _id: json.id });
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
      where: {
        groupId: req.params.id,
        userId: req.user.id,
      }
    });

    if (!membership) {
      return res.status(403).json({ message: 'Not authorized to view this group' });
    }

    const group = await Group.findByPk(req.params.id, {
      include: [
        { model: User, as: 'createdBy', attributes: ['id', 'name', 'email', 'avatar_url'] }
      ]
    });
    if (!group || !group.isActive) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Get all memberships in the group
    const allMemberships = await GroupMembership.findAll({
      where: { groupId: group.id },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'avatar_url'] }
      ]
    });

    const members = allMemberships.map(m => {
      const u = m.user.toJSON();
      return {
        id: u.id,
        _id: u.id,
        name: u.name,
        email: u.email,
        avatar_url: u.avatar_url,
        role: m.role,
        joinDate: m.joinDate,
        leaveDate: m.leaveDate,
      };
    });

    const groupJson = group.toJSON();
    res.json({
      ...groupJson,
      _id: groupJson.id,
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

    // Check if current user is member
    const requesterMembership = await GroupMembership.findOne({
      where: {
        groupId: req.params.id,
        userId: req.user.id,
      }
    });

    if (!requesterMembership) {
      return res.status(403).json({ message: 'Not authorized to manage this group' });
    }

    const targetUser = await User.findOne({
      where: { email: email.toLowerCase().trim() }
    });
    if (!targetUser) {
      return res.status(404).json({ message: 'User with this email not found' });
    }

    // Check if already a member
    const existingMembership = await GroupMembership.findOne({
      where: {
        groupId: req.params.id,
        userId: targetUser.id,
      }
    });

    if (existingMembership) {
      if (existingMembership.leaveDate) {
        existingMembership.leaveDate = null;
        existingMembership.joinDate = joinDate ? new Date(joinDate) : new Date();
        await existingMembership.save();
        const json = existingMembership.toJSON();
        return res.json({ message: 'Member reactivated successfully', membership: { ...json, _id: json.id } });
      }
      return res.status(400).json({ message: 'User is already a member of this group' });
    }

    const newMembership = await GroupMembership.create({
      groupId: req.params.id,
      userId: targetUser.id,
      role: role || 'member',
      joinDate: joinDate ? new Date(joinDate) : new Date(),
    });

    const json = newMembership.toJSON();
    res.status(201).json({ ...json, _id: json.id });
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
      where: {
        groupId: req.params.id,
        userId: req.user.id,
      }
    });

    if (!requesterMembership) {
      return res.status(403).json({ message: 'Not authorized to manage this group' });
    }

    const membershipToUpdate = await GroupMembership.findOne({
      where: {
        groupId: req.params.id,
        userId: req.params.userId,
      }
    });

    if (!membershipToUpdate) {
      return res.status(404).json({ message: 'Membership not found' });
    }

    membershipToUpdate.leaveDate = new Date();
    await membershipToUpdate.save();

    const json = membershipToUpdate.toJSON();
    res.json({ message: 'Member successfully marked as left', membership: { ...json, _id: json.id } });
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
    const userMembership = await GroupMembership.findOne({
      where: { groupId: groupId, userId: req.user.id }
    });
    if (!userMembership) {
      return res.status(403).json({ message: 'Not authorized to view balances of this group' });
    }

    // Get all members of the group
    const memberships = await GroupMembership.findAll({
      where: { groupId: groupId },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'avatar_url'] }
      ]
    });
    const members = memberships.map(m => {
      const u = m.user.toJSON();
      return { ...u, _id: u.id };
    });

    // Get all pending review imports to exclude their row numbers
    const pendingLogs = await ImportLog.findAll({ where: { status: 'pending_review' } });
    const pendingRowNumbers = new Set(pendingLogs.map(l => l.rowNumber));

    // Get all active, non-deleted expenses
    const expenses = await Expense.findAll({
      where: { groupId: groupId, isDeleted: false }
    });
    const activeExpenses = expenses.filter(e => {
      if (e.rowNumber !== null && pendingRowNumbers.has(e.rowNumber)) {
        return false;
      }
      return true;
    });

    const activeExpenseIds = activeExpenses.map(e => e.id);

    // Get splits for active expenses
    const splits = await Split.findAll({
      where: { expenseId: activeExpenseIds },
      include: [
        { model: Expense, as: 'expense', attributes: ['paidById', 'date'] }
      ]
    });

    // Get settlements
    const allSettlements = await Settlement.findAll({ where: { groupId: groupId } });
    const activeSettlements = allSettlements.filter(s => {
      if (s.rowNumber !== null && pendingRowNumbers.has(s.rowNumber)) {
        return false;
      }
      return true;
    });

    // User maps
    const userIdToMembership = {};
    memberships.forEach(m => {
      userIdToMembership[m.userId.toString()] = m;
    });

    const splitsPaidByAForB = {}; // key: "userA_userB" -> amount
    const settlementsFromAToB = {}; // key: "userA_userB" -> amount

    // Initialize key pairs
    const getPairKey = (uA, uB) => `${uA.toString()}_${uB.toString()}`;

    // Process splits
    splits.forEach(sp => {
      if (!sp.expense) return;
      const payerId = sp.expense.paidById.toString();
      const debtorId = sp.userId.toString();
      const expenseDate = new Date(sp.expense.date);

      // Check debtor membership dates
      const debtorMembership = userIdToMembership[debtorId];
      if (debtorMembership) {
        if (debtorMembership.leaveDate && expenseDate > new Date(debtorMembership.leaveDate)) return;
        if (debtorMembership.joinDate && expenseDate < new Date(debtorMembership.joinDate)) return;
      }

      // Check payer membership dates
      const payerMembership = userIdToMembership[payerId];
      if (payerMembership) {
        if (payerMembership.leaveDate && expenseDate > new Date(payerMembership.leaveDate)) return;
        if (payerMembership.joinDate && expenseDate < new Date(payerMembership.joinDate)) return;
      }

      if (payerId === debtorId) return;

      const key = getPairKey(payerId, debtorId);
      splitsPaidByAForB[key] = (splitsPaidByAForB[key] || 0) + sp.amountOwed;
    });

    // Process settlements
    activeSettlements.forEach(se => {
      const fromId = se.fromUserId.toString();
      const toId = se.toUserId.toString();
      const key = getPairKey(fromId, toId);
      settlementsFromAToB[key] = (settlementsFromAToB[key] || 0) + se.amount;
    });

    // Calculate pairwise net balances
    const pairwise = [];
    const netBalances = {}; // userId -> overall net balance

    members.forEach(u => {
      netBalances[u.id.toString()] = 0;
    });

    const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const uA = members[i].id.toString();
        const uB = members[j].id.toString();

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
      netBalance: netBalances[u.id.toString()] || 0
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

// @desc    Delete a group (soft delete by setting isActive to false)
// @route   DELETE /api/groups/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const groupId = req.params.id;

    // Check if the group exists
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Verify user is an admin of this group
    const membership = await GroupMembership.findOne({
      where: {
        groupId,
        userId: req.user.id,
        role: 'admin'
      }
    });

    if (!membership && group.createdById !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this group. Only admins can delete the group.' });
    }

    // Soft delete the group
    group.isActive = false;
    await group.save();

    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error deleting group' });
  }
});

module.exports = router;
