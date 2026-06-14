import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, CheckCircle, AlertTriangle, RefreshCw, Trash2, Download, Copy, Check } from 'lucide-react';

// Format a date as DD-MM-YYYY
const fmtDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

// Convert logs array to CSV string
const logsToCSV = (logs) => {
  const header = ['Row #', 'Issue Type', 'Action Taken', 'Status', 'Date', 'Raw Data'];
  const rows = logs.map(log => {
    const rawStr = JSON.stringify(log.rawData || {}).replace(/"/g, '""');
    const date = fmtDate(log.rawData?.date || log.created_at);
    return [
      log.rowNumber,
      log.issueType === 'none' ? 'OK' : log.issueType.replace(/_/g, ' ').toUpperCase(),
      `"${(log.actionTaken || '').replace(/"/g, '""')}"`,
      log.status === 'resolved' ? 'RESOLVED' : 'PENDING REVIEW',
      date,
      `"${rawStr}"`
    ].join(',');
  });
  return [header.join(','), ...rows].join('\n');
};

// Convert logs to human-readable text report
const logsToTextReport = (logs) => {
  const generated = fmtDate(new Date().toISOString());
  const lines = [
    `SPREETAIL SPLIT — CSV IMPORT ANOMALY REPORT`,
    `Generated: ${generated}`,
    `Total Log Entries: ${logs.length}`,
    ``,
    `${'─'.repeat(80)}`,
    ``
  ];

  const pending = logs.filter(l => l.status === 'pending_review');
  const resolved = logs.filter(l => l.status === 'resolved' && l.issueType !== 'none');
  const clean = logs.filter(l => l.status === 'resolved' && l.issueType === 'none');

  lines.push(`SUMMARY`);
  lines.push(`  ✓ Clean rows imported normally: ${clean.length}`);
  lines.push(`  ⚠ Anomalies auto-resolved: ${resolved.length}`);
  lines.push(`  ✗ Pending manual review: ${pending.length}`);
  lines.push(``);
  lines.push(`${'─'.repeat(80)}`);
  lines.push(``);

  logs.forEach((log, i) => {
    const rawDate = log.rawData?.date ? fmtDate(log.rawData.date) : '-';
    lines.push(`[${i + 1}] Row #${log.rowNumber}`);
    lines.push(`    Status    : ${log.status === 'resolved' ? 'RESOLVED' : 'PENDING REVIEW'}`);
    lines.push(`    Issue     : ${log.issueType === 'none' ? 'None (imported normally)' : log.issueType.replace(/_/g, ' ').toUpperCase()}`);
    lines.push(`    Action    : ${log.actionTaken}`);
    lines.push(`    Date      : ${rawDate}`);
    if (log.rawData) {
      lines.push(`    Raw Row   : ${JSON.stringify(log.rawData)}`);
    }
    lines.push(``);
  });

  lines.push(`${'─'.repeat(80)}`);
  lines.push(`END OF REPORT`);

  return lines.join('\n');
};

const ImportLogs = () => {
  const { id } = useParams();
  const { token, getAuthHeaders } = useAuth();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolvingMap, setResolvingMap] = useState({});
  const [clearing, setClearing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState('all'); // all | pending | resolved

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/import/logs', { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Error fetching import logs:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleResolveLog = async (logId) => {
    setResolvingMap(prev => ({ ...prev, [logId]: true }));
    try {
      const response = await fetch(`/api/import/logs/${logId}/resolve`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (response.ok) await fetchLogs();
    } catch (err) {
      console.error(err);
    } finally {
      setResolvingMap(prev => ({ ...prev, [logId]: false }));
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Clear all import logs? This cannot be undone.')) return;
    setClearing(true);
    try {
      const response = await fetch('/api/import/logs', { method: 'DELETE', headers: getAuthHeaders() });
      if (response.ok) await fetchLogs();
    } catch (err) {
      console.error(err);
    } finally {
      setClearing(false);
    }
  };

  // Download as CSV
  const handleDownloadCSV = () => {
    const csv = logsToCSV(logs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-report-${fmtDate(new Date().toISOString())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download as TXT report
  const handleDownloadTXT = () => {
    const txt = logsToTextReport(logs);
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-report-${fmtDate(new Date().toISOString())}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy report text to clipboard
  const handleCopyReport = async () => {
    const txt = logsToTextReport(logs);
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Clipboard error:', err);
    }
  };

  const displayLogs = logs.filter(l => {
    if (filter === 'pending') return l.status === 'pending_review';
    if (filter === 'resolved') return l.status === 'resolved';
    return true;
  });

  const pendingCount = logs.filter(l => l.status === 'pending_review').length;
  const resolvedCount = logs.filter(l => l.status === 'resolved').length;
  const anomalyCount = logs.filter(l => l.issueType !== 'none').length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 font-sans text-[#1F1F1F]">

      {/* Back link */}
      <Link
        to={`/group/${id}`}
        className="inline-flex items-center space-x-1 text-[#FF7A1A] font-bold hover:underline mb-6 text-xs uppercase tracking-wider"
      >
        <ArrowLeft size={12} />
        <span>Back to Group Details</span>
      </Link>

      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4 border-b border-[#1F1F1F] pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider">Import Anomaly Report</h1>
          <p className="text-sm opacity-60 mt-1">
            Every row from the CSV — issue detected, action taken, and current resolution status.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={fetchLogs}
            title="Refresh logs"
            className="flex items-center space-x-1.5 border border-[#E8E8E8] bg-[#F4F4F4] hover:bg-[#E8E8E8] font-bold py-2 px-3 rounded-none uppercase tracking-wider transition-colors text-xs"
          >
            <RefreshCw size={12} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleDownloadCSV}
            disabled={logs.length === 0}
            title="Download report as CSV"
            className="flex items-center space-x-1.5 border border-[#1F1F1F] bg-[#1F1F1F] hover:bg-[#333333] text-white font-bold py-2 px-3 rounded-none uppercase tracking-wider transition-colors text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={12} />
            <span>CSV</span>
          </button>

          <button
            onClick={handleDownloadTXT}
            disabled={logs.length === 0}
            title="Download full text report"
            className="flex items-center space-x-1.5 border border-[#FF7A1A] bg-[#FF7A1A] hover:bg-[#E56910] text-white font-bold py-2 px-3 rounded-none uppercase tracking-wider transition-colors text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={12} />
            <span>Full Report</span>
          </button>

          <button
            onClick={handleCopyReport}
            disabled={logs.length === 0}
            title="Copy full report to clipboard"
            className="flex items-center space-x-1.5 border border-[#E8E8E8] bg-[#FFFFFF] hover:bg-[#F4F4F4] font-bold py-2 px-3 rounded-none uppercase tracking-wider transition-colors text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          <button
            onClick={handleClearLogs}
            disabled={clearing}
            className="flex items-center space-x-1.5 border border-red-300 bg-[#FFFFFF] hover:bg-red-50 text-red-600 font-bold py-2 px-3 rounded-none uppercase tracking-wider transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={12} />
            <span>{clearing ? 'Clearing...' : 'Clear All'}</span>
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {!loading && logs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Entries', value: logs.length, color: '' },
            { label: 'Anomalies Flagged', value: anomalyCount, color: 'text-red-600' },
            { label: 'Pending Review', value: pendingCount, color: 'text-amber-600' },
            { label: 'Resolved', value: resolvedCount, color: 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="border border-[#E8E8E8] bg-[#FFFFFF] p-3">
              <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] uppercase tracking-wider opacity-60 font-bold mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      {!loading && logs.length > 0 && (
        <div className="flex space-x-1 mb-4">
          {[
            { key: 'all', label: `All (${logs.length})` },
            { key: 'pending', label: `Pending (${pendingCount})` },
            { key: 'resolved', label: `Resolved (${resolvedCount})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`py-1.5 px-3 text-xs font-bold uppercase tracking-wider border rounded-none transition-colors ${
                filter === tab.key
                  ? 'bg-[#1F1F1F] text-white border-[#1F1F1F]'
                  : 'bg-[#FFFFFF] text-[#1F1F1F] border-[#E8E8E8] hover:bg-[#F4F4F4]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-sm uppercase tracking-wider font-bold">Loading audit logs...</div>
      ) : displayLogs.length === 0 ? (
        <div className="text-center py-16 border border-[#E8E8E8] bg-[#F4F4F4] text-xs font-bold uppercase opacity-50">
          {logs.length === 0 ? 'No import logs found. Import the CSV first.' : 'No logs match this filter.'}
        </div>
      ) : (
        <div className="border border-[#E8E8E8] bg-[#FFFFFF] overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E8E8E8] uppercase tracking-wider font-bold bg-[#F4F4F4]">
                <th className="p-3 border-r border-[#E8E8E8] w-14 text-center">Row</th>
                <th className="p-3 border-r border-[#E8E8E8] w-14 text-center">Date</th>
                <th className="p-3 border-r border-[#E8E8E8] w-32">Issue</th>
                <th className="p-3 border-r border-[#E8E8E8]">Action Taken</th>
                <th className="p-3 border-r border-[#E8E8E8] w-28 text-center">Status</th>
                <th className="p-3 w-24 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8E8]">
              {displayLogs.map((log) => {
                const rawDate = log.rawData?.date ? fmtDate(log.rawData.date) : '-';
                const isPending = log.status === 'pending_review';
                return (
                  <tr key={log._id} className={`hover:bg-[#F4F4F4] ${isPending ? 'bg-amber-50/30' : ''}`}>
                    <td className="p-3 border-r border-[#E8E8E8] text-center font-bold">{log.rowNumber}</td>
                    <td className="p-3 border-r border-[#E8E8E8] text-center font-mono text-[10px] whitespace-nowrap">{rawDate}</td>
                    <td className="p-3 border-r border-[#E8E8E8]">
                      {log.issueType === 'none' ? (
                        <span className="text-green-600 font-bold uppercase">OK</span>
                      ) : (
                        <span className="font-bold text-red-600 uppercase leading-tight">
                          {log.issueType.replace(/_/g, ' ')}
                        </span>
                      )}
                    </td>
                    <td className="p-3 border-r border-[#E8E8E8] font-medium opacity-85 max-w-xs">
                      {log.actionTaken}
                    </td>
                    <td className="p-3 border-r border-[#E8E8E8] text-center">
                      {isPending ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 font-bold uppercase">
                          <AlertTriangle size={9} />
                          Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 font-bold uppercase">
                          <CheckCircle size={9} />
                          Resolved
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {isPending ? (
                        <button
                          onClick={() => handleResolveLog(log._id)}
                          disabled={resolvingMap[log._id]}
                          className="bg-[#FF7A1A] hover:bg-[#E56910] text-white font-bold py-1 px-2.5 rounded-none uppercase text-[10px] tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {resolvingMap[log._id] ? '...' : 'Resolve'}
                        </button>
                      ) : (
                        <span className="text-[10px] uppercase font-bold opacity-40">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ImportLogs;
