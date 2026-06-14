import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Upload, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import Papa from 'papaparse';

const CSVImporter = () => {
  const { id } = useParams();
  const { token, getAuthHeaders } = useAuth();

  const [csvText, setCsvText] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target.result);
    };
    reader.readAsText(file);
  };

  const handleLocalImport = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setReport(null);

    try {
      const response = await fetch('/api/import/local', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ groupId: id })
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message);
        setReport(data.report || []);
      } else {
        setError(data.message || 'Error executing local import');
      }
    } catch (err) {
      console.error(err);
      setError('Server connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitImport = async (e) => {
    e.preventDefault();
    if (!csvText.trim()) {
      setError('Please upload a file or paste CSV text');
      return;
    }
    setError('');
    setSuccessMsg('');
    setReport(null);
    setLoading(true);

    // Parse CSV on client using PapaParse
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (results.errors.length > 0) {
          setError('Failed to parse CSV syntax locally');
          setLoading(false);
          return;
        }

        try {
          const response = await fetch('/api/import/json', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              groupId: id,
              rows: results.data
            })
          });

          const data = await response.json();
          if (response.ok) {
            setSuccessMsg(data.message);
            setReport(data.report || []);
          } else {
            setError(data.message || 'Error importing data');
          }
        } catch (err) {
          console.error(err);
          setError('Server connection error during import upload');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 font-sans text-[#1F1F1F]">
      
      {/* Back Link */}
      <Link
        to={`/group/${id}`}
        className="inline-flex items-center space-x-1 text-[#FF7A1A] font-bold hover:underline mb-6 text-xs uppercase tracking-wider"
      >
        <ArrowLeft size={12} />
        <span>Back to Group Details</span>
      </Link>

      <div className="border-b border-[#1F1F1F] pb-4 mb-8">
        <h1 className="text-2xl font-bold uppercase tracking-wider">CSV Data Importer</h1>
        <p className="text-sm opacity-60">Upload, paste, or trigger auto-import of expense ledger datasets.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT CARD: Trigger & Inputs */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Quick Auto Importer */}
          <div className="border border-[#1F1F1F] bg-[#F4F4F4] p-6 rounded-none">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-2 flex items-center">
              <FileText size={16} className="mr-2 text-[#FF7A1A]" />
              <span>Workspace File Import</span>
            </h3>
            <p className="text-xs opacity-75 mb-4">
              Directly parse the <strong>Expenses Export.csv</strong> file located in the project's root folder.
            </p>
            <button
              onClick={handleLocalImport}
              disabled={loading}
              className="w-full bg-[#1F1F1F] hover:bg-[#333333] text-[#FFFFFF] font-bold py-2 px-4 rounded-none uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
            >
              {loading ? 'Processing...' : 'Run Auto-Import'}
            </button>
          </div>

          {/* Upload / Paste Panel */}
          <div className="border border-[#1F1F1F] bg-[#FFFFFF] p-6 rounded-none">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center">
              <Upload size={16} className="mr-2 text-[#FF7A1A]" />
              <span>Manual Upload</span>
            </h3>

            {error && (
              <div className="bg-[#F4F4F4] border-l-4 border-red-500 p-3 mb-4 text-xs font-bold">
                Error: {error}
              </div>
            )}

            <form onSubmit={handleSubmitImport} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-bold tracking-wider mb-1">Upload CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="w-full text-xs file:mr-4 file:py-1.5 file:px-3 file:border file:border-[#1F1F1F] file:bg-[#FFFFFF] file:text-[#1F1F1F] file:font-bold file:uppercase file:tracking-wider hover:file:bg-[#F4F4F4]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold tracking-wider mb-1">Or Paste Raw CSV Content</label>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full border border-[#E8E8E8] bg-[#FFFFFF] px-3 py-2 text-xs rounded-none focus:outline-none focus:border-[#FF7A1A]"
                  rows="6"
                  placeholder="Date,Description,Amount,Currency,Split_Type,Split_With,Split_Details,Notes"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FF7A1A] hover:bg-[#E56910] text-[#FFFFFF] font-bold py-2 px-4 rounded-none uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
              >
                {loading ? 'Processing...' : 'Import Data'}
              </button>
            </form>
          </div>

        </div>

        {/* RIGHT COLUMN: Execution Report */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold uppercase tracking-wider border-b border-[#E8E8E8] pb-2 flex items-center">
            <span>Import Execution Report</span>
            {successMsg && (
              <span className="ml-3 text-xs bg-green-100 text-green-800 px-2 py-0.5 font-bold uppercase border border-green-200">
                Completed
              </span>
            )}
          </h2>

          {!report ? (
            <div className="text-center py-16 border border-[#E8E8E8] bg-[#F4F4F4] text-xs font-bold uppercase opacity-50">
              No active import run to display. Run an import on the left to see parsing details.
            </div>
          ) : (
            <div className="border border-[#E8E8E8] bg-[#FFFFFF]">
              <div className="p-4 border-b border-[#E8E8E8] bg-[#F4F4F4] text-xs font-bold">
                Total Rows Processed: {report.length}
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E8E8E8] uppercase tracking-wider font-bold bg-[#FFFFFF]">
                      <th className="p-3 border-r border-[#E8E8E8] w-16 text-center">Row</th>
                      <th className="p-3 border-r border-[#E8E8E8] w-24">Status</th>
                      <th className="p-3 border-r border-[#E8E8E8]">Logged Issues / Flags</th>
                      <th className="p-3">Actions Applied</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E8E8]">
                    {report.map((row) => (
                      <tr key={row.rowNumber} className="hover:bg-[#F4F4F4]">
                        <td className="p-3 border-r border-[#E8E8E8] text-center font-bold">{row.rowNumber}</td>
                        <td className="p-3 border-r border-[#E8E8E8]">
                          {row.status === 'pending_review' ? (
                            <span className="inline-flex items-center text-red-600 font-bold uppercase">
                              <AlertTriangle size={10} className="mr-1" />
                              Review
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-green-600 font-bold uppercase">
                              <CheckCircle size={10} className="mr-1" />
                              Success
                            </span>
                          )}
                        </td>
                        <td className="p-3 border-r border-[#E8E8E8] font-bold text-red-600">
                          {row.issueType !== 'none' ? row.issueType.replace(/_/g, ' ') : '-'}
                        </td>
                        <td className="p-3 font-medium opacity-80">{row.actionTaken}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default CSVImporter;
