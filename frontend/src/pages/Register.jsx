import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all required fields');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const avatarUrl = avatarSeed 
        ? `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(avatarSeed)}`
        : `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;
        
      await register(name, email, password, avatarUrl);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center p-4 font-sans text-[#1F1F1F]">
      <div className="w-full max-w-md border border-[#1F1F1F] bg-[#FFFFFF] p-8 rounded-none">
        
        {/* Brand */}
        <div className="flex items-center space-x-2 mb-8">
          <div className="w-6 h-6 bg-[#FF7A1A] rounded-none"></div>
          <span className="font-bold text-xl uppercase tracking-wider">Spreetail Split</span>
        </div>

        <h2 className="text-2xl font-bold uppercase tracking-wider mb-2">Create Account</h2>
        <p className="text-[#1F1F1F] opacity-70 mb-6 text-sm">Join to track expenses and split bills with friends.</p>

        {error && (
          <div className="bg-[#F4F4F4] border-l-4 border-[#FF7A1A] p-3 mb-6 text-sm">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase font-bold tracking-wider mb-1">Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
              placeholder="e.g. Aisha Malik"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase font-bold tracking-wider mb-1">Email Address *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
              placeholder="e.g. aisha@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase font-bold tracking-wider mb-1">Password *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase font-bold tracking-wider mb-1">Avatar Seed (Optional)</label>
            <input
              type="text"
              value={avatarSeed}
              onChange={(e) => setAvatarSeed(e.target.value)}
              className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
              placeholder="Custom bot seed for avatar generation"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF7A1A] hover:bg-[#E56910] text-[#FFFFFF] font-bold py-2 px-4 rounded-none uppercase tracking-wider transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[#E8E8E8] text-center text-xs">
          <span>Already have an account? </span>
          <Link to="/login" className="text-[#FF7A1A] font-bold hover:underline uppercase tracking-wider">
            Sign In Here
          </Link>
        </div>

      </div>
    </div>
  );
};

export default Register;
