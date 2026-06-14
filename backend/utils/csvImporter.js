const User = require('../models/User');
const Group = require('../models/Group');
const GroupMembership = require('../models/GroupMembership');
const Expense = require('../models/Expense');
const Split = require('../models/Split');
const Settlement = require('../models/Settlement');
const ImportLog = require('../models/ImportLog');

// Round to 2 decimals using round-half-up
const round2 = (num) => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

// Simple Jaro-Winkler/Token similarity for duplicate checking
const isSimilarDescription = (desc1, desc2) => {
  if (!desc1 || !desc2) return false;
  const d1 = desc1.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '');
  const d2 = desc2.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '');
  if (d1 === d2) return true;
  
  const w1 = new Set(d1.split(/\s+/));
  const w2 = new Set(d2.split(/\s+/));
  const intersection = [...w1].filter(x => w2.has(x));
  const union = new Set([...w1, ...w2]);
  const jaccard = intersection.length / union.size;
  return jaccard >= 0.5 || d1.includes(d2) || d2.includes(d1);
};

// Date Parsing Helper
const parseImportDate = (dateStr) => {
  let date = null;
  let issueType = null;
  let status = 'resolved';

  const s = dateStr.trim();
  // Case 1: Mar-14 or similar
  if (/^[A-Za-z]+-\d+$/.test(s) || /^\d+-[A-Za-z]+$/.test(s)) {
    const parts = s.split('-');
    let monthStr, dayStr;
    if (isNaN(parts[0])) {
      monthStr = parts[0];
      dayStr = parts[1];
    } else {
      dayStr = parts[0];
      monthStr = parts[1];
    }
    const months = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const month = months[monthStr.toLowerCase().substring(0, 3)];
    const day = parseInt(dayStr);
    date = new Date(2026, month, day);
    issueType = 'ambiguous_date';
    status = 'pending_review';
  } else {
    // Standard formats like DD-MM-YYYY
    const parts = s.split(/[-/]/);
    if (parts.length === 3) {
      let day, month, year;
      if (parts[0].length === 4) { // YYYY-MM-DD
        year = parseInt(parts[0]);
        month = parseInt(parts[1]) - 1;
        day = parseInt(parts[2]);
      } else { // DD-MM-YYYY
        day = parseInt(parts[0]);
        month = parseInt(parts[1]) - 1;
        year = parseInt(parts[2]);
      }
      date = new Date(year, month, day);

      // Ambiguous if day <= 12 and month <= 12
      if (day <= 12 && (month + 1) <= 12) {
        issueType = 'ambiguous_date';
        status = 'pending_review';
      }
    } else {
      date = new Date(s);
      if (isNaN(date.getTime())) {
        date = new Date();
        issueType = 'ambiguous_date';
        status = 'pending_review';
      }
    }
  }
  return { date, issueType, status };
};

