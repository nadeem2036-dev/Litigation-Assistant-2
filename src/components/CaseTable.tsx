import React, { useState } from 'react';
import { CourtCase } from '../types';
import {
  Calendar,
  Clock,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  Building2,
  UserCheck,
  Scale,
  Landmark,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { formatDisplayDate, parseHearingDate, calculateNotificationTriggerTime } from '../utils/dateUtils';

interface CaseTableProps {
  cases: CourtCase[];
  onDeleteCase: (id: string) => void;
  onUpdateCase?: (updatedCase: CourtCase) => void;
  onRefreshCase?: (courtCase: CourtCase) => void;
  onFetchJudgments?: (caseNo: string, year: string, benchId?: number) => void;
}

export const CaseTable: React.FC<CaseTableProps> = ({
  cases,
  onDeleteCase,
  onUpdateCase,
  onRefreshCase,
  onFetchJudgments,
}) => {
  const [selectedCase, setSelectedCase] = useState<CourtCase | null>(null);
  const [isEditingSelected, setIsEditingSelected] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<CourtCase>>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'decided'>('all');
  const [courtFilter, setCourtFilter] = useState<'all' | 'KPST' | 'PHC'>('all');
  const [refreshingCaseId, setRefreshingCaseId] = useState<string | null>(null);

  const handleRefreshClick = async (e: React.MouseEvent, c: CourtCase) => {
    e.stopPropagation();
    if (!onRefreshCase) return;
    setRefreshingCaseId(c.id);
    try {
      await onRefreshCase(c);
    } finally {
      setRefreshingCaseId(null);
    }
  };

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Filter cases
  const filteredCases = cases.filter((c) => {
    // Court filter
    const isPhc = c.court === 'PHC' || c.id.startsWith('phc-');
    if (courtFilter === 'KPST' && isPhc) return false;
    if (courtFilter === 'PHC' && !isPhc) return false;

    const matchesSearch =
      c.appealNo.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.year.includes(searchFilter) ||
      c.caseTitle.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.natureOfCase.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.department.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (c.advocateName && c.advocateName.toLowerCase().includes(searchFilter.toLowerCase()));

    if (!matchesSearch) return false;

    const hearingDate = parseHearingDate(c.nextDate);
    const isUpcoming = hearingDate && hearingDate.getTime() >= now.getTime();
    const isDecided =
      c.decision?.toLowerCase().includes('accept') ||
      c.decision?.toLowerCase().includes('dismiss') ||
      c.decision?.toLowerCase().includes('decided') ||
      c.decision?.toLowerCase().includes('allowed') ||
      !!c.decidedOn;

    if (activeTab === 'upcoming') return isUpcoming;
    if (activeTab === 'decided') return isDecided;
    return true;
  });

  const getDecisionBadge = (decision: string) => {
    const dec = (decision || '').toLowerCase();
    if (dec.includes('accept')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
          Accepted
        </span>
      );
    }
    if (dec.includes('dismiss')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300">
          Dismissed
        </span>
      );
    }
    if (dec.includes('pending') || dec.includes('hearing')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
          Under Hearing
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-300">
        {decision || 'Under Process'}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Table Controls Bar */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/70">
        {/* Tabs: All / Upcoming / Decided */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({cases.length})
            </button>
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                activeTab === 'upcoming' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3 h-3 text-emerald-600" />
              <span>Upcoming</span>
            </button>
            <button
              onClick={() => setActiveTab('decided')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'decided' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Decided
            </button>
          </div>

          {/* Court Filter: All / KPST / PHC */}
          <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl">
            <button
              onClick={() => setCourtFilter('all')}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition ${
                courtFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Courts
            </button>
            <button
              onClick={() => setCourtFilter('KPST')}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                courtFilter === 'KPST' ? 'bg-emerald-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Scale className="w-3 h-3" />
              <span>KPST</span>
            </button>
            <button
              onClick={() => setCourtFilter('PHC')}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                courtFilter === 'PHC' ? 'bg-blue-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Landmark className="w-3 h-3" />
              <span>PHC</span>
            </button>
          </div>
        </div>

        {/* Filter search box */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search by Appeal, Title, Dept..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full sm:w-64 pl-3.5 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Requirement 5: The data should be in a tabular form in rows and columns */}
      {filteredCases.length === 0 ? (
        <div className="p-12 text-center">
          <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3">
            <Scale className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-700">No Court Cases Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {cases.length === 0
              ? 'Click the "Add Case" button above to enter your Service Appeal No. and Year. Case details will be extracted automatically from KPST.'
              : 'No cases match your filter criteria.'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Phone Proportion Cards View (Block on mobile phones < 768px) */}
          <div className="md:hidden divide-y divide-slate-100 p-2.5 sm:p-3.5 space-y-3 bg-slate-50/50">
            {filteredCases.map((c, index) => {
              const hearingDate = parseHearingDate(c.nextDate);
              const isUpcoming = hearingDate && hearingDate.getTime() >= now.getTime();
              const isDeleted = !!c.isOnDeletedList;
              const isPhc = c.court === 'PHC' || c.id.startsWith('phc-');

              return (
                <div
                  key={`case-card-${c.id}-${c.court}-${c.appealNo}-${c.year}-${index}`}
                  onClick={() => setSelectedCase(c)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                    isDeleted
                      ? 'bg-rose-50/70 border-rose-300 hover:border-rose-400'
                      : 'bg-white border-slate-200 hover:border-emerald-400'
                  }`}
                >
                  {/* Top Row: Index, Court badge, Case No, Hearing seat, and Decision */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-400">#{index + 1}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                          isPhc
                            ? 'bg-blue-100 text-blue-900 border-blue-300'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        }`}
                      >
                        {isPhc ? 'PHC' : 'KPST'}
                      </span>
                      <span className="font-bold text-slate-900 text-xs">
                        {c.appealNo}/{c.year}
                      </span>
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-medium">
                        {c.placeOfHearing || 'Peshawar'}
                      </span>
                    </div>

                    <div className="shrink-0">{getDecisionBadge(c.decision)}</div>
                  </div>

                  {/* Case Title & Respondent */}
                  <div className="font-semibold text-slate-900 text-xs line-clamp-2 mb-1">
                    {c.caseTitle || '-'}
                  </div>
                  <div className="text-[11px] text-slate-600 truncate flex items-center gap-1 mb-2.5">
                    <span className="font-bold text-slate-700 shrink-0">Dept/Resp:</span>
                    <span className="text-slate-800 font-medium truncate">
                      {c.department || (isPhc ? 'Respondent Department' : 'KP Government Department')}
                    </span>
                  </div>

                  {/* Schedule & Bench Details Grid */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] mb-2.5">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Next Date (Fixed On)
                      </span>
                      {c.nextDate && isUpcoming ? (
                        <span className="font-bold text-emerald-800 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{formatDisplayDate(c.nextDate)}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No date fixed</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Bench / Justice
                      </span>
                      <span
                        className="font-bold text-slate-800 line-clamp-1 mt-0.5"
                        title={isPhc ? (c.justiceName || '(-)') : (c.causeListBench || c.bench || '(-)')}
                      >
                        {isPhc
                          ? c.justiceName && c.justiceName !== '(-)'
                            ? c.justiceName
                            : '(-)'
                          : c.causeListBench || c.bench || '(-)'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Court Room
                      </span>
                      <span className="font-medium text-slate-700 mt-0.5 block">
                        {c.courtRoom || (isPhc ? 'Court Room 1' : '—')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Cause List Sr. / Status
                      </span>
                      <div className="flex items-center gap-1 mt-0.5">
                        {isDeleted ? (
                          <span className="inline-flex items-center gap-0.5 font-bold px-1.5 py-0.2 rounded text-[10px] bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                            <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                            <span>DELETED</span>
                          </span>
                        ) : c.causeListSrNo ? (
                          <span className="font-bold text-teal-800 text-[10px]">Sr. #{c.causeListSrNo}</span>
                        ) : (
                          <span className="text-slate-400">Regular</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Touch Action Buttons Bar directly accessible on phone screen */}
                  <div
                    className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1.5">
                      {onRefreshCase && (
                        <button
                          onClick={(e) => handleRefreshClick(e, c)}
                          disabled={refreshingCaseId === c.id}
                          title={isPhc ? 'Sync case with Current Cause List (peshawarhighcourt.gov.pk)' : 'Sync case with KPST'}
                          className="py-1 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-[11px] transition flex items-center gap-1 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 text-emerald-700 ${refreshingCaseId === c.id ? 'animate-spin' : ''}`} />
                          <span>Sync</span>
                        </button>
                      )}
                      {onFetchJudgments && (
                        <button
                          onClick={() => {
                            const numMatch = String(c.appealNo).match(/\d+/);
                            const cleanNo = numMatch ? numMatch[0] : c.appealNo;
                            onFetchJudgments(cleanNo, c.year, c.benchId);
                          }}
                          className="py-1 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg font-bold text-[11px] transition flex items-center gap-1"
                        >
                          <Landmark className="w-3.5 h-3.5 text-blue-700" />
                          <span>Orders</span>
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedCase(c)}
                        className="py-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold text-[11px] transition"
                      >
                        Details
                      </button>
                    </div>

                    <button
                      onClick={() => onDeleteCase(c.id)}
                      title="Remove Case"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop & Tablet Multi-Column Spreadsheet View (Visible md:block) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3 font-semibold text-slate-900">Case / Appeal No.</th>
                  <th className="py-3 px-3 font-semibold text-slate-900">Case Title</th>
                  <th className="py-3 px-3 font-semibold text-slate-900">Decision</th>
                  {/* Early date of hearing sorted first as per Requirement 6, 9 & 10 */}
                  <th className="py-3 px-3 font-semibold text-emerald-900 bg-emerald-50/70 border-x border-emerald-100">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Next Date (Fixed On)</span>
                    </div>
                  </th>
                  {/* Requirement 2: Court room number */}
                  <th className="py-3 px-3 font-semibold text-slate-900">Court Room</th>
                  {/* Requirement 2 & 11: Name of bench / justice */}
                  <th className="py-3 px-3 font-semibold text-slate-900">Bench / Justice</th>
                  {/* Cause List Serial Number */}
                  <th className="py-3 px-3 font-semibold text-slate-900">Cause List Sr. #</th>
                  {/* Requirement 2: Deleted Cases List status */}
                  <th className="py-3 px-3 font-semibold text-slate-900">Roster Status</th>
                  <th className="py-3 px-3 text-right font-semibold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCases.map((c, index) => {
                  const hearingDate = parseHearingDate(c.nextDate);
                  const isUpcoming = hearingDate && hearingDate.getTime() >= now.getTime();
                  const triggerTime = calculateNotificationTriggerTime(c.nextDate);
                  const isDeleted = !!c.isOnDeletedList;
                  const isPhc = c.court === 'PHC' || c.id.startsWith('phc-');

                  return (
                    <tr
                      key={`case-row-${c.id}-${c.court}-${c.appealNo}-${c.year}-${index}`}
                      onClick={() => setSelectedCase(c)}
                      className={`transition-colors cursor-pointer group ${
                        isDeleted ? 'bg-rose-50/40 hover:bg-rose-100/50' : 'hover:bg-emerald-50/30'
                      }`}
                    >
                      {/* Index */}
                      <td className="py-3.5 px-3 text-center text-slate-400 font-medium">{index + 1}</td>

                      {/* Appeal No & Year */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-wider uppercase border ${
                              isPhc
                                ? 'bg-blue-100 text-blue-900 border-blue-300'
                                : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            }`}
                          >
                            {isPhc ? 'PHC' : 'KPST'}
                          </span>
                          <span className="font-bold text-slate-900 group-hover:text-emerald-800 transition">
                            {c.appealNo}/{c.year}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">{c.placeOfHearing || 'Peshawar'}</div>
                      </td>

                      {/* Case Title & Department */}
                      <td className="py-3.5 px-3 max-w-xs">
                        <div className="font-semibold text-slate-900 line-clamp-1">{c.caseTitle || '-'}</div>
                        <div className="text-[10px] text-slate-600 truncate flex items-center gap-1 mt-0.5">
                          <span className="font-semibold text-slate-700 shrink-0">Dept/Resp:</span>
                          <span className="text-slate-800 font-medium truncate">{c.department || (isPhc ? 'Respondent Department' : 'KP Government Department')}</span>
                        </div>
                        {c.advocateName && (
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">
                            Adv: {c.advocateName}
                          </div>
                        )}
                      </td>

                      {/* Decision */}
                      <td className="py-3.5 px-3 whitespace-nowrap">{getDecisionBadge(c.decision)}</td>

                      {/* Next Date (Fixed On) */}
                      <td className="py-3.5 px-3 whitespace-nowrap bg-emerald-50/40 border-x border-emerald-100/70">
                        {c.nextDate && isUpcoming ? (
                          <div>
                            <div className="font-bold flex items-center gap-1 text-emerald-800">
                              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{formatDisplayDate(c.nextDate)}</span>
                            </div>
                            {triggerTime && (
                              <div className="text-[10px] text-amber-700 font-medium">
                                Alert: {formatDisplayDate(triggerTime.toISOString().slice(0, 10))} @ 11:00 AM
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No date fixed</span>
                        )}
                      </td>

                      {/* Court Room # */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {c.courtRoom ? (
                          <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                            {c.courtRoom}
                          </span>
                        ) : isPhc ? (
                          <span className="font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                            Court Room 1
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* Bench / Justice */}
                      <td className="py-3.5 px-3 max-w-[200px]">
                        {isPhc ? (
                          c.justiceName && c.justiceName !== '(-)' ? (
                            <div className="font-bold text-slate-800 text-[11px] line-clamp-1" title={c.justiceName}>
                              {c.justiceName}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">(-)</span>
                          )
                        ) : c.causeListBench || c.bench ? (
                          <div className="font-medium text-slate-800 text-[11px] line-clamp-1" title={c.causeListBench || c.bench}>
                            {c.causeListBench || c.bench}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">(-)</span>
                        )}
                      </td>

                      {/* Cause List Sr. # */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {c.causeListSrNo ? (
                          <span className="inline-flex items-center font-bold px-2 py-0.5 rounded text-[11px] bg-teal-100 text-teal-800 border border-teal-300">
                            Sr. #{c.causeListSrNo}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* Deleted Cases List Status */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {isDeleted ? (
                          <span className="inline-flex items-center gap-1 font-extrabold px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                            <span>DELETED LIST</span>
                          </span>
                        ) : c.causeListSrNo ? (
                          <span className="inline-flex items-center font-medium px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Active Roster
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Regular</span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {onRefreshCase && (
                            <button
                              onClick={(e) => handleRefreshClick(e, c)}
                              disabled={refreshingCaseId === c.id}
                              title={isPhc ? 'Sync case with Current Cause List (peshawarhighcourt.gov.pk)' : 'Sync case with KPST'}
                              className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition flex items-center gap-1 text-[11px] font-semibold disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${refreshingCaseId === c.id ? 'animate-spin' : ''}`} />
                              <span className="hidden xl:inline">Sync</span>
                            </button>
                          )}
                          {onFetchJudgments && (
                            <button
                              onClick={() => {
                                const numMatch = String(c.appealNo).match(/\d+/);
                                const cleanNo = numMatch ? numMatch[0] : c.appealNo;
                                onFetchJudgments(cleanNo, c.year, c.benchId);
                              }}
                              title="Judgment / Order Sheet (PDF)"
                              className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition flex items-center gap-1 text-[11px] font-semibold"
                            >
                              <Landmark className="w-4 h-4 text-blue-700" />
                              <span className="hidden xl:inline">Orders</span>
                            </button>
                          )}
                          <button
                            onClick={() => onDeleteCase(c.id)}
                            title="Remove Case"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Case Details Drawer / Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className={`p-5 text-white flex items-center justify-between ${
              selectedCase.court === 'PHC' || selectedCase.id.startsWith('phc-')
                ? 'bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950'
                : 'bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-900'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-400/30">
                  {selectedCase.court === 'PHC' || selectedCase.id.startsWith('phc-') ? (
                    <Landmark className="w-4 h-4 text-amber-300" />
                  ) : (
                    <Scale className="w-4 h-4 text-amber-300" />
                  )}
                </div>
                <div>
                  <div className="text-[11px] text-emerald-200 font-medium flex items-center gap-1.5">
                    <span>
                      {selectedCase.court === 'PHC' || selectedCase.id.startsWith('phc-')
                        ? 'Peshawar High Court (PHC)'
                        : 'KP Service Tribunal (KPST)'}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg">
                    {selectedCase.appealNo} / {selectedCase.year}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {isEditingSelected ? (
                <div className="space-y-3.5">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <div className="font-bold text-emerald-950 text-xs mb-1">Editing Case Details</div>
                    <div className="text-[11px] text-emerald-800">
                      Appeal No. {selectedCase.appealNo}/{selectedCase.year}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Case Title
                    </label>
                    <input
                      type="text"
                      value={editFormData.caseTitle ?? selectedCase.caseTitle}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, caseTitle: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Nature of Case
                      </label>
                      <input
                        type="text"
                        value={editFormData.natureOfCase ?? selectedCase.natureOfCase}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, natureOfCase: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Next Hearing Date
                      </label>
                      <input
                        type="date"
                        value={editFormData.nextDate ?? selectedCase.nextDate}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, nextDate: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Decision / Status
                      </label>
                      <select
                        value={editFormData.decision ?? selectedCase.decision}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, decision: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600"
                      >
                        <option value="Under Hearing">Under Hearing</option>
                        <option value="Pending">Pending</option>
                        <option value="Accepted">Accepted</option>
                        <option value="Dismissed">Dismissed</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Bench
                      </label>
                      <input
                        type="text"
                        value={editFormData.bench ?? selectedCase.bench}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, bench: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Court Room Number (PHC)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Court Room No. 1"
                        value={editFormData.courtRoom ?? selectedCase.courtRoom ?? ''}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, courtRoom: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Justice / Judge Name(s)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Hon. Mr. Justice Ishtiaq Ibrahim"
                        value={editFormData.justiceName ?? selectedCase.justiceName ?? ''}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, justiceName: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Cause List Sr. #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 14"
                        value={editFormData.causeListSrNo ?? selectedCase.causeListSrNo ?? ''}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, causeListSrNo: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    <div className="col-span-2 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-rose-50 border border-rose-200">
                        <input
                          type="checkbox"
                          checked={editFormData.isOnDeletedList ?? selectedCase.isOnDeletedList ?? false}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, isOnDeletedList: e.target.checked })
                          }
                          className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                        />
                        <span className="text-xs font-bold text-rose-900">
                          Mark as on DELETED CASES LIST (High Court Roster Cancelled / Adjourned)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {selectedCase.isOnDeletedList && (
                    <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-900 flex items-start gap-2.5 animate-pulse">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-extrabold text-xs">⚠️ ON DELETED CASES LIST</div>
                        <p className="text-[11px] text-rose-800 mt-0.5">
                          This case is listed on the official <strong>Deleted Cases List</strong> of Peshawar High Court. The case will not be taken up for hearing on the scheduled date as the bench was reconstituted or deleted.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Peshawar High Court Live Cause List Verification Banner */}
                  {(selectedCase.court === 'PHC' || selectedCase.id.startsWith('phc-')) && (
                    <div className="p-3.5 bg-gradient-to-r from-blue-50 via-slate-50 to-indigo-50 rounded-xl border border-blue-200 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-blue-200/70">
                        <div className="flex items-center gap-1.5">
                          <Landmark className="w-4 h-4 text-blue-900 shrink-0" />
                          <span className="font-extrabold text-xs text-blue-950">
                            Peshawar High Court Cause List (Current_Causelist.html)
                          </span>
                        </div>
                        {selectedCase.causeListPdfUrl && (
                          <a
                            href={selectedCase.causeListPdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-blue-800 hover:text-blue-950 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-blue-300 shadow-xs transition"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-700" />
                            <span>Official Cause List PDF</span>
                          </a>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-white p-2 rounded-lg border border-blue-100">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                            Next Hearing Date
                          </span>
                          <span className="font-extrabold text-emerald-800 mt-0.5 block">
                            {selectedCase.nextDate ? formatDisplayDate(selectedCase.nextDate) : 'Not fixed yet'}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-blue-100">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                            Court Number
                          </span>
                          <span className="font-extrabold text-slate-900 mt-0.5 block">
                            {selectedCase.courtRoom || 'Court Room 1'}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-blue-100">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                            Cause List Serial
                          </span>
                          <span className="font-extrabold text-teal-800 mt-0.5 block">
                            {selectedCase.causeListSrNo ? `Sr. #${selectedCase.causeListSrNo}` : 'Regular / Pending'}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-blue-100">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                            Hon. Justice(s)
                          </span>
                          <span className="font-bold text-slate-900 mt-0.5 block line-clamp-2" title={selectedCase.justiceName}>
                            {selectedCase.justiceName || selectedCase.causeListBench || 'Hon. High Court Bench'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider">
                      Case Title
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">{selectedCase.caseTitle}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Nature of Case</div>
                      <div className="font-semibold text-slate-800 mt-1">{selectedCase.natureOfCase || '-'}</div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Court Decision</div>
                      <div className="mt-1">{getDecisionBadge(selectedCase.decision)}</div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Next Hearing Date</div>
                      <div className="font-bold text-emerald-800 mt-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDisplayDate(selectedCase.nextDate)}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Place of Hearing</div>
                      <div className="font-semibold text-slate-800 mt-1">{selectedCase.placeOfHearing || 'Peshawar'}</div>
                    </div>

                    {/* Requirement 2: Court Room */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Court Room Number</div>
                      <div className="font-bold text-slate-900 mt-1">
                        {selectedCase.courtRoom || (selectedCase.court === 'PHC' || selectedCase.id.startsWith('phc-') ? 'Court Room No. 1' : 'Not Applicable')}
                      </div>
                    </div>

                    {/* Requirement 2: Bench & Justice */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Bench / Justice</div>
                      <div className="font-semibold text-slate-800 mt-1">
                        {selectedCase.justiceName || selectedCase.causeListBench || selectedCase.bench || 'Empty (Not updated yet)'}
                      </div>
                    </div>

                    {/* Requirement 2: Cause list Sr # */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Cause List Sr. #</div>
                      <div className="font-bold text-teal-800 mt-1">
                        {selectedCase.causeListSrNo ? `Sr. #${selectedCase.causeListSrNo}` : 'Empty (Not on list)'}
                      </div>
                    </div>

                    {/* Requirement 2: Deleted List Status */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Deleted Cases List?</div>
                      <div className="mt-1">
                        {selectedCase.isOnDeletedList ? (
                          <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded text-[11px] border border-rose-300">
                            ⚠️ YES (On Deleted List)
                          </span>
                        ) : (
                          <span className="font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                            NO (Active Roster)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Building2 className="w-4 h-4 text-emerald-700" />
                      <span>
                        <strong>Department:</strong> {selectedCase.department || 'KP Government'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <UserCheck className="w-4 h-4 text-emerald-700" />
                      <span>
                        <strong>Advocate Name:</strong> {selectedCase.advocateName || 'Not recorded'}
                      </span>
                    </div>
                    {selectedCase.decidedOn && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="w-4 h-4 text-emerald-700" />
                        <span>
                          <strong>Decided on:</strong> {selectedCase.decidedOn}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Eve 11:00 AM Alert Status */}
                  {selectedCase.nextDate && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                      <div className="font-bold text-[11px] flex items-center gap-1.5 mb-1">
                        <Clock className="w-3.5 h-3.5 text-amber-700" />
                        <span>Automated Hearing Alert (Requirement 8)</span>
                      </div>
                      <p className="text-[11px] text-amber-800">
                        The app notifies you at <strong>11:00 AM on the day before the hearing</strong>:{' '}
                        <code>
                          [{selectedCase.caseTitle || `Appeal ${selectedCase.appealNo}`}] Scheduled for{' '}
                          {formatDisplayDate(selectedCase.nextDate)}
                        </code>
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              {isEditingSelected ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditingSelected(false);
                      setEditFormData({});
                    }}
                    className="py-1.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition"
                  >
                    Cancel Edit
                  </button>

                  <button
                    onClick={() => {
                      const updated: CourtCase = {
                        ...selectedCase,
                        ...editFormData,
                        lastUpdated: new Date().toISOString(),
                      };
                      if (onUpdateCase) {
                        onUpdateCase(updated);
                      }
                      setSelectedCase(updated);
                      setIsEditingSelected(false);
                      setEditFormData({});
                    }}
                    className="py-1.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
                  >
                    Save Changes
                  </button>
                </>
              ) : (
                <>
                <div className="flex flex-wrap items-center gap-2">
                  {onRefreshCase && (
                    <button
                      onClick={async () => {
                        setRefreshingCaseId(selectedCase.id);
                        try {
                          await onRefreshCase(selectedCase);
                        } finally {
                          setRefreshingCaseId(null);
                        }
                      }}
                      disabled={refreshingCaseId === selectedCase.id}
                      className="py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshingCaseId === selectedCase.id ? 'animate-spin' : ''}`} />
                      <span>Sync with Cause List</span>
                    </button>
                  )}
                  {onFetchJudgments && (
                    <button
                      onClick={() => {
                        const numMatch = String(selectedCase.appealNo).match(/\d+/);
                        const cleanNo = numMatch ? numMatch[0] : selectedCase.appealNo;
                        onFetchJudgments(cleanNo, selectedCase.year, selectedCase.benchId);
                        setSelectedCase(null);
                      }}
                      className="py-1.5 px-3 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs active:scale-95"
                    >
                      <Landmark className="w-3.5 h-3.5 text-amber-300" />
                      <span>Judgment / Order Sheet</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsEditingSelected(true);
                      setEditFormData({
                        caseTitle: selectedCase.caseTitle,
                        natureOfCase: selectedCase.natureOfCase,
                        nextDate: selectedCase.nextDate,
                        decision: selectedCase.decision,
                        bench: selectedCase.bench,
                        courtRoom: selectedCase.courtRoom,
                        justiceName: selectedCase.justiceName,
                        causeListSrNo: selectedCase.causeListSrNo,
                        isOnDeletedList: selectedCase.isOnDeletedList,
                      });
                    }}
                    className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition"
                  >
                    Edit Case Details
                  </button>
                </div>

                <button
                  onClick={() => {
                    setSelectedCase(null);
                    setIsEditingSelected(false);
                    setEditFormData({});
                  }}
                  className="py-1.5 px-5 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-700 transition"
                >
                  Close
                </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
