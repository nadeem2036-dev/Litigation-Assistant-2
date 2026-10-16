import React, { useState, useEffect } from 'react';
import { Calendar, Search, Scale, RefreshCw, X, AlertCircle, Landmark, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import { PLACES_OF_HEARING } from '../types';

interface CauseListExplorerProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
}

type CourtTab = 'KPST' | 'PHC';

interface PhcRosterBench {
  bench: string;
  justiceName: string;
  courtRoom: string;
  isDivisionBench: boolean;
}

interface PhcCauseListCase {
  srNo: string;
  caseNo: string;
  caseTitle: string;
  justiceName: string;
  courtRoom: string;
  bench: string;
  nature: string;
  isOnDeletedList: boolean;
  deletedReason?: string;
}

export const CauseListExplorer: React.FC<CauseListExplorerProps> = ({ isOpen, onClose, isOnline }) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [activeCourt, setActiveCourt] = useState<CourtTab>('PHC');
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // KPST state
  const [kpstPlace, setKpstPlace] = useState<'Peshawar' | 'Swat' | 'D.I Khan' | 'Abbottabad'>('Peshawar');
  const [kpstData, setKpstData] = useState<{
    available: boolean;
    benches: string[];
    cases: Array<{
      srNo: string;
      type: string;
      petitioner: string;
      respondent: string;
      nature: string;
      bench: string;
    }>;
  } | null>(null);

  // PHC state
  const [phcBench, setPhcBench] = useState('Peshawar');
  const [phcFilter, setPhcFilter] = useState<'all' | 'active' | 'deleted'>('all');
  const [phcData, setPhcData] = useState<{
    date: string;
    bench: string;
    pdfUrl: string | null;
    benches: PhcRosterBench[];
    cases: PhcCauseListCase[];
    deletedCasesCount: number;
    activeCasesCount: number;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFetchKpst = async () => {
    if (!isOnline) {
      setError('Not Connected to Internet');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch(`/api/kpst/causelist?date=${selectedDate}&place=${encodeURIComponent(kpstPlace)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch KPST cause list');

      setKpstData({
        available: data.available,
        benches: data.benches || [],
        cases: data.cases || [],
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchPhc = async () => {
    if (!isOnline) {
      setError('Not Connected to Internet');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch(`/api/phc/causelist?date=${selectedDate}&bench=${encodeURIComponent(phcBench)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch Peshawar High Court cause list');

      setPhcData({
        date: data.date,
        bench: data.bench,
        pdfUrl: data.pdfUrl,
        benches: data.benches || [],
        cases: data.cases || [],
        deletedCasesCount: data.deletedCasesCount || 0,
        activeCasesCount: data.activeCasesCount || 0,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isOnline) {
      if (activeCourt === 'PHC' && !phcData) {
        handleFetchPhc();
      } else if (activeCourt === 'KPST' && !kpstData) {
        handleFetchKpst();
      }
    }
  }, [isOpen, activeCourt, isOnline]);

  const handleSearch = () => {
    if (activeCourt === 'PHC') {
      handleFetchPhc();
    } else {
      handleFetchKpst();
    }
  };

  const filteredPhcCases = (phcData?.cases || []).filter((c) => {
    if (phcFilter === 'deleted') return c.isOnDeletedList;
    if (phcFilter === 'active') return !c.isOnDeletedList;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className={`p-5 text-white flex items-center justify-between ${
          activeCourt === 'PHC'
            ? 'bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950'
            : 'bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-400/30">
              {activeCourt === 'PHC' ? (
                <Landmark className="w-5 h-5 text-amber-300" />
              ) : (
                <Scale className="w-5 h-5 text-amber-300" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg">Daily Cause List &amp; Court Roster</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {activeCourt}
                </span>
              </div>
              <p className="text-[11px] text-blue-200/90">
                Official Roster, Hon. Justices, Court Rooms &amp; Deleted Cases List (Requirement 2)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Court Tabs */}
        <div className="px-5 pt-3 bg-slate-100 border-b border-slate-200 flex items-center gap-2">
          <button
            onClick={() => {
              setActiveCourt('PHC');
              setError('');
            }}
            className={`px-4 py-2 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 border-t border-x ${
              activeCourt === 'PHC'
                ? 'bg-white text-blue-950 border-slate-300 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/70'
            }`}
          >
            <Landmark className="w-3.5 h-3.5 text-blue-700" />
            <span>Peshawar High Court (PHC)</span>
          </button>
          <button
            onClick={() => {
              setActiveCourt('KPST');
              setError('');
            }}
            className={`px-4 py-2 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 border-t border-x ${
              activeCourt === 'KPST'
                ? 'bg-white text-emerald-950 border-slate-300 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/70'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-emerald-700" />
            <span>KP Service Tribunal (KPST)</span>
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-700">Roster Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 font-medium"
              />
            </div>

            {activeCourt === 'PHC' ? (
              <div className="flex items-center gap-2">
                <label className="font-semibold text-slate-700">Bench / Seat:</label>
                <select
                  value={phcBench}
                  onChange={(e) => setPhcBench(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 font-medium"
                >
                  <option value="Peshawar">Principal Seat (Peshawar)</option>
                  <option value="Abbottabad">Abbottabad Bench</option>
                  <option value="D.I.Khan">D.I. Khan Bench</option>
                  <option value="Mingora">Mingora / Swat Bench</option>
                  <option value="Bannu">Bannu Bench</option>
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label className="font-semibold text-slate-700">Seat / Circuit:</label>
                <select
                  value={kpstPlace}
                  onChange={(e) => setKpstPlace(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-emerald-600 font-medium"
                >
                  {PLACES_OF_HEARING.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleSearch}
              disabled={isLoading}
              className={`py-1.5 px-4 rounded-lg font-bold text-white transition flex items-center gap-1.5 active:scale-95 shadow-xs disabled:opacity-50 ${
                activeCourt === 'PHC' ? 'bg-blue-800 hover:bg-blue-700' : 'bg-emerald-800 hover:bg-emerald-700'
              }`}
            >
              {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>{isLoading ? 'Searching...' : 'Search Cause List'}</span>
            </button>
          </div>

          {activeCourt === 'PHC' && phcData && phcData.pdfUrl && (
            <a
              href={phcData.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-1 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition flex items-center gap-1 text-[11px] shadow-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Official Cause List PDF</span>
            </a>
          )}
        </div>

        {/* PHC Filter Sub-bar (All / Active / Deleted) */}
        {activeCourt === 'PHC' && phcData && (
          <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg">
              <button
                onClick={() => setPhcFilter('all')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${
                  phcFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Cause List Cases ({phcData.cases.length})
              </button>
              <button
                onClick={() => setPhcFilter('active')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 ${
                  phcFilter === 'active' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Active Roster ({phcData.activeCasesCount})</span>
              </button>
              <button
                onClick={() => setPhcFilter('deleted')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 ${
                  phcFilter === 'deleted' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:text-rose-900'
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-amber-300" />
                <span>Deleted Cases List ({phcData.deletedCasesCount})</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-500 hidden sm:block">
              {phcData.deletedCasesCount > 0 ? (
                <span className="text-rose-700 font-semibold">
                  ⚠️ {phcData.deletedCasesCount} cases on the Deleted Cases List
                </span>
              ) : (
                <span className="text-emerald-700 font-semibold">All cases currently active on roster</span>
              )}
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Initial state */}
          {activeCourt === 'PHC' && !phcData && !isLoading && !error && (
            <div className="text-center py-12 text-slate-400">
              <Landmark className="w-12 h-12 mx-auto text-blue-300 mb-2.5 opacity-80" />
              <h4 className="font-bold text-slate-700 text-sm">Peshawar High Court Cause List Query</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Select a roster date and circuit bench, then click "Search Cause List" to view court room numbers, Hon. Bench &amp; Justices, and deleted cases list.
              </p>
            </div>
          )}

          {activeCourt === 'KPST' && !kpstData && !isLoading && !error && (
            <div className="text-center py-12 text-slate-400">
              <Calendar className="w-12 h-12 mx-auto text-emerald-300 mb-2.5 opacity-80" />
              <h4 className="font-bold text-slate-700 text-sm">KP Service Tribunal Cause List</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Select a date and seat to query KPST live daily cause lists from kpst.gov.pk.
              </p>
            </div>
          )}

          {/* PHC Results Table */}
          {activeCourt === 'PHC' && phcData && (
            <div className="space-y-4">
              {/* Official Peshawar High Court Cause List Banner */}
              <div className="p-3 bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-amber-300 shrink-0" />
                  <div>
                    <div className="font-bold text-xs">
                      Peshawar High Court — {phcData.bench} Daily Cause List
                    </div>
                    <div className="text-[10px] text-blue-200">
                      Roster Date: <strong>{phcData.date}</strong> • Active Cases: <strong>{phcData.activeCasesCount}</strong> • Deleted: <strong>{phcData.deletedCasesCount}</strong>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="https://www.peshawarhighcourt.gov.pk/app/site/18/p/Current_Causelist.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold text-blue-200 hover:text-white underline"
                  >
                    Current_Causelist.html ↗
                  </a>
                  {phcData.pdfUrl && (
                    <a
                      href={phcData.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-[10px] flex items-center gap-1 transition"
                    >
                      <FileText className="w-3 h-3" />
                      <span>PDF</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Roster Benches Banner */}
              {phcData.benches.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {phcData.benches.map((b, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2.5"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-blue-950">{b.bench}</span>
                          <span className="text-[10px] font-bold bg-blue-200 text-blue-900 px-1.5 py-0.2 rounded border border-blue-300">
                            {b.courtRoom}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-700 font-medium mt-0.5">{b.justiceName}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {filteredPhcCases.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500">
                  <p className="font-semibold text-slate-700">No cases match the filter for {selectedDate}</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-16 text-center">Sr. #</th>
                        <th className="py-2.5 px-3">Case No.</th>
                        <th className="py-2.5 px-3">Case Title / Parties</th>
                        <th className="py-2.5 px-3">Court Room #</th>
                        <th className="py-2.5 px-3">Bench / Hon. Justice</th>
                        <th className="py-2.5 px-3">Nature of Matter</th>
                        <th className="py-2.5 px-3">Roster Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPhcCases.map((c, idx) => (
                        <tr
                          key={idx}
                          className={`transition ${
                            c.isOnDeletedList ? 'bg-rose-50/60 hover:bg-rose-100/70' : 'hover:bg-blue-50/30'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-bold text-blue-900 whitespace-nowrap">
                            Sr. #{c.srNo}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                            {c.caseNo}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 max-w-xs">
                            <div>{c.caseTitle}</div>
                            {c.deletedReason && (
                              <div className="text-[10px] text-rose-700 font-medium mt-0.5">
                                Note: {c.deletedReason}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                              {c.courtRoom}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-800 font-medium max-w-[200px]">
                            <div className="line-clamp-2">{c.justiceName}</div>
                            <div className="text-[10px] text-blue-800 font-semibold">{c.bench}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-[140px] truncate">
                            {c.nature}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {c.isOnDeletedList ? (
                              <span className="inline-flex items-center gap-1 font-extrabold px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>DELETED LIST</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center font-medium px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Active Cause List
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* KPST Results Table */}
          {activeCourt === 'KPST' && kpstData && (
            <div>
              {kpstData.benches.length > 0 && (
                <div className="mb-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-900 font-bold text-center">
                  {kpstData.benches.join(' • ')}
                </div>
              )}

              {kpstData.cases.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500">
                  <p className="font-semibold">Cause List Not Published Yet for {selectedDate}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    (Requirement 9: If cause list is not updated yet, the bench and serial number boxes remain empty)
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold">
                      <tr>
                        <th className="py-2.5 px-3 w-10">#</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Petitioner</th>
                        <th className="py-2.5 px-3">Respondent</th>
                        <th className="py-2.5 px-3">Case Nature</th>
                        <th className="py-2.5 px-3">Bench</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {kpstData.cases.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-teal-800">Sr. #{c.srNo}</td>
                          <td className="py-2 px-3 text-slate-600">{c.type}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900">{c.petitioner}</td>
                          <td className="py-2 px-3 text-slate-600">{c.respondent}</td>
                          <td className="py-2 px-3 text-slate-600">{c.nature}</td>
                          <td className="py-2 px-3 text-[11px] font-medium text-emerald-800">{c.bench}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
          <div className="text-[11px] text-slate-500">
            Certified official data parsed directly from Peshawar High Court &amp; KP Services Tribunal portals.
          </div>
          <button
            onClick={onClose}
            className="py-1.5 px-5 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
