import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, CheckCircle, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

const ImportLogs = () => {
  const { id } = useParams();
  const { token, getAuthHeaders } = useAuth();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/import/logs', {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Error fetching import logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [id, token]);

  const handleResolveLog = async (logId) => {
    try {
      const response = await fetch(`/api/import/logs/${logId}/resolve`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        // Refresh logs list
        fetchLogs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all import logs? This will reset the review blocks.')) return;
    try {
      const response = await fetch('/api/import/logs', {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        fetchLogs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 font-sans text-[#1F1F1F]">
      
      {/* Back link */}
      <Link
        to={`/group/${id}`}
        className="inline-flex items-center space-x-1 text-[#FF7A1A] font-bold hover:underline mb-6 text-xs uppercase tracking-wider"
      >
        <ArrowLeft size={12} />
        <span>Back to Group Details</span>
      </Link>

      <div className="flex justify-between items-center border-b border-[#1F1F1F] pb-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider">Import Review Logs</h1>
          <p className="text-sm opacity-60">Audit anomaly alerts, duplicates, and manually resolve pending items.</p>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={fetchLogs}
            className="flex items-center space-x-1.5 border border-[#E8E8E8] bg-[#F4F4F4] hover:bg-[#E8E8E8] font-bold py-2 px-4 rounded-none uppercase tracking-wider transition-colors text-xs"
          >
            <RefreshCw size={12} />
            <span>Refresh</span>
          </button>
          
          <button
            onClick={handleClearLogs}
            className="flex items-center space-x-1.5 border border-[#1F1F1F] bg-[#FFFFFF] hover:bg-red-50 text-red-600 font-bold py-2 px-4 rounded-none uppercase tracking-wider transition-colors text-xs"
          >
            <Trash2 size={12} />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm uppercase tracking-wider font-bold">Loading audit logs...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 border border-[#E8E8E8] bg-[#F4F4F4] text-xs font-bold uppercase opacity-50">
          No import logs found in database.
        </div>
      ) : (
        <div className="border border-[#E8E8E8] bg-[#FFFFFF]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E8E8] uppercase tracking-wider font-bold bg-[#F4F4F4]">
                  <th className="p-3 border-r border-[#E8E8E8] w-16 text-center">Row</th>
                  <th className="p-3 border-r border-[#E8E8E8] w-28">Issue Type</th>
                  <th className="p-3 border-r border-[#E8E8E8] w-48">Action Logged</th>
                  <th className="p-3 border-r border-[#E8E8E8]">Raw Row Contents</th>
                  <th className="p-3 border-r border-[#E8E8E8] w-24 text-center">Status</th>
                  <th className="p-3 w-28 text-center">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8E8]">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-[#F4F4F4]">
                    <td className="p-3 border-r border-[#E8E8E8] text-center font-bold">{log.rowNumber}</td>
                    
                    <td className="p-3 border-r border-[#E8E8E8] font-bold text-red-600 uppercase">
                      {log.issueType === 'none' ? '-' : log.issueType.replace(/_/g, ' ')}
                    </td>
                    
                    <td className="p-3 border-r border-[#E8E8E8] font-medium opacity-85">{log.actionTaken}</td>
                    
                    <td className="p-3 border-r border-[#E8E8E8]">
                      <pre className="font-mono text-[10px] bg-[#F4F4F4] p-1.5 border border-[#E8E8E8] overflow-x-auto max-w-xs scrollbar-none">
                        {JSON.stringify(log.rawData, null, 2)}
                      </pre>
                    </td>

                    <td className="p-3 border-r border-[#E8E8E8] text-center">
                      {log.status === 'pending_review' ? (
                        <span className="inline-flex items-center text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 font-bold uppercase">
                          <AlertTriangle size={10} className="mr-1" />
                          Review
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 font-bold uppercase">
                          <CheckCircle size={10} className="mr-1" />
                          Resolved
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      {log.status === 'pending_review' ? (
                        <button
                          onClick={() => handleResolveLog(log._id)}
                          className="bg-[#FF7A1A] hover:bg-[#E56910] text-[#FFFFFF] font-bold py-1 px-2.5 rounded-none uppercase text-[10px] tracking-wider transition-colors"
                        >
                          Resolve
                        </button>
                      ) : (
                        <span className="text-[10px] uppercase font-bold opacity-45">Locked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default ImportLogs;
