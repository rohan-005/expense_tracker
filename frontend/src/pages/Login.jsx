import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const demoUsers = [
    { name: 'Aisha', label: 'Admin', email: 'aisha@example.com', password: 'password123' },
    { name: 'Rohan', label: 'Member', email: 'rohan@example.com', password: 'password123' },
    { name: 'Priya', label: 'Member', email: 'priya@example.com', password: 'password123' },
    { name: 'Meera', label: 'Departed', email: 'meera@example.com', password: 'password123' },
    { name: 'Dev', label: 'Member', email: 'dev@example.com', password: 'password123' },
    { name: 'Sam', label: 'New Member', email: 'sam@example.com', password: 'password123' },
  ];

  // Fill credentials AND auto-submit
  const handleDemoLogin = async (user) => {
    setEmail(user.email);
    setPassword(user.password);
    setError('');
    setLoading(true);
    try {
      await login(user.email, user.password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid credentials');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid email or password');
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

        <h2 className="text-2xl font-bold uppercase tracking-wider mb-2">Welcome Back</h2>
        <p className="text-[#1F1F1F] opacity-70 mb-6 text-sm">Sign in to manage shared group expenses.</p>

        {error && (
          <div className="bg-[#F4F4F4] border-l-4 border-[#FF7A1A] p-3 mb-6 text-sm">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase font-bold tracking-wider mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
              placeholder="e.g. aisha@example.com"
            />
          </div>

          <div>
            <label className="block text-xs uppercase font-bold tracking-wider mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 pr-10 text-sm rounded-none focus:outline-none focus:border-[#FF7A1A]"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1F1F1F] opacity-40 hover:opacity-80 transition-opacity"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF7A1A] hover:bg-[#E56910] text-[#FFFFFF] font-bold py-2 px-4 rounded-none uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[#E8E8E8] text-center text-xs">
          <span>Don't have an account? </span>
          <Link to="/register" className="text-[#FF7A1A] font-bold hover:underline uppercase tracking-wider">
            Register Here
          </Link>
        </div>

        {/* Quick Demo Login — click to instantly log in */}
        <div className="mt-8 pt-6 border-t border-[#1F1F1F]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase font-bold tracking-wider">Quick Demo Login</span>
            <span className="text-[10px] opacity-40 font-mono">pw: password123</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {demoUsers.map((user) => (
              <button
                key={user.email}
                onClick={() => handleDemoLogin(user)}
                disabled={loading}
                className="border border-[#E8E8E8] bg-[#F4F4F4] hover:bg-[#E8E8E8] hover:border-[#FF7A1A] text-left px-3 py-2 text-xs rounded-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="font-bold truncate">{user.name}</div>
                <div className="opacity-50 truncate text-[10px]">{user.email}</div>
                <div className="mt-0.5">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-[#FF7A1A]">{user.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
