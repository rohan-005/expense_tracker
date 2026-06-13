import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, MessageSquare, Send, Calendar, DollarSign, User } from 'lucide-react';
import io from 'socket.io-client';

const ExpenseDetails = () => {
  const { id } = useParams();
  const { user: currentUser, token, getAuthHeaders } = useAuth();

  const [expense, setExpense] = useState(null);
  const [splits, setSplits] = useState([]);
  const [comments, setComments] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const commentsEndRef = useRef(null);
  const socketRef = useRef(null);

  const loadExpenseDetails = async () => {
    try {
      const response = await fetch(`/api/expenses/${id}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setExpense(data);
        setSplits(data.splits || []);
        setComments(data.comments || []);
      } else {
        const data = await response.json();
        setError(data.message || 'Error fetching expense details');
      }
    } catch (err) {
      console.error(err);
      setError('Server error loading details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenseDetails();

    // Setup Socket.IO connection
    const socket = io({
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.emit('join_expense', id);

    socket.on('new_comment', (comment) => {
      // Append comment if not already present
      setComments((prev) => {
        if (prev.some(c => c._id === comment._id)) return prev;
        return [...prev, comment];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [id, token]);

  // Scroll to bottom on new comments
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const response = await fetch(`/api/expenses/${id}/comments`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ message: newMessage }),
      });

      if (response.ok) {
        const commentData = await response.json();
        // Append locally (in case socket listener misses own broadcast)
        setComments((prev) => {
          if (prev.some(c => c._id === commentData._id)) return prev;
          return [...prev, commentData];
        });
        setNewMessage('');
      } else {
        const data = await response.json();
        console.error('Error posting comment:', data.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !expense) {
    return <div className="text-center py-12 text-sm uppercase tracking-wider font-bold">Loading expense details...</div>;
  }

  if (error || !expense) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8 text-center">
        <div className="bg-[#F4F4F4] border-l-4 border-[#FF7A1A] p-4 text-sm font-bold inline-block mb-4">
          Error: {error || 'Expense not found'}
        </div>
        <div>
          <Link to="/" className="text-[#FF7A1A] font-bold hover:underline uppercase text-xs tracking-wider">
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 font-sans text-[#1F1F1F]">
      
      {/* Back link */}
      <Link
        to={`/group/${expense.group}`}
        className="inline-flex items-center space-x-1 text-[#FF7A1A] font-bold hover:underline mb-6 text-xs uppercase tracking-wider"
      >
        <ArrowLeft size={12} />
        <span>Back to Group Ledger</span>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        
        {/* LEFT CARD: Details & Splits */}
        <div className="border border-[#1F1F1F] bg-[#FFFFFF] p-6 rounded-none">
          <div className="flex justify-between items-start mb-4 border-b border-[#E8E8E8] pb-2">
            <span className="text-xs uppercase font-bold tracking-wider bg-[#F4F4F4] px-2.5 py-1 border border-[#E8E8E8]">
              {expense.splitType} split
            </span>
            <span className="text-xs opacity-50 flex items-center">
              <Calendar size={12} className="mr-1" />
              {new Date(expense.date).toLocaleDateString()}
            </span>
          </div>

          <h1 className="text-2xl font-bold uppercase tracking-wide mb-2 text-[#1F1F1F]">
            {expense.description}
          </h1>

          <div className="my-6">
            <div className="text-[10px] uppercase font-extrabold opacity-60 tracking-wider">Total Converted Amount</div>
            <div className="text-4xl font-extrabold text-[#FF7A1A] tracking-tight">
              ₹{expense.convertedAmount.toLocaleString('en-IN')}
            </div>
            {expense.currency === 'USD' && (
              <div className="text-xs opacity-60 mt-1 font-medium">
                Original: ${expense.amount.toLocaleString()} USD (1 USD = ₹83)
              </div>
            )}
          </div>

          <div className="space-y-2 text-xs border-t border-[#E8E8E8] pt-4 mb-6">
            <div className="flex justify-between">
              <span className="opacity-60">Paid By:</span>
              <span className="font-bold uppercase">{expense.paidBy?.name || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-60">Added By:</span>
              <span className="font-bold uppercase">{expense.createdBy?.name || 'Unknown'}</span>
            </div>
            {expense.notes && (
              <div className="flex justify-between">
                <span className="opacity-60">Notes:</span>
                <span className="font-medium italic text-right max-w-[200px] truncate">"{expense.notes}"</span>
              </div>
            )}
          </div>

          {/* Splits list */}
          <div>
            <h3 className="text-xs uppercase font-bold tracking-widest opacity-60 mb-3 border-b border-[#E8E8E8] pb-1">
              Split Breakdown
            </h3>
            <div className="border border-[#E8E8E8] divide-y divide-[#E8E8E8] bg-[#FFFFFF]">
              {splits.map((sp) => (
                <div key={sp._id} className="flex justify-between items-center p-3 text-xs">
                  <div className="flex items-center space-x-2 font-bold">
                    {sp.user?.avatar_url ? (
                      <img src={sp.user.avatar_url} className="w-5 h-5 border border-[#E8E8E8] bg-[#F4F4F4]" alt="" />
                    ) : (
                      <div className="w-5 h-5 bg-[#F4F4F4] border border-[#E8E8E8] flex items-center justify-center text-[10px]">
                        {sp.user?.name[0]}
                      </div>
                    )}
                    <span className="uppercase">{sp.user?.name}</span>
                  </div>
                  <span className="font-bold text-[#1F1F1F]">
                    ₹{sp.amountOwed.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT CARD: Room Chat */}
        <div className="border border-[#1F1F1F] bg-[#FFFFFF] p-6 rounded-none flex flex-col h-[500px]">
          <h2 className="text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#E8E8E8] pb-2 flex items-center">
            <MessageSquare size={16} className="mr-2 text-[#FF7A1A]" />
            <span>Discussion Thread</span>
          </h2>

          {/* Comments Scroller */}
          <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-1 border border-[#E8E8E8] bg-[#F4F4F4] p-3">
            {comments.length === 0 ? (
              <div className="text-center py-12 text-xs opacity-50 uppercase font-bold">
                No comments yet. Start the conversation!
              </div>
            ) : (
              comments.map((comm) => {
                const isOwn = comm.user?._id === currentUser._id;
                return (
                  <div key={comm._id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center space-x-1.5 mb-1 text-[10px] opacity-60 font-bold uppercase">
                      <span>{comm.user?.name}</span>
                      <span>•</span>
                      <span>{new Date(comm.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    
                    <div className={`p-2.5 rounded-none max-w-[85%] text-xs font-medium border ${
                      isOwn 
                        ? 'bg-[#FF7A1A] border-[#FF7A1A] text-[#FFFFFF]' 
                        : 'bg-[#FFFFFF] border-[#E8E8E8] text-[#1F1F1F]'
                    }`}>
                      {comm.message}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={commentsEndRef} />
          </div>

          {/* Reply Form */}
          <form onSubmit={handleSendComment} className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-xs rounded-none focus:outline-none focus:border-[#FF7A1A]"
              placeholder="Write a message..."
              required
            />
            <button
              type="submit"
              className="bg-[#1F1F1F] hover:bg-[#333333] text-[#FFFFFF] px-4 py-2 rounded-none transition-colors"
            >
              <Send size={14} />
            </button>
          </form>

        </div>

      </div>
    </div>
  );
};

export default ExpenseDetails;
