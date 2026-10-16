import React, { useState } from 'react';
import { CourtCase, PLACES_OF_HEARING } from '../types';
import { PlusCircle, Scale, Landmark, Globe, X, Sparkles, ChevronDown, ChevronUp, CheckCircle2, QrCode } from 'lucide-react';
import { formatDisplayDate, parseKpstDateToYMD } from '../utils/dateUtils';

interface AddCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaseAdded: (newCase: CourtCase) => void;
  isOnline: boolean;
  existingCases?: CourtCase[];
  onOpenQrScanner?: () => void;
}

export const AddCaseModal: React.FC<AddCaseModalProps> = ({
  isOpen,
  onClose,
  onCaseAdded,
  isOnline,
  existingCases = [],
  onOpenQrScanner,
}) => {
  const currentYear = new Date().getFullYear().toString();

  // Court Selection: KPST or PHC
  const [courtType, setCourtType] = useState<'KPST' | 'PHC'>('KPST');

  // Core required fields: Case/Appeal Number and Year
  const [appealNo, setAppealNo] = useState('');
  const [year, setYear] = useState(currentYear);

  // Optional manual details (pre-fillable or user editable)
  const [caseTitle, setCaseTitle] = useState('');
  const [natureOfCase, setNatureOfCase] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [decision, setDecision] = useState('Under Hearing');
  const [bench, setBench] = useState('SB');
  const [causeListBench, setCauseListBench] = useState('');
  const [causeListSrNo, setCauseListSrNo] = useState('');
  const [justiceName, setJusticeName] = useState('');
  const [courtRoom, setCourtRoom] = useState('');
  const [advocateName, setAdvocateName] = useState('');
  const [department, setDepartment] = useState('');
  const [placeOfHearing, setPlaceOfHearing] = useState<'Peshawar' | 'Swat' | 'D.I Khan' | 'Abbottabad'>('Peshawar');

  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchStatusMessage, setFetchStatusMessage] = useState('');
  const [error, setError] = useState('');

  // PHC multi-case selection state
  interface PhcCaseMatch {
    id: string;
    appealNo: string;
    year: string;
    caseTitle: string;
    department: string;
    bench: string;
    advocateName: string;
    natureOfCase: string;
    decision: string;
    decidedOn?: string;
    nextDate: string;
    causeListSrNo: string;
    causeListBench: string;
    justiceName?: string;
    courtRoom?: string;
    placeOfHearing: string;
    court: string;
    notes?: string;
  }
  const [phcMatches, setPhcMatches] = useState<PhcCaseMatch[]>([]);
  const [selectedPhcMatchId, setSelectedPhcMatchId] = useState<string | null>(null);
  const [phcBenchId, setPhcBenchId] = useState<number>(1);

  if (!isOpen) return null;

  // Auto-fetch helper from KPST or PHC
  const handleFetchCase = async () => {
    if (!appealNo.trim()) {
      setError(`Please enter the ${courtType === 'PHC' ? 'Case' : 'Service Appeal'} Number first`);
      return;
    }
    if (!year.trim()) {
      setError('Please enter the Year');
      return;
    }

    setError('');
    setIsFetching(true);
    setPhcMatches([]);
    setSelectedPhcMatchId(null);

    if (courtType === 'PHC') {
      setFetchStatusMessage('Searching across peshawarhighcourt.gov.pk, phccfmis & diary portals...');

      try {
        if (!isOnline) throw new Error('Not connected to internet.');

        const response = await fetch('/api/phc/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caseNo: appealNo.trim(),
            year: year.trim(),
            benchId: phcBenchId,
          }),
        });

        const data = await response.json();

        if (data.success && Array.isArray(data.cases) && data.cases.length > 0) {
          if (data.cases.length === 1) {
            // Exactly 1 case matched
            const c = data.cases[0];
            applyCaseDetails(c);
            if (c.causeListSrNo || c.justiceName) {
              setFetchStatusMessage(
                `Verified from PHC Current Cause List! Fixed on: ${c.nextDate} | Court: ${c.courtRoom || 'Court Room 1'} | Hon. ${c.justiceName || 'Justice'} (Sr. #${c.causeListSrNo || '1'})`
              );
            } else {
              setFetchStatusMessage('Case details verified from Peshawar High Court portals!');
            }
          } else {
            // Multiple case types matched (e.g. W.P. vs C.R. vs Cr.M)
            setPhcMatches(data.cases);
            setSelectedPhcMatchId(data.cases[0].id);
            applyCaseDetails(data.cases[0]);
            const matchedOnList = data.cases.find((c: any) => c.causeListSrNo || c.nextDate);
            setFetchStatusMessage(
              matchedOnList
                ? `Found ${data.cases.length} cases (#${appealNo}/${year}). Cause list match: ${matchedOnList.appealNo} fixed on ${matchedOnList.nextDate} before ${matchedOnList.justiceName} (${matchedOnList.courtRoom}, Sr. #${matchedOnList.causeListSrNo}). Please select your case below:`
                : `Found ${data.cases.length} cases with #${appealNo}/${year}. Please select yours below:`
            );
          }
          setShowOptionalFields(true);
        } else {
          setFetchStatusMessage(data.error || 'Record not found across Peshawar High Court portals.');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error contacting PHC portals';
        setFetchStatusMessage(`PHC portals busy: ${msg}. You can enter details manually below.`);
      } finally {
        setIsFetching(false);
      }
    } else {
      // KPST Fetch
      setFetchStatusMessage('Approaching https://kpst.gov.pk (Case & Cause List Search)...');

      try {
        if (!isOnline) throw new Error('Not connected to internet.');

        const response = await fetch('/api/kpst/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appealNo: appealNo.trim(),
            year: year.trim(),
            place: placeOfHearing,
          }),
        });

        const data = await response.json();

        if (data.success && data.caseData) {
          applyCaseDetails(data.caseData);
          setShowOptionalFields(true);
          if (data.caseData.causeListSrNo || data.caseData.causeListBench) {
            setFetchStatusMessage(`Found in Cause List! Fixed before ${data.caseData.causeListBench || data.caseData.bench} (Sr. #${data.caseData.causeListSrNo})`);
          } else {
            setFetchStatusMessage('Data auto-filled from KPST website!');
          }
        } else {
          setFetchStatusMessage('Record not found on KPST. You can still add case manually!');
        }
      } catch {
        setFetchStatusMessage('KPST website busy. You can still add case manually below.');
      } finally {
        setIsFetching(false);
      }
    }
  };

  const applyCaseDetails = (ext: any) => {
    if (ext.caseTitle) setCaseTitle(ext.caseTitle);
    if (ext.natureOfCase) setNatureOfCase(ext.natureOfCase);
    if (ext.decision) setDecision(ext.decision);
    if (ext.nextDate) {
      const ymd = parseKpstDateToYMD(ext.nextDate);
      setNextDate(ymd || ext.nextDate);
    }
    if (ext.bench) setBench(ext.bench);
    if (ext.department) setDepartment(ext.department);
    if (ext.advocateName) setAdvocateName(ext.advocateName);
    if (ext.causeListBench) setCauseListBench(ext.causeListBench);
    if (ext.causeListSrNo) setCauseListSrNo(ext.causeListSrNo);
    if (ext.justiceName) setJusticeName(ext.justiceName);
    if (ext.courtRoom) setCourtRoom(ext.courtRoom);
    if (ext.appealNo && ext.court === 'PHC') setAppealNo(ext.appealNo);
  };

  // Add Case directly to tracking docket
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanAppealNo = appealNo.trim();
    const cleanYear = year.trim();

    if (!cleanAppealNo) {
      setError(`Please enter the ${courtType === 'PHC' ? 'Case' : 'Service Appeal'} Number`);
      return;
    }
    if (!cleanYear || isNaN(Number(cleanYear))) {
      setError('Please enter a valid Year (e.g. 2024)');
      return;
    }

    // Requirement 15 & 19: Double entry of cases should NOT be allowed
    const isAlreadyPresent = existingCases.some(
      (c) =>
        c.court === courtType &&
        c.appealNo.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAppealNo.toLowerCase().replace(/[^a-z0-9]/g, '') &&
        c.year === cleanYear
    );

    if (isAlreadyPresent) {
      setError(`(Already Added) ${courtType === 'PHC' ? 'Case' : 'Service Appeal'} No. ${cleanAppealNo}/${cleanYear} is already added in your docket.`);
      return;
    }

    let finalTitle = caseTitle.trim();
    let finalDept = department.trim();
    let finalNature = natureOfCase.trim();
    let finalDecision = decision || 'Under Hearing';
    let finalDate = nextDate.trim();
    let finalBench = bench.trim();
    let finalCauseListBench = causeListBench.trim();
    let finalCauseListSrNo = causeListSrNo.trim();
    let finalJusticeName = justiceName.trim();
    let finalCourtRoom = courtRoom.trim();
    let finalAdvocate = advocateName.trim();

    // Default fallbacks if empty (Requirement 2: Extract respondent department)
    if (!finalDept) {
      if (finalTitle && finalTitle.includes('VS')) {
        const parts = finalTitle.split(/\s+(?:VS|V\/S|VERSUS)\s+/i);
        finalDept = parts[1] ? parts[1].trim() : 'Respondent Department / State';
      } else {
        finalDept = courtType === 'PHC' ? 'Respondent Department / State' : 'KP Government Department';
      }
    }
    if (!finalTitle) {
      finalTitle = `${courtType === 'PHC' ? 'PHC CASE' : 'APPEAL NO.'} ${cleanAppealNo}/${cleanYear}`;
    }
    if (!finalNature) {
      finalNature = courtType === 'PHC' ? 'High Court Petition / Appeal' : 'Service Appeal';
    }

    const finalCase: CourtCase = {
      id: selectedPhcMatchId || `${courtType.toLowerCase()}-${cleanAppealNo.replace(/\s+/g, '-')}-${cleanYear}-${Date.now()}`,
      court: courtType,
      appealNo: cleanAppealNo,
      year: cleanYear,
      caseTitle: finalTitle,
      department: finalDept,
      bench: finalBench || (courtType === 'PHC' ? 'Single Bench (SB)' : 'SB'),
      justiceName: finalJusticeName,
      courtRoom: finalCourtRoom,
      advocateName: finalAdvocate,
      natureOfCase: finalNature,
      decision: finalDecision,
      decidedOn: '',
      nextDate: finalDate,
      causeListSrNo: finalCauseListSrNo,
      causeListBench: finalCauseListBench,
      placeOfHearing,
      lastUpdated: new Date().toISOString(),
    };

    onCaseAdded(finalCase);

    // Reset fields
    setAppealNo('');
    setYear(currentYear);
    setCaseTitle('');
    setNatureOfCase('');
    setNextDate('');
    setDecision('Under Hearing');
    setBench('SB');
    setDepartment('');
    setCauseListBench('');
    setCauseListSrNo('');
    setJusticeName('');
    setCourtRoom('');
    setAdvocateName('');
    setPhcMatches([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-400/30">
              {courtType === 'PHC' ? (
                <Landmark className="w-5 h-5 text-amber-300" />
              ) : (
                <Scale className="w-5 h-5 text-amber-300" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base">Add Court Case</h3>
              <p className="text-[11px] text-emerald-200">
                {courtType === 'PHC'
                  ? 'Peshawar High Court (https://diary.peshawarhighcourt.gov.pk/)'
                  : 'KP Service Tribunal (https://kpst.gov.pk/)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Court Forum Selector */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Select Court / Forum
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setCourtType('KPST');
                  setDepartment('');
                  setPhcMatches([]);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  courtType === 'KPST'
                    ? 'bg-emerald-800 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-950'
                }`}
              >
                <Scale className="w-3.5 h-3.5 text-amber-300" />
                <span>KPST (Service Tribunal)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCourtType('PHC');
                  setDepartment('Respondent Department / State');
                  setPlaceOfHearing('Peshawar');
                  setPhcMatches([]);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  courtType === 'PHC'
                    ? 'bg-blue-900 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-950'
                }`}
              >
                <Landmark className="w-3.5 h-3.5 text-amber-300" />
                <span>Peshawar High Court</span>
              </button>
            </div>

            {/* Requirement 6: Scan Receipt QR Code Button */}
            {courtType === 'PHC' && onOpenQrScanner && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenQrScanner();
                  }}
                  className="w-full py-2 px-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-900 border border-blue-400/50 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98"
                >
                  <QrCode className="w-4 h-4 text-blue-700" />
                  <span>Scan Receipt with QR Code (Camera / Photo)</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Notice */}
          <div className={`p-3 rounded-xl border text-xs ${
            courtType === 'PHC'
              ? 'bg-blue-50/80 border-blue-200 text-blue-950'
              : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
          }`}>
            <span className="font-bold">
              {courtType === 'PHC' ? 'Peshawar High Court Comprehensive Search:' : 'KPST Case Tracker:'}
            </span>{' '}
            Enter your <strong>{courtType === 'PHC' ? 'Case Number' : 'Service Appeal No.'}</strong> and <strong>Year</strong>. Case title, next hearing date, bench name, and cause list serial number will be searched across{' '}
            {courtType === 'PHC' ? (
              <div className="mt-1 text-[11px] text-blue-900 bg-white/80 p-2 rounded-lg border border-blue-200 space-y-0.5">
                <div>• <strong>Main Portal:</strong> https://www.peshawarhighcourt.gov.pk</div>
                <div>• <strong>CFMIS Portal:</strong> https://phccfmis.peshawarhighcourt.gov.pk/case-search</div>
                <div>• <strong>Diary Portal:</strong> https://diary.peshawarhighcourt.gov.pk/</div>
              </div>
            ) : (
              'https://kpst.gov.pk/'
            )}.
          </div>

          {/* Circuit Bench Selector for PHC */}
          {courtType === 'PHC' && (
            <div>
              <label className="block text-xs font-semibold text-slate-800 uppercase tracking-wider mb-1">
                Peshawar High Court Seat / Bench
              </label>
              <select
                value={phcBenchId}
                onChange={(e) => setPhcBenchId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value={1}>Principal Seat (Peshawar)</option>
                <option value={3}>Abbottabad Bench</option>
                <option value={2}>D.I. Khan Bench</option>
                <option value={4}>Mingora (Swat) Bench</option>
                <option value={5}>Bannu Bench</option>
              </select>
            </div>
          )}

          {/* Core Fields: Case/Appeal No and Year */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-800 uppercase tracking-wider mb-1.5">
                {courtType === 'PHC' ? 'Case Number *' : 'Service Appeal No. *'}
              </label>
              <input
                type="text"
                required
                placeholder={courtType === 'PHC' ? 'e.g. 104 or 250' : 'e.g. 104'}
                value={appealNo}
                onChange={(e) => {
                  setAppealNo(e.target.value);
                  if (error) setError('');
                }}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-inner"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                {courtType === 'PHC' ? 'Case number in PHC online diary' : 'Appeal number allotted by court'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 uppercase tracking-wider mb-1.5">
                Year *
              </label>
              <input
                type="number"
                required
                min="1974"
                max={new Date().getFullYear() + 2}
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  if (error) setError('');
                }}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-inner"
              />
              <p className="text-[10px] text-slate-500 mt-1">Year of institution</p>
            </div>
          </div>

          {/* Place of Hearing (Circuit Bench) */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 uppercase tracking-wider mb-1.5">
              Place / Seat of Hearing
            </label>
            <select
              value={placeOfHearing}
              onChange={(e) => setPlaceOfHearing(e.target.value as any)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {PLACES_OF_HEARING.map((p) => (
                <option key={p} value={p}>
                  {p} {p === 'Peshawar' ? '(Principal Seat)' : '(Circuit Bench)'}
                </option>
              ))}
            </select>
          </div>

          {/* Online Fetch Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleFetchCase}
              disabled={isFetching || !isOnline}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border shadow-sm active:scale-95 disabled:opacity-50 ${
                courtType === 'PHC'
                  ? 'bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100'
                  : 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
              }`}
            >
              {isFetching ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-amber-500" />
                  <span>Approaching {courtType === 'PHC' ? 'PHC' : 'KPST'} Portal...</span>
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4 text-emerald-700" />
                  <span>Fetch Details from {courtType === 'PHC' ? 'PHC (diary.peshawarhighcourt.gov.pk)' : 'KPST (kpst.gov.pk)'}</span>
                </>
              )}
            </button>

            {fetchStatusMessage && (
              <p className="text-[11px] text-slate-600 mt-2 text-center font-medium bg-slate-50 p-2 rounded-lg border border-slate-200">
                {fetchStatusMessage}
              </p>
            )}
          </div>

          {/* PHC Multi-Case Selection Cards (if multiple case types match e.g. W.P. vs C.R. vs Cr.M) */}
          {phcMatches.length > 1 && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <label className="block text-[11px] font-bold text-slate-800">
                Multiple Cases Found. Tap to Select Your Case:
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {phcMatches.map((m, index) => {
                  const isSelected = selectedPhcMatchId === m.id;
                  return (
                    <div
                      key={`match-${m.id}-${m.appealNo}-${m.year}-${index}`}
                      onClick={() => {
                        setSelectedPhcMatchId(m.id);
                        applyCaseDetails(m);
                      }}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                        isSelected
                          ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-blue-900 font-mono text-xs">
                          {m.appealNo} / {m.year}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          m.decision?.toLowerCase().includes('accept') || m.decision?.toLowerCase().includes('allowed')
                            ? 'bg-emerald-100 text-emerald-800'
                            : m.decision?.toLowerCase().includes('dismiss')
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {m.decision || 'Pending'}
                        </span>
                      </div>
                      <div className="font-semibold text-slate-800 mt-1 line-clamp-1">
                        {m.caseTitle}
                      </div>
                      {(m.nextDate || m.causeListSrNo) && (
                        <div className="mt-1.5 p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-900 font-bold flex flex-wrap items-center gap-1.5">
                          <span>Fixed: {m.nextDate}</span>
                          <span>•</span>
                          <span>{m.courtRoom || 'Court Room 1'}</span>
                          {m.causeListSrNo && (
                            <>
                              <span>•</span>
                              <span className="text-teal-800">Sr. #{m.causeListSrNo}</span>
                            </>
                          )}
                          {m.justiceName && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[180px]">{m.justiceName}</span>
                            </>
                          )}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                        <span>Bench: {m.bench}</span>
                        {m.advocateName && <span className="truncate max-w-[160px]">Adv: {m.advocateName}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Toggle Button for Optional/Customizable Details */}
          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowOptionalFields(!showOptionalFields)}
              className="text-xs text-emerald-800 hover:text-emerald-950 font-semibold flex items-center gap-1 transition"
            >
              {showOptionalFields ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <span>{showOptionalFields ? 'Hide Additional Case Fields' : 'Review & Customize Details (Title, Advocate, Bench)'}</span>
            </button>
          </div>

          {/* Detailed Editable Fields */}
          {showOptionalFields && (
            <div className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200 animate-in fade-in duration-200">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Case Title (Petitioner VS Respondent)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Midrarullah VS Pakistan Tobacco Board"
                  value={caseTitle}
                  onChange={(e) => setCaseTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nature / Type of Case
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Writ Petition (W.P.) / Promotion"
                    value={natureOfCase}
                    onChange={(e) => setNatureOfCase(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Advocate / Counsel Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Babar Khan Yousafzai"
                    value={advocateName}
                    onChange={(e) => setAdvocateName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Bench
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Single Bench (SB) / DB-I"
                    value={bench}
                    onChange={(e) => setBench(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Status / Decision
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Pending / Allowed / Under Hearing"
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Next Scheduled Hearing Date
                  </label>
                  <input
                    type="date"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Cause List Serial No. (Sr. #)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1, 14, 25"
                    value={causeListSrNo}
                    onChange={(e) => setCauseListSrNo(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {courtType === 'PHC' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                  <div>
                    <label className="block text-[11px] font-bold text-blue-950 mb-1">
                      Court Number (Court Room)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Court No. 1"
                      value={courtRoom}
                      onChange={(e) => setCourtRoom(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-950 mb-1">
                      Name of Hon. Justice / Judges
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mr. Justice S.M. Attique Shah, Chief Justice"
                      value={justiceName}
                      onChange={(e) => setJusticeName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              className={`flex-1 py-2.5 px-4 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md active:scale-95 ${
                courtType === 'PHC' ? 'bg-blue-800 hover:bg-blue-900' : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-amber-300" />
              <span>Add to Court Docket</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