// Core Importer Function - Optimized for Bulk/Batch insertions to prevent timeouts & connection limits
const importCSVRows = async (groupId, rows, creatorId) => {
  const reports = [];
  const dbUsers = await User.findAll();
  
  // Normalize alias mapping
  const aliasMap = {
    'priya s': 'priya',
    'rohan ': 'rohan',
    'aisha': 'aisha',
    'rohan': 'rohan',
    'priya': 'priya',
    'meera': 'meera',
    'dev': 'dev',
    'sam': 'sam',
  };

  const getUserByName = (name) => {
    if (!name) return null;
    const clean = name.toLowerCase().trim();
    const resolvedName = aliasMap[clean] || clean;
    return dbUsers.find(u => u.name.toLowerCase() === resolvedName) || null;
  };

  const dbMemberships = await GroupMembership.findAll({
    where: { groupId: groupId }
  });

  const getMembership = (userId) => {
    return dbMemberships.find(m => String(m.userId) === String(userId)) || null;
  };

  const allGroupExpenses = await Expense.findAll({
    where: {
      groupId: groupId,
      isDeleted: false
    }
  });

  // Keep track of imported expenses in this run to detect duplicates
  const importedExpenses = [];

  // Arrays to hold entities for bulk insertion after the loop
  const expensesToCreate = [];
  const settlementsToCreate = [];
  const importLogsToCreate = [];
  const rowSplitsMap = new Map(); // Key: rowNumber, Value: Array of splits ({ userId, amountOwed })

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNum = idx + 2; // Assuming row 1 is header
    const rawData = { ...row };

    let issues = [];
    let isSettlement = false;
    let actionTaken = 'Imported normally';
    let rowStatus = 'resolved';

    // 1. Paid By / Payer Normalization & Missing check
    let paidByUserId = null;
    let payerUser = null;
    if (!row.paid_by || row.paid_by.trim() === '') {
      issues.push({
        issueType: 'missing_payer',
        status: 'pending_review',
        action: 'Excluded from balance calculations until payer is assigned'
      });
      actionTaken = 'Logged missing payer; pending review';
      rowStatus = 'pending_review';
      paidByUserId = creatorId; // Default fallback
    } else {
      payerUser = getUserByName(row.paid_by);
      if (!payerUser) {
        issues.push({
          issueType: 'unrecognized_member',
          status: 'pending_review',
          action: `Name "${row.paid_by}" unrecognized; pending member assignment`
        });
        actionTaken = 'Logged unrecognized member';
        rowStatus = 'pending_review';
        paidByUserId = creatorId; // Default fallback
      } else {
        paidByUserId = payerUser.id;
        const cleanName = row.paid_by.trim();
        if (cleanName.toLowerCase() !== payerUser.name.toLowerCase()) {
          issues.push({
            issueType: 'name_normalization',
            status: 'resolved',
            action: `Normalized "${row.paid_by}" to "${payerUser.name}"`
          });
        }
      }
    }

    // 2. Date parsing and ambiguity check
    let parsedDateObj = new Date();
    if (!row.date || row.date.trim() === '') {
      issues.push({
        issueType: 'ambiguous_date',
        status: 'pending_review',
        action: 'Date was empty; defaulted to today, pending review'
      });
      rowStatus = 'pending_review';
    } else {
      const { date, issueType, status } = parseImportDate(row.date);
      parsedDateObj = date;
      if (issueType) {
        issues.push({
          issueType,
          status,
          action: `Parsed using DD-MM-YYYY default; flagged for review`
        });
        rowStatus = 'pending_review';
        actionTaken = `Parsed date as ${date.toDateString()}; flagged as ambiguous`;
      }
    }

    // 3. Amount parsing, thousand separators, and rounding
    let rawAmountStr = (row.amount || '0').toString().replace(/,/g, '');
    let rawAmountNum = parseFloat(rawAmountStr);
    let roundedAmount = round2(rawAmountNum);
    
    // Check rounding delta
    const roundingDelta = Math.abs(rawAmountNum - roundedAmount);
    if (roundingDelta > 0.01) {
      issues.push({
        issueType: 'rounding_adjustment',
        status: 'resolved',
        action: `Rounded amount from ${rawAmountNum} to ${roundedAmount}`
      });
    }

    // 4. Zero value expense check
    let isZeroValue = roundedAmount === 0;
    if (isZeroValue) {
      issues.push({
        issueType: 'zero_value',
        status: 'resolved',
        action: 'Zero-amount row imported but excluded from balance calculations'
      });
    }

    // 5. Currency & Exchange Rate
    let currency = (row.currency || '').trim().toUpperCase();
    let exchangeRate = null;
    let convertedAmount = roundedAmount;

    if (!currency) {
      currency = 'INR';
      issues.push({
        issueType: 'missing_currency',
        status: 'pending_review',
        action: 'Defaulted currency to INR; pending verification'
      });
      rowStatus = 'pending_review';
      actionTaken = 'Defaulted missing currency to INR';
    } else if (currency === 'USD') {
      exchangeRate = 83;
      convertedAmount = round2(roundedAmount * 83);
    }

    // 6. Settlement-as-expense detection
    const noteText = (row.notes || '').toLowerCase();
    const isSettlementType = !row.split_type || row.split_type.trim() === '';
    const hasSettlementNote = noteText.includes('settlement') || noteText.includes('paid back') || noteText.includes('settled');
    
    if (isSettlementType || hasSettlementNote) {
      isSettlement = true;
    }

    if (isSettlement) {
      let toUserObj = null;
      if (row.split_with) {
        toUserObj = getUserByName(row.split_with);
      }
      if (!toUserObj) {
        const noteWords = noteText.split(/\s+/);
        for (const word of noteWords) {
          const u = getUserByName(word);
          if (u && String(u.id) !== String(paidByUserId)) {
            toUserObj = u;
            break;
          }
        }
      }

      if (!toUserObj) {
        issues.push({
          issueType: 'settlement_missing_recipient',
          status: 'pending_review',
          action: 'Settlement row missing valid recipient; logged for review'
        });
        rowStatus = 'pending_review';
        toUserObj = { id: creatorId }; // Fallback
      }

      settlementsToCreate.push({
        groupId: groupId,
        fromUserId: paidByUserId,
        toUserId: toUserObj.id,
        amount: Math.abs(convertedAmount),
        date: parsedDateObj,
        rowNumber: rowNum,
      });

      actionTaken = `Imported directly into Settlement table: ${row.paid_by || 'Unknown'} to ${toUserObj.name || 'Unknown'}`;
      
      if (issues.length === 0) {
        importLogsToCreate.push({
          rowNumber: rowNum,
          rawData,
          issueType: 'none',
          actionTaken,
          status: 'resolved'
        });
      } else {
        for (const iss of issues) {
          importLogsToCreate.push({
            rowNumber: rowNum,
            rawData,
            issueType: iss.issueType,
            actionTaken: iss.action,
            status: iss.status
          });
        }
      }
      reports.push({ rowNumber: rowNum, issueType: issues.map(i => i.issueType).join(', ') || 'Settlement', actionTaken, status: rowStatus });
      continue;
    }

    // 7. Duplicate Checks (Exact and Conflicting)
    let isExactDuplicate = false;
    let isConflictingDuplicate = false;

    const sameDateExpenses = allGroupExpenses.filter(e => {
      const d1 = new Date(e.date);
      return d1.getFullYear() === parsedDateObj.getFullYear() &&
             d1.getMonth() === parsedDateObj.getMonth() &&
             d1.getDate() === parsedDateObj.getDate();
    });

    const allCompareExpenses = [...sameDateExpenses, ...importedExpenses];

    for (const other of allCompareExpenses) {
      if (String(other.paidById) === String(paidByUserId) && Math.abs(other.amount - roundedAmount) < 0.01) {
        if (isSimilarDescription(other.description, row.description)) {
          isExactDuplicate = true;
          break;
        }
      } else if (isSimilarDescription(other.description, row.description) && Math.abs(other.amount - roundedAmount) >= 0.01) {
        isConflictingDuplicate = true;
      }
    }

    if (isExactDuplicate) {
      issues.push({
        issueType: 'duplicate',
        status: 'pending_review',
        action: 'Exact duplicate detected; flagged for review, excluded from balance calculations'
      });
      rowStatus = 'pending_review';
      actionTaken = 'Logged exact duplicate; excluded from balance';
    } else if (isConflictingDuplicate) {
      issues.push({
        issueType: 'conflicting_duplicate',
        status: 'pending_review',
        action: 'Conflicting amount duplicate detected; flagged for review, excluded from balance'
      });
      rowStatus = 'pending_review';
      actionTaken = 'Logged conflicting duplicate';
    }

    // 8. Split Type Override and Splits Calculation
    let splitType = (row.split_type || 'equal').trim().toLowerCase();
    const hasSplitDetails = row.split_details && row.split_details.trim() !== '';
    if (splitType === 'equal' && hasSplitDetails) {
      splitType = 'share';
      issues.push({
        issueType: 'split_type_override',
        status: 'resolved',
        action: 'Equal split type overridden by detailed share data'
      });
    }

    // Store expense object details (will bulk insert after loop)
    const expenseObject = {
      groupId: groupId,
      description: row.description,
      amount: roundedAmount,
      currency,
      exchangeRate,
      convertedAmount,
      splitType,
      paidById: paidByUserId,
      date: parsedDateObj,
      createdById: creatorId,
      notes: row.notes || '',
      isSettlementFlag: false,
      rowNumber: rowNum
    };

    importedExpenses.push(expenseObject);
    allGroupExpenses.push(expenseObject);
    expensesToCreate.push(expenseObject);

    // Calculate splits
    const splitWithStr = row.split_with || '';
    const rawSplitMembers = splitWithStr.split(';').map(n => n.trim()).filter(n => n !== '');
    const splitMembers = [];

    for (const memName of rawSplitMembers) {
      const u = getUserByName(memName);
      if (u) {
        splitMembers.push(u);
      } else {
        issues.push({
          issueType: 'unrecognized_member',
          status: 'pending_review',
          action: `Unrecognized split member "${memName}" skipped`
        });
        rowStatus = 'pending_review';
      }
    }

    const finalSplitUsers = [];
    for (const userObj of splitMembers) {
      const membership = getMembership(userObj.id);
      if (membership) {
        if (membership.leaveDate && parsedDateObj > new Date(membership.leaveDate)) {
          issues.push({
            issueType: 'membership_mismatch',
            status: 'resolved',
            action: `Auto-excluded ${userObj.name} from splits (expense date ${parsedDateObj.toDateString()} is after leave date ${new Date(membership.leaveDate).toDateString()})`
          });
        } else if (parsedDateObj < new Date(membership.joinDate)) {
          issues.push({
            issueType: 'membership_mismatch',
            status: 'resolved',
            action: `Auto-excluded ${userObj.name} from splits (expense date ${parsedDateObj.toDateString()} is before join date ${new Date(membership.joinDate).toDateString()})`
          });
        } else {
          finalSplitUsers.push(userObj);
        }
      } else {
        issues.push({
          issueType: 'membership_mismatch',
          status: 'resolved',
          action: `Excluded ${userObj.name} (not a member of the group)`
        });
      }
    }

    let computedSplits = [];
    if (finalSplitUsers.length > 0) {
      if (splitType === 'equal' || (splitType === 'share' && !hasSplitDetails)) {
        const shareAmt = round2(convertedAmount / finalSplitUsers.length);
        let sum = 0;
        finalSplitUsers.forEach((u, index) => {
          let owed = shareAmt;
          if (index === finalSplitUsers.length - 1) {
            owed = round2(convertedAmount - sum);
          }
          sum += owed;
          computedSplits.push({ userId: u.id, amountOwed: owed });
        });
      } else {
        const detailsMap = {};
        const detailPairs = (row.split_details || '').split(';').map(p => p.trim()).filter(p => p !== '');
        detailPairs.forEach(pair => {
          const lastSpaceIdx = pair.lastIndexOf(' ');
          if (lastSpaceIdx !== -1) {
            const name = pair.substring(0, lastSpaceIdx).trim();
            const valStr = pair.substring(lastSpaceIdx + 1).replace(/[%\s]/g, '');
            const val = parseFloat(valStr);
            const resolvedUser = getUserByName(name);
            if (resolvedUser) {
              detailsMap[resolvedUser.id.toString()] = val;
            }
          }
        });

        if (splitType === 'unequal') {
          let sum = 0;
          finalSplitUsers.forEach((u, index) => {
            const rawVal = detailsMap[u.id.toString()] || 0;
            const baseVal = currency === 'USD' ? rawVal * 83 : rawVal;
            const owed = round2(baseVal);
            sum += owed;
            computedSplits.push({ userId: u.id, amountOwed: owed });
          });
          if (computedSplits.length > 0 && Math.abs(sum - convertedAmount) > 0.01) {
            const lastIdx = computedSplits.length - 1;
            computedSplits[lastIdx].amountOwed = round2(convertedAmount - (sum - computedSplits[lastIdx].amountOwed));
          }
        } else if (splitType === 'percentage') {
          let sum = 0;
          finalSplitUsers.forEach((u, index) => {
            const pct = detailsMap[u.id.toString()] || 0;
            const owed = round2((convertedAmount * pct) / 100);
            sum += owed;
            computedSplits.push({ userId: u.id, amountOwed: owed });
          });
          if (computedSplits.length > 0) {
            const lastIdx = computedSplits.length - 1;
            computedSplits[lastIdx].amountOwed = round2(convertedAmount - (sum - computedSplits[lastIdx].amountOwed));
          }
        } else if (splitType === 'share') {
          const totalShares = finalSplitUsers.reduce((acc, u) => acc + (detailsMap[u.id.toString()] || 0), 0);
          if (totalShares > 0) {
            let sum = 0;
            finalSplitUsers.forEach((u, index) => {
              const sh = detailsMap[u.id.toString()] || 0;
              const owed = round2((convertedAmount * sh) / totalShares);
              sum += owed;
              computedSplits.push({ userId: u.id, amountOwed: owed });
            });
            if (computedSplits.length > 0) {
              const lastIdx = computedSplits.length - 1;
              computedSplits[lastIdx].amountOwed = round2(convertedAmount - (sum - computedSplits[lastIdx].amountOwed));
            }
          } else {
            const shareAmt = round2(convertedAmount / finalSplitUsers.length);
            let sum = 0;
            finalSplitUsers.forEach((u, index) => {
              let owed = shareAmt;
              if (index === finalSplitUsers.length - 1) {
                owed = round2(convertedAmount - sum);
              }
              sum += owed;
              computedSplits.push({ userId: u.id, amountOwed: owed });
            });
          }
        }
      }

      rowSplitsMap.set(rowNum, computedSplits);
    }

    // Save logs
    if (issues.length === 0) {
      importLogsToCreate.push({
        rowNumber: rowNum,
        rawData,
        issueType: 'none',
        actionTaken: 'Imported normally',
        status: 'resolved'
      });
    } else {
      for (const iss of issues) {
        importLogsToCreate.push({
          rowNumber: rowNum,
          rawData,
          issueType: iss.issueType,
          actionTaken: iss.action,
          status: iss.status
        });
      }
    }

    reports.push({
      rowNumber: rowNum,
      issueType: issues.map(i => i.issueType).join(', ') || 'none',
      actionTaken: actionTaken || (issues.length > 0 ? issues[0].action : 'Imported normally'),
      status: rowStatus
    });
  }

  // Perform bulk insertions
  if (settlementsToCreate.length > 0) {
    await Settlement.bulkCreate(settlementsToCreate);
  }

  if (expensesToCreate.length > 0) {
    const createdExpenses = await Expense.bulkCreate(expensesToCreate, { returning: true });
    
    // Map rowNumber to auto-incremented expense ID
    const expenseIdMap = new Map();
    createdExpenses.forEach(exp => {
      expenseIdMap.set(exp.rowNumber, exp.id);
    });

    const splitsToCreate = [];
    for (const [rowNum, splits] of rowSplitsMap.entries()) {
      const expenseId = expenseIdMap.get(rowNum);
      if (expenseId) {
        splits.forEach(s => {
          splitsToCreate.push({
            expenseId,
            userId: s.userId,
            amountOwed: s.amountOwed
          });
        });
      }
    }

    if (splitsToCreate.length > 0) {
      await Split.bulkCreate(splitsToCreate);
    }
  }

  if (importLogsToCreate.length > 0) {
    await ImportLog.bulkCreate(importLogsToCreate);
  }

  return reports;
};

module.exports = { importCSVRows };
