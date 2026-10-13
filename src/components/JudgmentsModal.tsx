import React, { useState, useEffect } from 'react';
import { JudgmentRecord } from '../types';
import {
  FileText,
  Download,
  X,
  Search,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Building2,
  Scale,
  Landmark,
} from 'lucide-react';
import { formatDisplayDate } from '../utils/dateUtils';

interface JudgmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  initialCaseNo?: string;
  initialYear?: string;
  initialBenchId?: number;
}

const PHC_BENCHES = [
  { id: 1, name: 'Principal Seat (Peshawar)' },
  { id: 3, name: 'Abbottabad Bench' },
  { id: 2, name: 'D.I. Khan Bench' },
  { id: 4, name: 'Mingora (Swat) Bench' },
  { id: 5, name: 'Bannu Bench' },
];

export const JudgmentsModal: React.FC<JudgmentsModalProps> = ({
  isOpen,
  onClose,
  isOnline,
  initialCaseNo = '',
  initialYear = new Date().getFullYear().toString(),
  initialBenchId = 1,
}) => {
  const [caseNo, setCaseNo] = useState(initialCaseNo);
  const [year, setYear] = useState(initialYear);
  const [benchId, setBenchId] = useState<number>(initialBenchId);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [caseInfo, setCaseInfo] = useState<{
    caseNo: string;
    year: string;
    title: string;
    bench: string;
    benchId: number;
  } | null>(null);
  const [judgments, setJudgments] = useState<JudgmentRecord[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Sync props when modal opens with initial data
  useEffect(() => {
    if (isOpen) {
      if (initialCaseNo) setCaseNo(initialCaseNo.replace(/[^\d]/g, ''));
      if (initialYear) setYear(initialYear);
      if (initialBenchId) setBenchId(initialBenchId);
      if (initialCaseNo && initialYear) {
        handleSearch(initialCaseNo.replace(/[^\d]/g, ''), initialYear, initialBenchId);
      }
    } else {
      setHasSearched(false);
      setJudgments([]);
      setCaseInfo(null);
      setError('');
    }
  }, [isOpen, initialCaseNo, initialYear, initialBenchId]);

  if (!isOpen) return null;

  async function handleSearch(targetNo?: string, targetYr?: string, targetBench?: number) {
    const searchNo = (targetNo !== undefined ? targetNo : caseNo).trim();
    const searchYr = (targetYr !== undefined ? targetYr : year).trim();
    const searchBench = targetBench !== undefined ? targetBench : benchId;

    if (!searchNo) {
      setError('Please enter the Case Number');
      return;
    }
    if (!searchYr) {
      setError('Please enter the Year');
      return;
    }

    setError('');
    setIsLoading(true);
    setHasSearched(true);
    setJudgments([]);
    setCaseInfo(null);

    try {
      if (!isOnline) {
        throw new Error('You are currently offline. Connect to internet to fetch High Court judgments.');
      }

      const res = await fetch('/api/phc/judgments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseNo: searchNo,
          year: searchYr,
          benchId: searchBench,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch judgments');
      }

      setCaseInfo(data.caseInfo);
      setJudgments(data.files || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header with Balance / High Court theme */}
        <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-950 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-400/30">
              <Landmark className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>Peshawar High Court Judgments</span>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30 font-semibold">
                  Official PDF
                </span>
              </h3>
              <p className="text-[11px] text-emerald-200">
                Direct judicial records from phccfmis.peshawarhighcourt.gov.pk
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 space-y-4 overflow-y-auto text-xs">
          {/* Search Form */}
          <form onSubmit={onSubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Case Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 104"
                  value={caseNo}
                  onChange={(e) => setCaseNo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Year *
                </label>
                <input
                  type="number"
                  required
                  min="1947"
                  max={new Date().getFullYear() + 2}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Bench / Seat
                </label>
                <select
                  value={benchId}
                  onChange={(e) => setBenchId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {PHC_BENCHES.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
                  <span>Searching High Court Database for Judgments...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 text-amber-300" />
                  <span>Fetch Judgments &amp; Order Sheets</span>
                </>
              )}
            </button>
          </form>

          {/* Error notice */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Case metadata card if found */}
          {caseInfo && caseInfo.title && (
            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono font-extrabold text-emerald-950">
                  {caseInfo.caseNo} ({caseInfo.year})
                </span>
                <span className="text-[10px] font-bold text-emerald-800 uppercase px-2 py-0.5 bg-emerald-200/60 rounded-md">
                  {caseInfo.bench}
                </span>
              </div>
              <div className="font-bold text-slate-900 text-sm mt-1">
                {caseInfo.title}
              </div>
            </div>
          )}

          {/* Results list */}
          {hasSearched && !isLoading && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800 text-xs">
                  Available Judgment &amp; Order Files ({judgments.length})
                </span>
                {judgments.length > 0 && (
                  <span className="text-[10px] text-slate-500">
                    Click "Download PDF" to save directly
                  </span>
                )}
              </div>

              {judgments.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
                  <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">No Judgment PDFs Uploaded Yet</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                    No signed order sheet or judgment PDF was found for Case #{caseNo}/{year}. The case may be pending or the registry has not scanned the files yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {judgments.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-400 bg-white hover:bg-emerald-50/20 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs">
                            {item.fileName}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 font-semibold text-slate-700">
                              {item.fileType || 'Order Sheet'}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {item.entryDate || 'Uploaded'}
                            </span>
                            {item.operator && (
                              <>
                                <span>•</span>
                                <span>By: {item.operator}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Download PDF button */}
                      <a
                        href={item.downloadUrl}
                        download={item.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs shrink-0 active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-300" />
                        <span>Download PDF</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
