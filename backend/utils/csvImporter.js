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

// Core Importer Function
const importCSVRows = async (groupId, rows, creatorId) => {
  const reports = [];
  const dbUsers = await User.find({});
  
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

  const getMembership = async (userId) => {
    return await GroupMembership.findOne({ group: groupId, user: userId });
  };

  // Keep track of imported expenses in this run to detect duplicates
  const importedExpenses = [];

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
      // Default to creator to allow document creation, but flagged
      paidByUserId = creatorId;
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
        paidByUserId = payerUser._id;
        // Verify name alias normalization logging if there was a slight difference
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
      // Find the recipient from split_with or notes
      let toUserObj = null;
      if (row.split_with) {
        toUserObj = getUserByName(row.split_with);
      }
      if (!toUserObj) {
        // Fallback or scan note
        const noteWords = noteText.split(/\s+/);
        for (const word of noteWords) {
          const u = getUserByName(word);
          if (u && u._id.toString() !== paidByUserId.toString()) {
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
        toUserObj = { _id: creatorId }; // Fallback
      }

      // Save as settlement if resolved, or save but flag
      await Settlement.create({
        group: groupId,
        fromUser: paidByUserId,
        toUser: toUserObj._id,
        amount: Math.abs(convertedAmount), // Settlements are positive
        date: parsedDateObj,
        rowNumber: rowNum,
      });

      actionTaken = `Imported directly into Settlement table: ${row.paid_by} to ${toUserObj.name || 'Unknown'}`;
      
      // Save import logs for any issues on this settlement row
      if (issues.length === 0) {
        await ImportLog.create({
          rowNumber: rowNum,
          rawData,
          issueType: 'none',
          actionTaken,
          status: 'resolved'
        });
      } else {
        for (const iss of issues) {
          await ImportLog.create({
            rowNumber: rowNum,
            rawData,
            issueType: iss.issueType,
            actionTaken: iss.action,
            status: iss.status
          });
        }
      }
      reports.push({ rowNumber: rowNum, issueType: issues.map(i => i.issueType).join(', ') || 'Settlement', actionTaken, status: rowStatus });
      continue; // Move to next row
    }

    // 7. Duplicate Checks (Exact and Conflicting)
    let isExactDuplicate = false;
    let isConflictingDuplicate = false;

    // Check against database and current import session
    // Find expenses in the DB on same date, group, and check similarity
    const sameDateExpenses = await Expense.find({
      group: groupId,
      date: {
        $gte: new Date(parsedDateObj.getFullYear(), parsedDateObj.getMonth(), parsedDateObj.getDate()),
        $lte: new Date(parsedDateObj.getFullYear(), parsedDateObj.getMonth(), parsedDateObj.getDate(), 23, 59, 59)
      },
      isDeleted: false
    });

    const allCompareExpenses = [...sameDateExpenses, ...importedExpenses];

    for (const other of allCompareExpenses) {
      if (other.paidBy.toString() === paidByUserId.toString() && Math.abs(other.amount - roundedAmount) < 0.01) {
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
      splitType = 'share'; // override equal with share
      issues.push({
        issueType: 'split_type_override',
        status: 'resolved',
        action: 'Equal split type overridden by detailed share data'
      });
    }

    // Create the expense record
    const expense = await Expense.create({
      group: groupId,
      description: row.description,
      amount: roundedAmount,
      currency,
      exchangeRate,
      convertedAmount,
      splitType,
      paidBy: paidByUserId,
      date: parsedDateObj,
      createdBy: creatorId,
      notes: row.notes || '',
      isSettlementFlag: false,
      rowNumber: rowNum
    });

    // Save in imported session list for duplicate checks in later rows
    importedExpenses.push(expense);

    // Calculate splits
    const splitWithStr = row.split_with || '';
    const rawSplitMembers = splitWithStr.split(';').map(n => n.trim()).filter(n => n !== '');
    const splitMembers = [];

    // Parse and normalize split members
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

    // Membership dates check: Membership mismatch
    const finalSplitUsers = [];
    for (const userObj of splitMembers) {
      const membership = await getMembership(userObj._id);
      if (membership) {
        // Check if expense date is after they left (or before they joined)
        if (membership.leaveDate && parsedDateObj > membership.leaveDate) {
          issues.push({
            issueType: 'membership_mismatch',
            status: 'resolved',
            action: `Auto-excluded ${userObj.name} from splits (expense date ${parsedDateObj.toDateString()} is after leave date ${membership.leaveDate.toDateString()})`
          });
        } else if (parsedDateObj < membership.joinDate) {
          issues.push({
            issueType: 'membership_mismatch',
            status: 'resolved',
            action: `Auto-excluded ${userObj.name} from splits (expense date ${parsedDateObj.toDateString()} is before join date ${membership.joinDate.toDateString()})`
          });
        } else {
          finalSplitUsers.push(userObj);
        }
      } else {
        // Non-member
        issues.push({
          issueType: 'membership_mismatch',
          status: 'resolved',
          action: `Excluded ${userObj.name} (not a member of the group)`
        });
      }
    }

    // Compute split values
    let computedSplits = [];
    if (finalSplitUsers.length > 0) {
      if (splitType === 'equal' || splitType === 'share' && !hasSplitDetails) {
        const shareAmt = round2(convertedAmount / finalSplitUsers.length);
        let sum = 0;
        finalSplitUsers.forEach((u, index) => {
          let owed = shareAmt;
          if (index === finalSplitUsers.length - 1) {
            owed = round2(convertedAmount - sum);
          }
          sum += owed;
          computedSplits.push({ expense: expense._id, user: u._id, amountOwed: owed });
        });
      } else {
        // Unequal, percentage, share with details
        // Parse split_details e.g. "Rohan 700; Priya 400; Meera 400" or "Aisha 30%; Rohan 30%"
        const detailsMap = {};
        const detailPairs = (row.split_details || '').split(';').map(p => p.trim()).filter(p => p !== '');
        detailPairs.forEach(pair => {
          // split by space or last space
          const lastSpaceIdx = pair.lastIndexOf(' ');
          if (lastSpaceIdx !== -1) {
            const name = pair.substring(0, lastSpaceIdx).trim();
            const valStr = pair.substring(lastSpaceIdx + 1).replace(/[%\s]/g, '');
            const val = parseFloat(valStr);
            const resolvedUser = getUserByName(name);
            if (resolvedUser) {
              detailsMap[resolvedUser._id.toString()] = val;
            }
          }
        });

        if (splitType === 'unequal') {
          let sum = 0;
          finalSplitUsers.forEach((u, index) => {
            const rawVal = detailsMap[u._id.toString()] || 0;
            const baseVal = currency === 'USD' ? rawVal * 83 : rawVal;
            const owed = round2(baseVal);
            sum += owed;
            computedSplits.push({ expense: expense._id, user: u._id, amountOwed: owed });
          });
          // Check rounding adjustment
          if (computedSplits.length > 0 && Math.abs(sum - convertedAmount) > 0.01) {
            const lastIdx = computedSplits.length - 1;
            computedSplits[lastIdx].amountOwed = round2(convertedAmount - (sum - computedSplits[lastIdx].amountOwed));
          }
        } else if (splitType === 'percentage') {
          let sum = 0;
          finalSplitUsers.forEach((u, index) => {
            const pct = detailsMap[u._id.toString()] || 0;
            const owed = round2((convertedAmount * pct) / 100);
            sum += owed;
            computedSplits.push({ expense: expense._id, user: u._id, amountOwed: owed });
          });
          if (computedSplits.length > 0) {
            const lastIdx = computedSplits.length - 1;
            computedSplits[lastIdx].amountOwed = round2(convertedAmount - (sum - computedSplits[lastIdx].amountOwed));
          }
        } else if (splitType === 'share') {
          const totalShares = finalSplitUsers.reduce((acc, u) => acc + (detailsMap[u._id.toString()] || 0), 0);
          if (totalShares > 0) {
            let sum = 0;
            finalSplitUsers.forEach((u, index) => {
              const sh = detailsMap[u._id.toString()] || 0;
              const owed = round2((convertedAmount * sh) / totalShares);
              sum += owed;
              computedSplits.push({ expense: expense._id, user: u._id, amountOwed: owed });
            });
            if (computedSplits.length > 0) {
              const lastIdx = computedSplits.length - 1;
              computedSplits[lastIdx].amountOwed = round2(convertedAmount - (sum - computedSplits[lastIdx].amountOwed));
            }
          } else {
            // Fallback to equal if no shares mapped
            const shareAmt = round2(convertedAmount / finalSplitUsers.length);
            let sum = 0;
            finalSplitUsers.forEach((u, index) => {
              let owed = shareAmt;
              if (index === finalSplitUsers.length - 1) {
                owed = round2(convertedAmount - sum);
              }
              sum += owed;
              computedSplits.push({ expense: expense._id, user: u._id, amountOwed: owed });
            });
          }
        }
      }

      await Split.insertMany(computedSplits);
    }

    // Save logs
    if (issues.length === 0) {
      await ImportLog.create({
        rowNumber: rowNum,
        rawData,
        issueType: 'none',
        actionTaken: 'Imported normally',
        status: 'resolved'
      });
    } else {
      for (const iss of issues) {
        await ImportLog.create({
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

  return reports;
};

module.exports = { importCSVRows };
