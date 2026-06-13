import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Plus, UserPlus, Upload, FileText, ArrowRight, Trash2, Calendar, DollarSign, MessageSquare } from 'lucide-react';

const GroupDetails = () => {
  const { id } = useParams();
  const { user: currentUser, token, getAuthHeaders } = useAuth();

  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState({ overall: [], pairwise: [] });
  const [loading, setLoading] = useState(true);

  // Modals visibility
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettleUp, setShowSettleUp] = useState(false);

  // Add Member state
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('member');
  const [memberJoinDate, setMemberJoinDate] = useState('');
  const [memberError, setMemberError] = useState('');

  // Settle Up state
  const [settlePayer, setSettlePayer] = useState('');
  const [settlePayee, setSettlePayee] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDate, setSettleDate] = useState('');
  const [settleError, setSettleError] = useState('');

  // Add Expense state
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCurrency, setExpenseCurrency] = useState('INR');
  const [expenseSplitType, setExpenseSplitType] = useState('equal');
  const [expensePaidBy, setExpensePaidBy] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  // Member inputs for splits: maps userId -> true/false (for equal) or value (number for unequal/percentage/share)
  const [splitMembersSelected, setSplitMembersSelected] = useState({});
  const [splitValues, setSplitValues] = useState({});
  const [expenseError, setExpenseError] = useState('');

  // Fetch initial group data, expenses, and balances
  const loadAllData = async () => {
    try {
      setLoading(true);
      
      // Fetch details
      const groupRes = await fetch(`/api/groups/${id}`, { headers: getAuthHeaders() });
      if (!groupRes.ok) throw new Error('Failed to load group details');
      const groupData = await groupRes.json();
      setGroup(groupData);

      // Default paidBy and settle users
      if (groupData.members && groupData.members.length > 0) {
        setExpensePaidBy(groupData.members[0]._id);
        setSettlePayer(groupData.members[0]._id);
        // Default payee to second member if exists
        setSettlePayee(groupData.members[1]?._id || groupData.members[0]._id);

        // Prepopulate split checkboxes as true
        const initialSelected = {};
        groupData.members.forEach(m => {
          initialSelected[m._id] = true;
        });
        setSplitMembersSelected(initialSelected);
      }

      // Fetch expenses
      const expRes = await fetch(`/api/expenses?groupId=${id}`, { headers: getAuthHeaders() });
      if (expRes.ok) {
        const expData = await expRes.json();
        setExpenses(expData);
      }

      // Fetch balances
      const balRes = await fetch(`/api/groups/${id}/balances`, { headers: getAuthHeaders() });
      if (balRes.ok) {
        const balData = await balRes.json();
        setBalances(balData);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [id, token]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!memberEmail.trim()) {
      setMemberError('Email is required');
      return;
    }
    setMemberError('');

    try {
      const response = await fetch(`/api/groups/${id}/members`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          email: memberEmail,
          role: memberRole,
          joinDate: memberJoinDate || undefined
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setMemberEmail('');
        setMemberJoinDate('');
        setShowAddMember(false);
        loadAllData();
      } else {
        setMemberError(data.message || 'Error adding member');
      }
    } catch (err) {
      console.error(err);
      setMemberError('Server error adding member');
    }
  };

  const handleSettleUpSubmit = async (e) => {
    e.preventDefault();
    if (!settleAmount || parseFloat(settleAmount) <= 0) {
      setSettleError('Please enter a valid amount');
      return;
    }
    if (settlePayer === settlePayee) {
      setSettleError('Payer and Payee must be different users');
      return;
    }
    setSettleError('');

    try {
      const response = await fetch('/api/settlements', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          groupId: id,
          fromUser: settlePayer,
          toUser: settlePayee,
          amount: parseFloat(settleAmount),
          date: settleDate || undefined
        }),
      });

      if (response.ok) {
        setSettleAmount('');
        setSettleDate('');
        setShowSettleUp(false);
        loadAllData();
      } else {
        const data = await response.json();
        setSettleError(data.message || 'Error recording settlement');
      }
    } catch (err) {
      console.error(err);
      setSettleError('Server error recording settlement');
    }
  };

  const handleAddExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!expenseDesc.trim()) {
      setExpenseError('Description is required');
      return;
    }
    if (!expenseAmount || parseFloat(expenseAmount) <= 0) {
      setExpenseError('Please enter a valid amount');
      return;
    }
    setExpenseError('');

    // Prepare splits data
    let splitsData = [];
    const activeMembers = group.members.filter(m => !m.leaveDate); // only split with current active members

    if (expenseSplitType === 'equal') {
      // array of userIds selected
      splitsData = activeMembers
        .filter(m => splitMembersSelected[m._id])
        .map(m => m._id);
      if (splitsData.length === 0) {
        setExpenseError('Please select at least one member to split with');
        return;
      }
    } else {
      // unequal, percentage, share: array of { userId, val }
      let totalValue = 0;
      for (const m of activeMembers) {
        const valStr = splitValues[m._id] || '0';
        const val = parseFloat(valStr);
        if (val > 0) {
          splitsData.push({ userId: m._id, val });
          totalValue += val;
        }
      }

      if (splitsData.length === 0) {
        setExpenseError('Please provide split values for members');
        return;
      }

      if (expenseSplitType === 'percentage' && Math.abs(totalValue - 100) > 0.01) {
        setExpenseError(`Total percentage must equal 100%. Current: ${totalValue}%`);
        return;
      }
    }

    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          groupId: id,
          description: expenseDesc,
          amount: parseFloat(expenseAmount),
          currency: expenseCurrency,
          splitType: expenseSplitType,
          paidBy: expensePaidBy,
          date: expenseDate || undefined,
          notes: expenseNotes,
          splitsData
        }),
      });

      if (response.ok) {
        setExpenseDesc('');
        setExpenseAmount('');
        setExpenseNotes('');
        setExpenseDate('');
        setSplitValues({});
        setShowAddExpense(false);
        loadAllData();
      } else {
        const data = await response.json();
        setExpenseError(data.message || 'Error adding expense');
      }
    } catch (err) {
      console.error(err);
      setExpenseError('Server error adding expense');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;

    try {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        loadAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !group) {
    return <div className="text-center py-12 text-sm uppercase tracking-wider font-bold">Loading group details...</div>;
  }

  if (!group) {
    return <div className="text-center py-12 text-sm uppercase tracking-wider font-bold">Group not found.</div>;
  }

  // Find overall net balance of current logged in user
  const userNetBalance = balances.overall.find(o => o.user._id === currentUser._id)?.netBalance || 0;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 font-sans text-[#1F1F1F]">
      
      {/* Top Banner Details */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start border-b border-[#1F1F1F] pb-6 mb-8 gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <span className="text-xs uppercase font-bold tracking-wider bg-[#F4F4F4] px-2 py-1 border border-[#E8E8E8]">
              {group.category}
            </span>
            <span className="text-xs opacity-50 font-bold uppercase">
              Created by {group.createdBy?.name || 'Unknown'}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold uppercase tracking-wide">{group.name}</h1>
          
          <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold uppercase tracking-wider">
            {userNetBalance > 0 ? (
              <div className="text-[#FF7A1A]">You are owed a total of ₹{userNetBalance.toLocaleString('en-IN')}</div>
            ) : userNetBalance < 0 ? (
              <div className="text-[#1F1F1F]">You owe a total of ₹{Math.abs(userNetBalance).toLocaleString('en-IN')}</div>
            ) : (
              <div className="text-[#1F1F1F] opacity-50">You are fully settled up</div>
            )}
          </div>
        </div>

        {/* Buttons Panel */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowAddExpense(true)}
            className="flex items-center space-x-1.5 bg-[#FF7A1A] hover:bg-[#E56910] text-[#FFFFFF] font-bold py-2 px-4 rounded-none uppercase tracking-wider transition-colors text-xs"
          >
            <Plus size={12} />
            <span>Add Expense</span>
          </button>

          <button
            onClick={() => setShowSettleUp(true)}
            className="flex items-center space-x-1.5 border border-[#1F1F1F] bg-[#FFFFFF] hover:bg-[#F4F4F4] font-bold py-2 px-4 rounded-none uppercase tracking-wider transition-colors text-xs"
          >
            <span>Settle Up</span>
          </button>

          <button
            onClick={() => setShowAddMember(true)}
            className="flex items-center space-x-1.5 border border-[#E8E8E8] bg-[#F4F4F4] hover:bg-[#E8E8E8] font-bold py-2 px-4 rounded-none uppercase tracking-wider transition-colors text-xs"
          >
            <UserPlus size={12} />
            <span>Invite Member</span>
          </button>

          <Link
            to={`/group/${id}/import`}
            className="flex items-center space-x-1.5 border border-[#E8E8E8] bg-[#F4F4F4] hover:bg-[#E8E8E8] font-bold py-2 px-4 rounded-none uppercase tracking-wider transition-colors text-xs"
          >
            <Upload size={12} />
            <span>Import CSV</span>
          </Link>

          <Link
            to={`/group/${id}/logs`}
            className="flex items-center space-x-1.5 border border-[#E8E8E8] bg-[#F4F4F4] hover:bg-[#E8E8E8] font-bold py-2 px-4 rounded-none uppercase tracking-wider transition-colors text-xs"
          >
            <FileText size={12} />
            <span>Review Logs</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Expense Ledger */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold uppercase tracking-wider mb-4 border-b border-[#E8E8E8] pb-2">
            Expense History
          </h2>

          {expenses.length === 0 ? (
            <div className="text-center py-12 border border-[#E8E8E8] bg-[#F4F4F4] text-sm opacity-50 uppercase font-bold">
              No expenses recorded yet.
            </div>
          ) : (
            <div className="border border-[#E8E8E8] divide-y divide-[#E8E8E8] bg-[#FFFFFF]">
              {expenses.map((exp) => (
                <div
                  key={exp._id}
                  className="flex items-center justify-between p-4 hover:bg-[#F4F4F4] transition-colors"
                >
                  <Link to={`/expense/${exp._id}`} className="flex-1 flex items-start space-x-4 min-w-0">
                    {/* Date Block */}
                    <div className="flex flex-col items-center bg-[#F4F4F4] border border-[#E8E8E8] px-2.5 py-1.5 text-center min-w-[50px]">
                      <span className="text-[10px] uppercase font-bold opacity-60">
                        {new Date(exp.date).toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-lg font-extrabold leading-none">
                        {new Date(exp.date).getDate()}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <h4 className="font-bold uppercase text-sm truncate tracking-wide text-[#1F1F1F]">
                        {exp.description}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs opacity-60 mt-1">
                        <span>Paid by <span className="font-bold">{exp.paidBy?.name || 'Unknown'}</span></span>
                        <span>•</span>
                        <span>{exp.splitType} split</span>
                        {exp.notes && (
                          <>
                            <span>•</span>
                            <span className="italic truncate max-w-[150px]">Note: "{exp.notes}"</span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center space-x-4 ml-4">
                    <div className="text-right">
                      <div className="font-bold text-sm">
                        {exp.currency === 'USD' ? '$' : '₹'}
                        {exp.amount.toLocaleString('en-IN')}
                      </div>
                      {exp.currency === 'USD' && (
                        <div className="text-[10px] opacity-60">
                          ₹{exp.convertedAmount.toLocaleString('en-IN')} (1 USD = ₹83)
                        </div>
                      )}
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDeleteExpense(exp._id)}
                      className="text-[#1F1F1F] opacity-40 hover:opacity-100 hover:text-red-600 transition-colors p-1"
                      title="Delete Expense"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Members & Balances */}
        <div className="space-y-8">
          
          {/* Member List */}
          <div>
            <h2 className="text-xl font-bold uppercase tracking-wider mb-4 border-b border-[#E8E8E8] pb-2">
              Group Members
            </h2>
            <div className="border border-[#E8E8E8] divide-y divide-[#E8E8E8] bg-[#FFFFFF]">
              {group.members.map((mem) => (
                <div key={mem._id} className="flex items-center justify-between p-3">
                  <div className="flex items-center space-x-3">
                    {mem.avatar_url ? (
                      <img src={mem.avatar_url} className="w-8 h-8 border border-[#E8E8E8] bg-[#F4F4F4] object-contain" alt="" />
                    ) : (
                      <div className="w-8 h-8 bg-[#F4F4F4] border border-[#E8E8E8] flex items-center justify-center font-bold">
                        {mem.name[0]}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-sm">{mem.name}</div>
                      <div className="text-[10px] opacity-60">{mem.email}</div>
                    </div>
                  </div>
                  {mem.leaveDate ? (
                    <span className="text-[9px] uppercase font-bold tracking-wider border border-[#E8E8E8] bg-[#F4F4F4] px-1.5 py-0.5 opacity-50">
                      Left: {new Date(mem.leaveDate).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-[9px] uppercase font-bold tracking-wider border border-[#FF7A1A] text-[#FF7A1A] bg-[#FFFFFF] px-1.5 py-0.5">
                      {mem.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Net Balances and Pairwise */}
          <div>
            <h2 className="text-xl font-bold uppercase tracking-wider mb-4 border-b border-[#E8E8E8] pb-2">
              Balances Ledger
            </h2>

            <div className="space-y-4">
              {/* Pairwise debts */}
              <div className="border border-[#E8E8E8] bg-[#FFFFFF] p-4">
                <h3 className="text-xs uppercase font-bold tracking-widest opacity-60 mb-3 border-b border-[#E8E8E8] pb-1">
                  Settlements Breakdown
                </h3>
                {balances.pairwise.length === 0 ? (
                  <div className="text-xs opacity-50 uppercase font-bold py-2">All settled up!</div>
                ) : (
                  <div className="space-y-2">
                    {balances.pairwise.map((pair, index) => {
                      const amount = Math.abs(pair.net);
                      if (pair.net > 0) {
                        // userB owes userA
                        return (
                          <div key={index} className="flex items-center justify-between text-xs font-medium py-1">
                            <span className="uppercase font-bold">{pair.userB.name}</span>
                            <span className="opacity-60 flex items-center mx-2">
                              owes <span className="uppercase font-extrabold text-[#FF7A1A] ml-1">₹{amount.toLocaleString('en-IN')}</span> to
                            </span>
                            <span className="uppercase font-bold">{pair.userA.name}</span>
                          </div>
                        );
                      } else {
                        // userA owes userB
                        return (
                          <div key={index} className="flex items-center justify-between text-xs font-medium py-1">
                            <span className="uppercase font-bold">{pair.userA.name}</span>
                            <span className="opacity-60 flex items-center mx-2">
                              owes <span className="uppercase font-extrabold text-[#FF7A1A] ml-1">₹{amount.toLocaleString('en-IN')}</span> to
                            </span>
                            <span className="uppercase font-bold">{pair.userB.name}</span>
                          </div>
                        );
                      }
                    })}
                  </div>
                )}
              </div>

              {/* Overall balances */}
              <div className="border border-[#E8E8E8] bg-[#FFFFFF] p-4">
                <h3 className="text-xs uppercase font-bold tracking-widest opacity-60 mb-3 border-b border-[#E8E8E8] pb-1">
                  Individual Net Balances
                </h3>
                <div className="space-y-2">
                  {balances.overall.map((bal, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs font-medium py-1">
                      <span className="uppercase font-bold">{bal.user.name}</span>
                      {bal.netBalance > 0 ? (
                        <span className="font-bold text-[#FF7A1A]">+₹{bal.netBalance.toLocaleString('en-IN')}</span>
                      ) : bal.netBalance < 0 ? (
                        <span className="font-bold text-gray-500">-₹{Math.abs(bal.netBalance).toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="opacity-40 uppercase font-bold">Settled</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* MODAL: Settle Up */}
      {showSettleUp && (
        <div className="fixed inset-0 bg-[#1F1F1F] bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-[#FFFFFF] border border-[#1F1F1F] w-full max-w-md p-6 rounded-none">
            <h2 className="text-lg font-bold uppercase tracking-wider mb-4 border-b border-[#E8E8E8] pb-2">
              Record Settlement Payment
            </h2>

            {settleError && (
              <div className="bg-[#F4F4F4] border-l-4 border-[#FF7A1A] p-3 mb-4 text-xs font-bold">
                Error: {settleError}
              </div>
            )}

            <form onSubmit={handleSettleUpSubmit} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-bold tracking-wider mb-1">From (Who Paid) *</label>
                <select
                  value={settlePayer}
                  onChange={(e) => setSettlePayer(e.target.value)}
                  className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
                >
                  {group.members.map(m => (
                    <option key={m._id} value={m._id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase font-bold tracking-wider mb-1">To (Who Received) *</label>
                <select
                  value={settlePayee}
                  onChange={(e) => setSettlePayee(e.target.value)}
                  className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
                >
                  {group.members.map(m => (
                    <option key={m._id} value={m._id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase font-bold tracking-wider mb-1">Amount (₹ INR) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
                  placeholder="e.g. 5000"
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold tracking-wider mb-1">Date</label>
                <input
                  type="date"
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                  className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowSettleUp(false);
                    setSettleError('');
                  }}
                  className="w-1/2 border border-[#1F1F1F] bg-[#FFFFFF] hover:bg-[#F4F4F4] font-bold py-2 rounded-none uppercase tracking-wider text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-[#FF7A1A] hover:bg-[#E56910] text-[#FFFFFF] font-bold py-2 rounded-none uppercase tracking-wider text-xs transition-colors"
                >
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Invite Member */}
      {showAddMember && (
        <div className="fixed inset-0 bg-[#1F1F1F] bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-[#FFFFFF] border border-[#1F1F1F] w-full max-w-md p-6 rounded-none">
            <h2 className="text-lg font-bold uppercase tracking-wider mb-4 border-b border-[#E8E8E8] pb-2">
              Invite Member to Group
            </h2>

            {memberError && (
              <div className="bg-[#F4F4F4] border-l-4 border-[#FF7A1A] p-3 mb-4 text-xs font-bold">
                Error: {memberError}
              </div>
            )}

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-bold tracking-wider mb-1">Email Address *</label>
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
                  placeholder="e.g. sam@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold tracking-wider mb-1">Role</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase font-bold tracking-wider mb-1">Join Date</label>
                <input
                  type="date"
                  value={memberJoinDate}
                  onChange={(e) => setMemberJoinDate(e.target.value)}
                  className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMember(false);
                    setMemberError('');
                  }}
                  className="w-1/2 border border-[#1F1F1F] bg-[#FFFFFF] hover:bg-[#F4F4F4] font-bold py-2 rounded-none uppercase tracking-wider text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-[#FF7A1A] hover:bg-[#E56910] text-[#FFFFFF] font-bold py-2 rounded-none uppercase tracking-wider text-xs transition-colors"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Expense */}
      {showAddExpense && (
        <div className="fixed inset-0 bg-[#1F1F1F] bg-opacity-40 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#FFFFFF] border border-[#1F1F1F] w-full max-w-lg p-6 rounded-none my-8">
            <h2 className="text-lg font-bold uppercase tracking-wider mb-4 border-b border-[#E8E8E8] pb-2">
              Add Expense
            </h2>

            {expenseError && (
              <div className="bg-[#F4F4F4] border-l-4 border-[#FF7A1A] p-3 mb-4 text-xs font-bold">
                Error: {expenseError}
              </div>
            )}

            <form onSubmit={handleAddExpenseSubmit} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-bold tracking-wider mb-1">Description *</label>
                  <input
                    type="text"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
                    placeholder="e.g. Swiggy Dinner"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase font-bold tracking-wider mb-1">Date</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs uppercase font-bold tracking-wider mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase font-bold tracking-wider mb-1">Currency</label>
                  <select
                    value={expenseCurrency}
                    onChange={(e) => setExpenseCurrency(e.target.value)}
                    className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
                  >
                    <option value="INR">₹ INR</option>
                    <option value="USD">$ USD</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-bold tracking-wider mb-1">Paid By *</label>
                  <select
                    value={expensePaidBy}
                    onChange={(e) => setExpensePaidBy(e.target.value)}
                    className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
                  >
                    {group.members.map(m => (
                      <option key={m._id} value={m._id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase font-bold tracking-wider mb-1">Split Type</label>
                  <select
                    value={expenseSplitType}
                    onChange={(e) => setExpenseSplitType(e.target.value)}
                    className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
                  >
                    <option value="equal">Split Equally</option>
                    <option value="unequal">Split Unequally (Amounts)</option>
                    <option value="percentage">Split by Percentage</option>
                    <option value="share">Split by Shares</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-bold tracking-wider mb-1">Notes</label>
                <textarea
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
                  rows="2"
                  placeholder="e.g. Swiggy coupon applied"
                />
              </div>

              {/* RENDER DYNAMIC SPLIT DATA ENTRY */}
              <div className="border border-[#E8E8E8] bg-[#F4F4F4] p-4 rounded-none">
                <h3 className="text-xs uppercase font-bold tracking-wider mb-3 border-b border-[#E8E8E8] pb-1">
                  Split Details
                </h3>

                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {group.members.filter(m => !m.leaveDate).map(m => (
                    <div key={m._id} className="flex items-center justify-between text-xs">
                      <span className="font-bold">{m.name}</span>
                      
                      {expenseSplitType === 'equal' ? (
                        <input
                          type="checkbox"
                          checked={!!splitMembersSelected[m._id]}
                          onChange={(e) => setSplitMembersSelected({
                            ...splitMembersSelected,
                            [m._id]: e.target.checked
                          })}
                          className="w-4 h-4 accent-[#FF7A1A] rounded-none border border-[#1F1F1F]"
                        />
                      ) : (
                        <div className="flex items-center space-x-1.5">
                          <input
                            type="number"
                            step="any"
                            value={splitValues[m._id] || ''}
                            onChange={(e) => setSplitValues({
                              ...splitValues,
                              [m._id]: e.target.value
                            })}
                            className="w-20 border border-[#E8E8E8] bg-[#FFFFFF] px-2 py-1 text-right focus:outline-none focus:border-[#FF7A1A]"
                            placeholder={
                              expenseSplitType === 'unequal' 
                                ? (expenseCurrency === 'USD' ? '$0' : '₹0')
                                : expenseSplitType === 'percentage' 
                                ? '0%'
                                : '0 shares'
                            }
                          />
                          <span className="opacity-50">
                            {expenseSplitType === 'unequal' ? expenseCurrency : expenseSplitType === 'percentage' ? '%' : 'shares'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddExpense(false);
                    setExpenseError('');
                  }}
                  className="w-1/2 border border-[#1F1F1F] bg-[#FFFFFF] hover:bg-[#F4F4F4] font-bold py-2 rounded-none uppercase tracking-wider text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-[#FF7A1A] hover:bg-[#E56910] text-[#FFFFFF] font-bold py-2 rounded-none uppercase tracking-wider text-xs transition-colors"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default GroupDetails;
