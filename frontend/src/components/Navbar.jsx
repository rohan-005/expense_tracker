import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="w-full bg-[#FFFFFF] border-b border-[#1F1F1F] text-[#1F1F1F] px-6 py-4 font-sans">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        
        {/* Brand Link */}
        <Link to="/" className="flex items-center space-x-2">
          <div className="w-5 h-5 bg-[#FF7A1A] rounded-none"></div>
          <span className="font-bold text-lg uppercase tracking-wider">Spreetail Split</span>
        </Link>

        {/* User controls */}
        {user && (
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-8 h-8 rounded-none border border-[#E8E8E8] bg-[#F4F4F4] object-contain"
                />
              ) : (
                <div className="w-8 h-8 rounded-none bg-[#F4F4F4] border border-[#E8E8E8] flex items-center justify-center">
                  <User size={16} />
                </div>
              )}
              <span className="text-sm font-bold uppercase tracking-wider hidden sm:inline">{user.name}</span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 px-3 py-1.5 border border-[#1F1F1F] bg-[#FFFFFF] hover:bg-[#F4F4F4] transition-colors rounded-none text-xs uppercase font-bold tracking-wider"
            >
              <LogOut size={12} />
              <span>Log Out</span>
            </button>
          </div>
        )}

      </div>
    </nav>
  );
};

export default Navbar;
