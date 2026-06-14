import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Plus, Folder, User as UserIcon } from 'lucide-react';

const Dashboard = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [category, setCategory] = useState('Home');
  const [error, setError] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const { token, getAuthHeaders } = useAuth();

  const categories = ['Home', 'Trip', 'Couple', 'Other'];

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups', {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setGroups(data);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [token]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }
    setError('');
    setCreatingGroup(true);

    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: groupName, category }),
      });
      const data = await response.json();
      if (response.ok) {
        setGroupName('');
        setCategory('Home');
        setShowCreateModal(false);
        fetchGroups();
      } else {
        setError(data.message || 'Error creating group');
      }
    } catch (err) {
      console.error(err);
      setError('Server error creating group');
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 font-sans text-[#1F1F1F]">
      
      {/* Header section */}
      <div className="flex justify-between items-center mb-8 border-b border-[#E8E8E8] pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider">Your Groups</h1>
          <p className="text-sm opacity-60">Manage shared budgets and settle up debts.</p>
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-[#FF7A1A] hover:bg-[#E56910] text-[#FFFFFF] font-bold py-2 px-4 rounded-none uppercase tracking-wider transition-colors text-xs"
        >
          <Plus size={14} />
          <span>New Group</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm uppercase tracking-wider font-bold">Loading groups...</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 border border-[#E8E8E8] bg-[#F4F4F4] rounded-none">
          <Folder size={48} className="mx-auto mb-4 opacity-40 text-[#1F1F1F]" />
          <h3 className="text-lg font-bold uppercase tracking-wider mb-2">No Groups Found</h3>
          <p className="text-sm opacity-60 mb-6 max-w-sm mx-auto">
            You don't belong to any shared expense groups yet. Create a group to get started.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#1F1F1F] hover:bg-[#333333] text-[#FFFFFF] font-bold py-2 px-6 rounded-none uppercase tracking-wider transition-colors text-xs"
          >
            Create Your First Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <Link
              key={group._id}
              to={`/group/${group._id}`}
              className="block border border-[#E8E8E8] hover:border-[#1F1F1F] bg-[#FFFFFF] hover:bg-[#F4F4F4] p-6 rounded-none transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs uppercase font-bold tracking-wider bg-[#E8E8E8] px-2 py-1">
                  {group.category}
                </span>
                <span className="text-xs opacity-50 uppercase font-bold">
                  Role: {group.role}
                </span>
              </div>

              <h3 className="text-lg font-bold uppercase tracking-wider mb-2 group-hover:text-[#FF7A1A]">
                {group.name}
              </h3>

              <div className="flex items-center text-xs opacity-60 mt-4 space-x-1">
                <UserIcon size={12} />
                <span>Created by: {group.createdBy?.name || 'Unknown'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-[#1F1F1F] bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-[#FFFFFF] border border-[#1F1F1F] w-full max-w-md p-6 rounded-none">
            <h2 className="text-lg font-bold uppercase tracking-wider mb-4 border-b border-[#E8E8E8] pb-2">
              Create New Group
            </h2>

            {error && (
              <div className="bg-[#F4F4F4] border-l-4 border-[#FF7A1A] p-3 mb-4 text-xs font-bold">
                Error: {error}
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-bold tracking-wider mb-1">Group Name *</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
                  placeholder="e.g. Apartment 4B"
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold tracking-wider mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setError('');
                  }}
                  className="w-1/2 border border-[#1F1F1F] bg-[#FFFFFF] hover:bg-[#F4F4F4] font-bold py-2 rounded-none uppercase tracking-wider text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingGroup}
                  className="w-1/2 bg-[#FF7A1A] hover:bg-[#E56910] text-[#FFFFFF] font-bold py-2 rounded-none uppercase tracking-wider text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingGroup ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
