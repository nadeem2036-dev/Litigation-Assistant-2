import React from 'react';
import { UserProfile, CourtCase } from '../types';
import { Scale, RefreshCw, PlusCircle, Download, Bell, Wifi, WifiOff, Edit3, Smartphone, Cloud, User, FileText, Landmark, QrCode, FileDown } from 'lucide-react';
import { formatDisplayDate, parseHearingDate } from '../utils/dateUtils';
import { CloudUserAccount } from '../services/cloudService';
import { PWAInstallButton } from './PWAInstallBanner';

interface WelcomeHeaderProps {
  profile: UserProfile;
  cases: CourtCase[];
  isOnline: boolean;
  updateStatus: 'idle' | 'updating' | 'updated' | 'error';
  lastUpdatedTime: string | null;
  unreadAlertCount: number;
  currentUser?: CloudUserAccount | null;
  onUpdateClick: () => void;
  onAddCaseClick: () => void;
  onDownloadClick: () => void;
  onNotificationsClick: () => void;
  onEditProfileClick: () => void;
  onAccountClick?: () => void;
  onJudgmentsClick?: () => void;
  onScanQrClick?: () => void;
  onCauseListClick?: () => void;
}

export const WelcomeHeader: React.FC<WelcomeHeaderProps> = ({
  profile,
  cases,
  isOnline,
  updateStatus,
  lastUpdatedTime,
  unreadAlertCount,
  currentUser,
  onUpdateClick,
  onAddCaseClick,
  onDownloadClick,
  onNotificationsClick,
  onEditProfileClick,
  onAccountClick,
  onJudgmentsClick,
  onScanQrClick,
  onCauseListClick,
}) => {
  // Requirement 2: Welcome message format
  // "Welcome Mr…….(name of the user) with name of district."
  const welcomeMessage = `Welcome ${profile.honorific || 'Mr.'} ${profile.name} (District ${profile.district})`;

  // Next upcoming hearing
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const upcomingHearings = cases.filter((c) => {
    const d = parseHearingDate(c.nextDate);
    return d && d.getTime() >= now.getTime();
  });

  const nextHearingCase = upcomingHearings[0];

  // Listed on daily cause list
  const listedOnCauseList = cases.filter((c) => !!c.causeListSrNo || !!c.causeListBench);

  // Requirement 7: Update button label and state handling
  const getUpdateButtonContent = () => {
    if (!isOnline) {
      return (
        <span className="flex items-center gap-1.5 text-rose-200">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Not Connected to Internet</span>
        </span>
      );
    }

    if (updateStatus === 'updating') {
      return (
        <span className="flex items-center gap-1.5 text-amber-200">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Updating…</span>
        </span>
      );
    }

    if (updateStatus === 'updated') {
      return (
        <span className="flex items-center gap-1.5 text-emerald-200 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Updated</span>
        </span>
      );
    }

    if (updateStatus === 'error') {
      return (
        <span className="flex items-center gap-1.5 text-rose-300 font-semibold">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Try again</span>
        </span>
      );
    }

    // Idle
    return (
      <span className="flex items-center gap-1.5">
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Update</span>
      </span>
    );
  };

  return (
    <header className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 text-white rounded-2xl shadow-xl p-4 sm:p-6 border border-emerald-800/40 relative overflow-hidden">
      {/* Decorative Balance of Justice watermark */}
      <div className="absolute -right-8 -bottom-10 opacity-5 pointer-events-none">
        <Scale className="w-64 h-64 text-emerald-200" />
      </div>

      {/* Top Bar with Online badge, notification bell, and edit profile */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pb-3.5 border-b border-emerald-800/50 mb-3.5 gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Balance of Justice Icon */}
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-400/30 shadow-md shrink-0">
            <Scale className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-extrabold tracking-wide text-white flex items-center gap-1.5 flex-wrap">
              <span>Litigation Assistant</span>
              <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-400/30 font-bold uppercase shrink-0">
                KPST &amp; PHC
              </span>
            </div>
            <div className="text-[10px] text-emerald-200/80 flex items-center gap-1.5 flex-wrap">
              <span>kpst.gov.pk</span>
              <span>•</span>
              <span>peshawarhighcourt.gov.pk</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                {isOnline ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Wifi className="w-2.5 h-2.5 inline shrink-0" /> Online
                  </span>
                ) : (
                  <span className="text-amber-300 font-semibold flex items-center gap-1 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-400/30">
                    <WifiOff className="w-2.5 h-2.5 inline shrink-0" /> Offline Mode
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Top-Right Quick Navigation Options */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 self-end sm:self-auto">
          {/* In-App Native PWA Install Button (automatically hidden if already in standalone mode) */}
          <PWAInstallButton />

          {/* Notifications Button with badge */}
          <button
            onClick={onNotificationsClick}
            title="Hearing Alerts & Notifications"
            className="relative p-2 rounded-xl bg-emerald-800/60 hover:bg-emerald-700 text-emerald-100 transition border border-emerald-700/40 active:scale-95 shrink-0"
          >
            <Bell className="w-4 h-4" />
            {unreadAlertCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-rose-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-emerald-950 animate-pulse">
                {unreadAlertCount}
              </span>
            )}
          </button>

          {/* Edit Profile Button with Avatar */}
          <button
            onClick={onEditProfileClick}
            title="Edit Name, District & Profile Picture"
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-emerald-800/60 hover:bg-emerald-700 text-emerald-100 transition border border-emerald-700/40 text-xs flex items-center gap-1.5 active:scale-95 shrink-0"
          >
            {profile.profilePictureUrl ? (
              <img
                src={profile.profilePictureUrl}
                alt="User Avatar"
                className="w-5 h-5 rounded-full object-cover border border-amber-300/60 shrink-0"
              />
            ) : (
              <Edit3 className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="font-medium text-[11px] sm:text-xs">Profile</span>
          </button>

          {/* Account / Cloud Sync Button */}
          {onAccountClick && (
            <button
              onClick={onAccountClick}
              title={currentUser ? `Account: @${currentUser.username}` : 'Login / Sync with Cloud'}
              className={`p-1.5 sm:p-2 rounded-xl transition border text-xs flex items-center gap-1.5 active:scale-95 shrink-0 ${
                currentUser
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-400/40'
                  : 'bg-emerald-800/60 hover:bg-emerald-700 text-emerald-100 border-emerald-700/40'
              }`}
            >
              <Cloud className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="font-semibold text-[11px]">
                {currentUser ? `@${currentUser.username}` : 'Cloud'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Main Welcome Message Banner (Requirement 2) */}
      <div className="mb-4">
        <div className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-800/80 text-amber-300 text-[10px] sm:text-[11px] font-medium border border-emerald-700/60 mb-1">
          Official Litigant Portal
        </div>
        <h1 className="text-base sm:text-2xl font-extrabold text-white tracking-tight leading-snug break-words">
          <span>{welcomeMessage}</span>
        </h1>
        <p className="text-[11px] sm:text-xs text-emerald-200/80 mt-1">
          {lastUpdatedTime
            ? `Synchronized with KPST & Peshawar High Court: ${lastUpdatedTime}`
            : 'Automated case status, cause list tracker and 11:00 AM hearing alerts for KPST & PHC.'}
        </p>
      </div>

      {/* Statistics Cards: 2x2 grid on mobile phones, 4 cols on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 mb-3.5">
        <div className="bg-emerald-900/60 backdrop-blur-sm rounded-xl p-2.5 sm:p-3 border border-emerald-800/50">
          <div className="text-[9px] sm:text-[10px] uppercase font-semibold text-emerald-300">Total Cases</div>
          <div className="text-lg sm:text-xl font-bold text-white mt-0.5">{cases.length}</div>
          <div className="text-[9px] sm:text-[10px] text-emerald-200/70">Saved &amp; Offline Available</div>
        </div>

        <div className="bg-emerald-900/60 backdrop-blur-sm rounded-xl p-2.5 sm:p-3 border border-emerald-800/50">
          <div className="text-[9px] sm:text-[10px] uppercase font-semibold text-emerald-300">Upcoming Hearings</div>
          <div className="text-lg sm:text-xl font-bold text-amber-300 mt-0.5">{upcomingHearings.length}</div>
          <div className="text-[9px] sm:text-[10px] text-emerald-200/70">Scheduled Fixed</div>
        </div>

        <div className="bg-emerald-900/60 backdrop-blur-sm rounded-xl p-2.5 sm:p-3 border border-emerald-800/50">
          <div className="text-[9px] sm:text-[10px] uppercase font-semibold text-emerald-300">Next Hearing</div>
          <div className="text-xs sm:text-sm font-bold text-white mt-1 truncate">
            {nextHearingCase ? formatDisplayDate(nextHearingCase.nextDate) : 'None'}
          </div>
          <div className="text-[9px] sm:text-[10px] text-emerald-200/70 truncate">
            {nextHearingCase ? `Appeal #${nextHearingCase.appealNo}` : 'No date set'}
          </div>
        </div>

        <div className="bg-emerald-900/60 backdrop-blur-sm rounded-xl p-2.5 sm:p-3 border border-emerald-800/50">
          <div className="text-[9px] sm:text-[10px] uppercase font-semibold text-emerald-300">Daily Cause List</div>
          <div className="text-lg sm:text-xl font-bold text-teal-300 mt-0.5">{listedOnCauseList.length}</div>
          <div className="text-[9px] sm:text-[10px] text-emerald-200/70">Bench &amp; Sr# Listed</div>
        </div>
      </div>

      {/* Requirement 2: Deleted Cases List Alert Notice if any cases are marked deleted */}
      {cases.some((c) => !!c.isOnDeletedList) && (
        <div className="mb-3.5 p-3 bg-rose-950/80 border border-rose-500/60 rounded-xl text-xs flex items-center justify-between gap-3 text-rose-200 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0" />
            <span className="font-extrabold text-white">
              ⚠️ Attention: {cases.filter((c) => !!c.isOnDeletedList).length} case(s) on Peshawar High Court DELETED CASES LIST!
            </span>
          </div>
          <span className="text-[11px] text-rose-300 font-medium hidden sm:inline">
            Case will not proceed on scheduled date as roster was deleted/adjourned.
          </span>
        </div>
      )}

      {/* Action Buttons Bar: Proportionate Grid for Mobile & Desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
        {/* Requirement 7: The first screen/ interface should have an (Update) button */}
        <button
          onClick={onUpdateClick}
          disabled={!isOnline || updateStatus === 'updating'}
          className={`px-3 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer min-h-[42px] ${
            !isOnline
              ? 'bg-rose-950/80 border border-rose-700/60 text-rose-200 cursor-not-allowed'
              : updateStatus === 'updated'
              ? 'bg-emerald-700/90 hover:bg-emerald-600 text-white border border-emerald-500/60'
              : updateStatus === 'error'
              ? 'bg-rose-900/90 hover:bg-rose-800 text-white border border-rose-600'
              : updateStatus === 'updating'
              ? 'bg-emerald-800/80 text-amber-200 border border-amber-400/40 cursor-wait'
              : 'bg-emerald-800 hover:bg-emerald-700 text-white border border-emerald-600/50'
          }`}
        >
          {getUpdateButtonContent()}
        </button>

        {/* Requirement 3: (Add Case) button */}
        <button
          onClick={onAddCaseClick}
          className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-1.5 active:scale-95 min-h-[42px]"
        >
          <PlusCircle className="w-4 h-4 text-slate-950 shrink-0" />
          <span>Add Case</span>
        </button>

        {/* Requirement 6: Scan Receipt (QR Code) button */}
        {onScanQrClick && (
          <button
            onClick={onScanQrClick}
            title="Scan Peshawar High Court Receipt QR Code"
            className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-1.5 active:scale-95 min-h-[42px]"
          >
            <QrCode className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="truncate">Scan Receipt (QR)</span>
          </button>
        )}

        {/* Requirement 21: Judgment / Order Sheet button */}
        {onJudgmentsClick && (
          <button
            onClick={onJudgmentsClick}
            title="Download Peshawar High Court Judgment or Order Sheets"
            className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-blue-950 hover:bg-blue-900 text-white border border-blue-600/50 transition flex items-center justify-center gap-1.5 active:scale-95 shadow-xs min-h-[42px]"
          >
            <Landmark className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="truncate">Judgment / Orders</span>
          </button>
        )}

        {/* Cause List Explorer Button (Requirement 2 & 17) */}
        {onCauseListClick && (
          <button
            onClick={onCauseListClick}
            title="View Daily Cause List, Court Rooms & Deleted Cases"
            className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-emerald-900/90 hover:bg-emerald-800 text-white border border-emerald-600/50 transition flex items-center justify-center gap-1.5 active:scale-95 shadow-xs min-h-[42px]"
          >
            <FileText className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>Cause List</span>
          </button>
        )}

        {/* Requirement 10: (Download Cases) button */}
        <button
          onClick={onDownloadClick}
          className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-teal-800/80 hover:bg-teal-700 text-white border border-teal-600/50 transition flex items-center justify-center gap-1.5 active:scale-95 min-h-[42px]"
        >
          <Download className="w-3.5 h-3.5 text-teal-200 shrink-0" />
          <span className="truncate">Download Cases</span>
        </button>

        {/* Official Cause List Direct Download Links: Full-width row across mobile grid */}
        <div className="col-span-2 sm:col-span-3 lg:col-span-6 grid grid-cols-2 gap-2 bg-emerald-950/60 p-1.5 rounded-xl border border-emerald-700/40 text-[11px]">
          <a
            href="https://www.peshawarhighcourt.gov.pk/app/site/18/p/Current_Causelist.html"
            target="_blank"
            rel="noopener noreferrer"
            title="Open & Download Peshawar High Court Official Cause List PDF"
            className="w-full justify-center px-2 py-2 rounded-lg bg-blue-900/70 hover:bg-blue-800 text-blue-100 transition font-bold flex items-center gap-1.5 text-center text-xs shadow-xs min-h-[38px]"
          >
            <FileDown className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="truncate">PHC Cause List</span>
          </a>
          <a
            href="https://kpst.gov.pk"
            target="_blank"
            rel="noopener noreferrer"
            title="Open & Download KPST Official Cause List"
            className="w-full justify-center px-2 py-2 rounded-lg bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 transition font-bold flex items-center gap-1.5 text-center text-xs shadow-xs min-h-[38px]"
          >
            <FileDown className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="truncate">KPST Cause List</span>
          </a>
        </div>
      </div>
    </header>
  );
};

