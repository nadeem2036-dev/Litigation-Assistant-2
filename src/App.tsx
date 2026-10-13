/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { UserProfile, CourtCase, HearingAlert } from './types';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { sortCasesByHearingDate, generateCaseAlert, formatDisplayDate, calculateNotificationTriggerTime } from './utils/dateUtils';
import { playAlertChime } from './utils/soundUtils';
import { WelcomeHeader } from './components/WelcomeHeader';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { CaseTable } from './components/CaseTable';
import { AddCaseModal } from './components/AddCaseModal';
import { OnboardingModal } from './components/OnboardingModal';
import { NotificationCenter } from './components/NotificationCenter';
import { DownloadModal } from './components/DownloadModal';
import { CauseListExplorer } from './components/CauseListExplorer';
import { AndroidFrame } from './components/AndroidFrame';
import { AuthModal } from './components/AuthModal';
import { JudgmentsModal } from './components/JudgmentsModal';
import { PhcQrScannerModal } from './components/PhcQrScannerModal';
import {
  getActiveUserId,
  setActiveUserId,
  getUserProfile,
  getUserCases,
  saveUserCases,
  saveLocalUser,
  normalizeUserId,
} from './utils/userStorage';
import {
  CloudUserAccount,
  fetchCloudCases,
  saveCloudCase,
  deleteCloudCase,
  syncAllCasesToCloud,
} from './services/cloudService';
import { Bell, AlertCircle, CheckCircle2, WifiOff, X } from 'lucide-react';

const STORAGE_KEYS = {
  PROFILE: 'kpst_user_profile',
  CASES: 'kpst_court_cases',
  ALERTS: 'kpst_hearing_alerts',
  LAST_UPDATE: 'kpst_last_updated',
};

// Initial cases for fresh users (Empty docket by default)
const INITIAL_CASES: CourtCase[] = [];

export default function App() {
  const isOnline = useOnlineStatus();
  const [, startTransition] = useTransition();

  // User Account & Multi-device Sync State
  const [currentUser, setCurrentUser] = useState<CloudUserAccount | null>(() => {
    const saved = localStorage.getItem('kpst_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // invalid json
      }
    }
    return null;
  });

  // User Profile State (Multi-User Isolation via localStorage)
  const [profile, setProfile] = useState<UserProfile>(() => {
    const activeId = getActiveUserId();
    if (activeId) {
      const userProf = getUserProfile(activeId);
      if (userProf) return userProf;
    }
    const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // invalid json
      }
    }
    return {
      name: '',
      honorific: 'Mr.',
      district: 'Peshawar',
      isOnboarded: false,
    };
  });

  // Court Cases State (Loaded directly from offline storage, 100% accessible offline)
  const [cases, setCases] = useState<CourtCase[]>(() => {
    const activeId = getActiveUserId();
    if (activeId) {
      const userCases = getUserCases(activeId);
      if (userCases.length > 0) return userCases;
    }
    const savedCases = localStorage.getItem(STORAGE_KEYS.CASES);
    if (savedCases) {
      try {
        return JSON.parse(savedCases);
      } catch {
        // fallback
      }
    }
    return [];
  });

  // Last Updated Time
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEYS.LAST_UPDATE);
  });

  // Requirement 7: Update Button status
  // 'idle' | 'updating' | 'updated' | 'error'
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'updating' | 'updated' | 'error'>('idle');
  const [updateFeedbackBanner, setUpdateFeedbackBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Active Dispatched Notifications Banner
  const [activeNotificationToast, setActiveNotificationToast] = useState<string | null>(null);

  // Modals Visibility: First time users are prompted for username/name/reference ID
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => {
    const activeId = getActiveUserId();
    const savedProfile = localStorage.getItem(STORAGE_KEYS.PROFILE);
    return !activeId && !savedProfile;
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddCaseOpen, setIsAddCaseOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [isCauseListOpen, setIsCauseListOpen] = useState(false);
  const [isJudgmentsOpen, setIsJudgmentsOpen] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [judgmentsInitialCase, setJudgmentsInitialCase] = useState<{
    caseNo: string;
    year: string;
    benchId?: number;
  } | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Browser Notification Permission
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return typeof Notification !== 'undefined' ? Notification.permission : 'default';
  });

  // Save profile changes with multi-user isolation
  const handleSaveProfile = (newProfile: UserProfile) => {
    setProfile(newProfile);
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(newProfile));
    const userId = normalizeUserId(newProfile.username || newProfile.name);
    if (userId) {
      saveLocalUser({
        userId,
        username: newProfile.username || userId,
        name: newProfile.name,
        honorific: newProfile.honorific || 'Mr.',
        district: newProfile.district || 'Peshawar',
        referenceId: newProfile.referenceId || userId,
        profilePictureUrl: newProfile.profilePictureUrl,
        createdDate: new Date().toISOString(),
        lastLoginDate: new Date().toISOString(),
      });
      // Save existing cases under this isolated user
      saveUserCases(userId, cases);
    }
    setIsOnboardingOpen(false);
    setIsEditingProfile(false);
  };

  // Switch between multiple profiles stored on this device
  const handleSwitchLocalUser = (userId: string) => {
    setActiveUserId(userId);
    const userProf = getUserProfile(userId);
    if (userProf) {
      setProfile(userProf);
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(userProf));
    }
    const userCases = getUserCases(userId);
    const sorted = sortCasesByHearingDate(userCases);
    setCases(sorted);
    localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(sorted));
    setIsOnboardingOpen(false);
    setIsEditingProfile(false);
    setUpdateFeedbackBanner({
      type: 'info',
      message: `Switched profile to @${userId}. Loaded ${sorted.length} isolated cases.`,
    });
    setTimeout(() => {
      setUpdateFeedbackBanner(null);
    }, 3500);
  };

  // Save cases changes with per-user isolated persistence
  const updateCasesState = useCallback(
    (newCases: CourtCase[]) => {
      const sorted = sortCasesByHearingDate(newCases);
      setCases(sorted);
      localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(sorted));
      const activeId = getActiveUserId() || (profile?.username ? normalizeUserId(profile.username) : null);
      if (activeId) {
        saveUserCases(activeId, sorted);
      }
    },
    [profile?.username]
  );

  // Requirement 3: Automatic background check for new published app versions
  useEffect(() => {
    const checkForAppUpdates = async () => {
      if (!navigator.onLine) return;
      try {
        const res = await fetch('/api/app-version');
        if (res.ok) {
          const data = await res.json();
          const localVer = localStorage.getItem('kpst_app_version');
          if (localVer && localVer !== data.version) {
            console.log(`New app version detected (${data.version}). Auto-updating installed application...`);
            localStorage.setItem('kpst_app_version', data.version);
            setUpdateFeedbackBanner({
              type: 'info',
              message: `Litigation Assistant updated to version ${data.version}! Refreshing with latest published updates...`,
            });
            setTimeout(() => {
              window.location.reload();
            }, 1200);
          } else if (!localVer) {
            localStorage.setItem('kpst_app_version', data.version);
          }
        }
      } catch {
        // offline or silent
      }
    };

    checkForAppUpdates();
    window.addEventListener('online', checkForAppUpdates);
    const interval = setInterval(checkForAppUpdates, 45000); // Check every 45s
    return () => {
      window.removeEventListener('online', checkForAppUpdates);
      clearInterval(interval);
    };
  }, []);

  // Requirement 13: Synchronize changes between mobile app and web portal as and when online
  useEffect(() => {
    if (!currentUser) return;

    const syncWithCloudWhenOnline = async () => {
      if (!navigator.onLine) return;
      try {
        const cloudCases = await fetchCloudCases(currentUser.username);
        if (Array.isArray(cloudCases) && cloudCases.length > 0) {
          setCases((prevCases) => {
            // Check if there are real differences
            const currentStr = JSON.stringify(prevCases);
            const cloudStr = JSON.stringify(cloudCases);
            if (currentStr !== cloudStr) {
              const sorted = sortCasesByHearingDate(cloudCases);
              localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(sorted));
              return sorted;
            }
            return prevCases;
          });
        }
      } catch (e) {
        console.warn('Background cross-device sync notice:', e);
      }
    };

    window.addEventListener('online', syncWithCloudWhenOnline);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncWithCloudWhenOnline();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', syncWithCloudWhenOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser]);

  // Request browser notification permission
  const handleRequestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
    } catch (err) {
      console.warn('Failed to request notification permission:', err);
    }
  };

  // Trigger test notification
  const handleSendTestNotification = (targetCase?: CourtCase) => {
    const c = targetCase || cases[0];
    const hearingDateStr = c?.nextDate ? formatDisplayDate(c.nextDate) : '24-10-2026';
    const title = c?.caseTitle || 'APPEAL NO. 104/2024';
    // Exact requirement 8 format: ([Case Title] Scheduled for 24-10-2026)
    const notificationMessage = `[${title}] Scheduled for ${hearingDateStr}`;

    playAlertChime();
    setActiveNotificationToast(notificationMessage);

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('KPST Court Hearing Alert (11:00 AM)', {
          body: notificationMessage,
          icon: '/pwa-192x192.png',
          badge: '/icon.svg',
          tag: 'kpst-hearing-alert',
        });
      } catch (e) {
        console.warn('Notification error:', e);
      }
    }
  };

  /**
   * Requirement 7 & 9:
   * "The first screen/ interface should have a (Update) button.
   * If the phone is connected to the internet, it should give message (Updating…).
   * If updated from the website (https://kpst.gov.pk), it should give message (Updated),
   * if not it should give message (Try again).
   * If it is not connected with internet, it should give message (Not Connected to Internet)."
   *
   * "When the (Update) button is pressed, the app should also search cause list publicly
   * available on (https://kpst.gov.pk) and fill the boxes for every case such as name of (Bench)
   * and serial number of the case on the cause list. If cause list is not updated yet,
   * the boxes should be empty."
   */
  const handleUpdate = useCallback(async (isManualTrigger = false) => {
    if (!isOnline) {
      if (isManualTrigger) {
        setUpdateFeedbackBanner({
          type: 'error',
          message: 'Not Connected to Internet. Please connect to update court cases.',
        });
      }
      return;
    }

    if (cases.length === 0) {
      if (isManualTrigger) {
        setUpdateFeedbackBanner({
          type: 'info',
          message: 'No cases in your tracking docket to update. Tap "+ Add Case" to add one.',
        });
      }
      return;
    }

    setUpdateStatus('updating');
    if (isManualTrigger) setUpdateFeedbackBanner(null);

    try {
      const response = await fetch('/api/kpst/update-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cases }),
      });

      if (!response.ok) {
        throw new Error(`Court server update returned HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to sync with court portals');
      }

      // Requirement 6 & 10: Sort cases by hearing date automatically
      const updatedAndSorted = sortCasesByHearingDate(data.cases || cases);
      updateCasesState(updatedAndSorted);

      // If user is signed in to a cloud account, sync all updated cases
      if (currentUser) {
        syncAllCasesToCloud(currentUser.username, updatedAndSorted).catch((err) =>
          console.warn('Background cloud sync error:', err)
        );
      }

      const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastUpdatedTime(timestampStr);
      localStorage.setItem(STORAGE_KEYS.LAST_UPDATE, timestampStr);

      // Requirement 7: Show "Updated"
      setUpdateStatus('updated');
      setUpdateFeedbackBanner({
        type: 'success',
        message: `Updated from KPST & Peshawar High Court (${data.successCount || 0} cases verified & refreshed).`,
      });

      // Keep "Updated" displayed for 3.5 seconds then return to idle
      setTimeout(() => {
        setUpdateStatus('idle');
      }, 3500);
    } catch (err: unknown) {
      if (isManualTrigger) {
        setUpdateStatus('error');
        setUpdateFeedbackBanner({
          type: 'error',
          message: 'Try again: Unable to reach court portals (KPST / PHC). Check connection.',
        });
      } else {
        // Silent background update during launch or offline
        setUpdateStatus('idle');
      }
    }
  }, [cases, currentUser, isOnline, updateCasesState]);

  /**
   * Requirement 6:
   * "The app should sort the cases with respect to date of hearing;
   * the case with early date of hearing should be first and so on.
   * It should be automatically every time the user opens/ launches the app when it is connected to the internet."
   */
  useEffect(() => {
    // Auto sort on launch
    startTransition(() => {
      setCases((prev) => sortCasesByHearingDate(prev));
    });

    if (isOnline && cases.length > 0) {
      // Background sync with court portals on launch
      const timer = setTimeout(() => {
        handleUpdate(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Requirement 8:
   * "The app should notify the user about every case on 11:00 AM one day before the case
   * is to be heard by the court. For example, if a case is fixed for hearing on 24-10-2026,
   * the app should notify the user at 11:00 AM on 23-10-2026 with a message that
   * ([Case Title] Scheduled for 24-10-2026)."
   */
  useEffect(() => {
    const checkScheduledHearingAlerts = () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const currentDate = now.getDate();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      cases.forEach((c) => {
        if (!c.nextDate) return;
        const triggerTime = calculateNotificationTriggerTime(c.nextDate);
        if (!triggerTime) return;

        // Check if today matches the trigger date and current time is around 11:00 AM (between 11:00 and 11:05)
        const isSameDay =
          triggerTime.getFullYear() === currentYear &&
          triggerTime.getMonth() === currentMonth &&
          triggerTime.getDate() === currentDate;

        const is11AM = currentHour === 11 && currentMinute < 5;

        const alertFiredKey = `alert_fired_${c.id}_${c.nextDate}`;
        const hasAlreadyFired = sessionStorage.getItem(alertFiredKey);

        if (isSameDay && is11AM && !hasAlreadyFired) {
          sessionStorage.setItem(alertFiredKey, 'true');
          const message = `[${c.caseTitle || `Appeal ${c.appealNo}/${c.year}`}] Scheduled for ${formatDisplayDate(c.nextDate)}`;

          playAlertChime();
          setActiveNotificationToast(message);

          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification('KPST Court Hearing Alert (11:00 AM)', {
                body: message,
                icon: '/pwa-192x192.png',
                badge: '/icon.svg',
              });
            } catch (e) {
              console.warn('Notification error:', e);
            }
          }
        }
      });
    };

    // Check on mount and periodically every 30 seconds
    checkScheduledHearingAlerts();
    const interval = setInterval(checkScheduledHearingAlerts, 30000);
    return () => clearInterval(interval);
  }, [cases]);

  // Add new case handler (Requirements 15 & 19: Double entry prevention)
  const handleCaseAdded = (newCase: CourtCase) => {
    const isDuplicate = cases.some((c) =>
      c.court === newCase.court &&
      c.appealNo.toLowerCase().replace(/[^a-z0-9]/g, '') === newCase.appealNo.toLowerCase().replace(/[^a-z0-9]/g, '') &&
      c.year === newCase.year
    );

    if (isDuplicate) {
      setUpdateFeedbackBanner({
        type: 'error',
        message: `(Already Added) ${newCase.court === 'PHC' ? 'Case' : 'Appeal'} No. ${newCase.appealNo}/${newCase.year} is already in your tracking list.`,
      });
      setTimeout(() => {
        setUpdateFeedbackBanner(null);
      }, 4000);
      return;
    }

    const updated = [newCase, ...cases];
    const sorted = sortCasesByHearingDate(updated);
    updateCasesState(sorted);

    if (currentUser) {
      saveCloudCase(currentUser.username, newCase).catch((err) =>
        console.warn('Failed to save case to cloud:', err)
      );
    }

    setUpdateFeedbackBanner({
      type: 'success',
      message: `Added Appeal No. ${newCase.appealNo}/${newCase.year} to your tracked court cases${
        currentUser ? ' & synced to cloud' : ''
      }.`,
    });
    setTimeout(() => {
      setUpdateFeedbackBanner(null);
    }, 4000);
  };

  // Update existing case handler
  const handleUpdateCase = (updatedCase: CourtCase) => {
    const updated = cases.map((c) => (c.id === updatedCase.id ? updatedCase : c));
    updateCasesState(updated);

    if (currentUser) {
      saveCloudCase(currentUser.username, updatedCase).catch((err) =>
        console.warn('Failed to update case in cloud:', err)
      );
    }

    setUpdateFeedbackBanner({
      type: 'success',
      message: `Updated Appeal No. ${updatedCase.appealNo}/${updatedCase.year}.`,
    });
    setTimeout(() => {
      setUpdateFeedbackBanner(null);
    }, 3500);
  };

  // Delete case handler without window.confirm (iframe safe)
  const handleDeleteCase = (id: string) => {
    const caseToDelete = cases.find((c) => c.id === id);
    const filtered = cases.filter((c) => c.id !== id);
    updateCasesState(filtered);

    if (currentUser) {
      deleteCloudCase(currentUser.username, id).catch((err) =>
        console.warn('Failed to delete case from cloud:', err)
      );
    }

    if (caseToDelete) {
      setUpdateFeedbackBanner({
        type: 'info',
        message: `Removed Appeal No. ${caseToDelete.appealNo}/${caseToDelete.year} from tracking.`,
      });
      setTimeout(() => {
        setUpdateFeedbackBanner(null);
      }, 4000);
    }
  };

  // Account login callback
  const handleLoginSuccess = async (user: CloudUserAccount, isNewRegistration: boolean) => {
    setCurrentUser(user);
    localStorage.setItem('kpst_current_user', JSON.stringify(user));

    // Update profile
    const newProfile: UserProfile = {
      name: user.name,
      honorific: user.honorific,
      district: user.district,
      isOnboarded: true,
    };
    setProfile(newProfile);
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(newProfile));
    setIsAuthOpen(false);

    if (isNewRegistration) {
      // First time registration: zero cases by default as requested
      updateCasesState([]);
      setUpdateFeedbackBanner({
        type: 'success',
        message: `Welcome, ${user.honorific} ${user.name}! Your account is active. Tap '+ Add Case' to track your appeals.`,
      });
      setTimeout(() => {
        setUpdateFeedbackBanner(null);
      }, 5000);
    } else {
      // Sign in from any phone or browser: fetch all previously added cases from cloud!
      setIsSyncing(true);
      try {
        const cloudCases = await fetchCloudCases(user.username);
        const sorted = sortCasesByHearingDate(cloudCases || []);
        updateCasesState(sorted);
        setUpdateFeedbackBanner({
          type: 'success',
          message: `Welcome back, ${user.honorific} ${user.name}! Loaded ${sorted.length} case${
            sorted.length === 1 ? '' : 's'
          } from cloud for @${user.username}.`,
        });
      } catch (err) {
        console.warn('Failed to load cloud cases on login:', err);
        setUpdateFeedbackBanner({
          type: 'error',
          message: 'Logged in, but could not load cases from cloud. Tap Sync Cloud Cases when connected.',
        });
      } finally {
        setIsSyncing(false);
        setTimeout(() => {
          setUpdateFeedbackBanner(null);
        }, 5000);
      }
    }
  };

  // Account logout
  const handleLogout = () => {
    setCurrentUser(null);
    updateCasesState([]);
    localStorage.removeItem('kpst_current_user');
    localStorage.removeItem(STORAGE_KEYS.CASES);
    setIsAuthOpen(true);
    setUpdateFeedbackBanner({
      type: 'info',
      message: 'Logged out. Please register or sign in with your username to access your cases.',
    });
    setTimeout(() => {
      setUpdateFeedbackBanner(null);
    }, 4000);
  };

  // Manual sync trigger
  const handleManualSync = async () => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      const cloudCases = await fetchCloudCases(currentUser.username);
      if (cloudCases && cloudCases.length > 0) {
        updateCasesState(cloudCases);
        setUpdateFeedbackBanner({
          type: 'success',
          message: `Synced ${cloudCases.length} cases from cloud for @${currentUser.username}.`,
        });
      } else {
        await syncAllCasesToCloud(currentUser.username, cases);
        setUpdateFeedbackBanner({
          type: 'success',
          message: `Saved ${cases.length} cases to cloud for @${currentUser.username}.`,
        });
      }
    } catch (err) {
      console.warn('Sync failed:', err);
      setUpdateFeedbackBanner({
        type: 'error',
        message: 'Could not sync with cloud database. Please verify internet connection.',
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => {
        setUpdateFeedbackBanner(null);
      }, 4000);
    }
  };

  // Calculate pending unread alerts
  const now = new Date();
  const alertsCount = cases.filter((c) => {
    if (!c.nextDate) return false;
    const t = calculateNotificationTriggerTime(c.nextDate);
    return t && t.getTime() >= now.getTime();
  }).length;

  return (
    <AndroidFrame
      onAddCase={() => setIsAddCaseOpen(true)}
      onOpenCauseList={() => setIsCauseListOpen(true)}
    >
      {/* Real-time Notification Banner for 11:00 AM Alerts (Requirement 8) */}
      {activeNotificationToast && (
        <div className="bg-amber-500 text-slate-950 p-3.5 rounded-2xl shadow-lg border border-amber-400 flex items-start justify-between gap-3 animate-bounce">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-950 text-amber-300 rounded-xl">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-950">
                11:00 AM Court Eve Alert Triggered
              </div>
              <div className="text-xs font-bold mt-0.5">{activeNotificationToast}</div>
            </div>
          </div>
          <button
            onClick={() => setActiveNotificationToast(null)}
            className="p-1 rounded-lg hover:bg-amber-600/30 text-slate-950"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Online / Offline status warning */}
      {!isOnline && (
        <div className="bg-rose-500 text-white p-3 rounded-2xl shadow-sm text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span>Not Connected to Internet. Showing cached court data.</span>
          </div>
        </div>
      )}

      {/* Update feedback banner */}
      {updateFeedbackBanner && (
        <div
          className={`p-3 rounded-2xl text-xs font-medium flex items-center justify-between shadow-sm ${
            updateFeedbackBanner.type === 'success'
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              : updateFeedbackBanner.type === 'error'
              ? 'bg-rose-100 text-rose-900 border border-rose-300'
              : 'bg-teal-100 text-teal-900 border border-teal-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {updateFeedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-700" />
            )}
            <span>{updateFeedbackBanner.message}</span>
          </div>
          <button
            onClick={() => setUpdateFeedbackBanner(null)}
            className="p-1 text-slate-500 hover:text-slate-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* Native Install App to Mobile PWA Banner (auto-displays when installable on mobile/desktop) */}
      <PWAInstallBanner />

      {/* Requirement 2: Welcome Header with "Welcome Mr…….(name of the user) with name of district" */}
      <WelcomeHeader
        profile={profile}
        cases={cases}
        isOnline={isOnline}
        updateStatus={updateStatus}
        lastUpdatedTime={lastUpdatedTime}
        unreadAlertCount={alertsCount}
        currentUser={currentUser}
        onUpdateClick={() => handleUpdate(true)}
        onAddCaseClick={() => setIsAddCaseOpen(true)}
        onDownloadClick={() => setIsDownloadOpen(true)}
        onNotificationsClick={() => setIsNotificationsOpen(true)}
        onEditProfileClick={() => setIsEditingProfile(true)}
        onAccountClick={() => setIsAuthOpen(true)}
        onJudgmentsClick={() => {
          setJudgmentsInitialCase(null);
          setIsJudgmentsOpen(true);
        }}
        onScanQrClick={() => setIsQrScannerOpen(true)}
        onCauseListClick={() => setIsCauseListOpen(true)}
      />

      {/* Requirement 5, 6, 9: Tabular Cases View in Rows and Columns */}
      <CaseTable
        cases={cases}
        onDeleteCase={handleDeleteCase}
        onUpdateCase={handleUpdateCase}
        onFetchJudgments={(caseNo, year, benchId) => {
          setJudgmentsInitialCase({ caseNo, year, benchId });
          setIsJudgmentsOpen(true);
        }}
      />

      {/* Requirement 1: Onboarding Modal for First Time Entry (Name & District) */}
      <OnboardingModal
        isOpen={isOnboardingOpen || isEditingProfile}
        initialProfile={profile}
        isEditing={isEditingProfile}
        onSave={handleSaveProfile}
        onSwitchUser={handleSwitchLocalUser}
        onClose={() => {
          setIsOnboardingOpen(false);
          setIsEditingProfile(false);
        }}
      />

      {/* Requirement 3, 4, 5: Add Case Modal with Service Appeal No. & Year */}
      <AddCaseModal
        isOpen={isAddCaseOpen}
        isOnline={isOnline}
        onClose={() => setIsAddCaseOpen(false)}
        onCaseAdded={handleCaseAdded}
        existingCases={cases}
        onOpenQrScanner={() => setIsQrScannerOpen(true)}
      />

      {/* Requirement 6: Peshawar High Court Receipt QR Code Scanner */}
      <PhcQrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onCaseFound={handleCaseAdded}
        existingCases={cases}
      />

      {/* Requirement 8: 11:00 AM Hearing Notification Center */}
      <NotificationCenter
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        cases={cases}
        alerts={[]}
        permission={notificationPermission}
        onRequestPermission={handleRequestPermission}
        onSendTestNotification={handleSendTestNotification}
      />

      {/* Requirement 10: Download Cases in Excel or PDF format */}
      <DownloadModal
        isOpen={isDownloadOpen}
        onClose={() => setIsDownloadOpen(false)}
        cases={cases}
        profile={profile}
      />

      {/* Requirement 9: Daily Cause List Viewer from kpst.gov.pk & PHC */}
      <CauseListExplorer
        isOpen={isCauseListOpen}
        onClose={() => setIsCauseListOpen(false)}
        isOnline={isOnline}
      />

      {/* User Account & Cross-Device Cloud Sync Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        isMandatory={false}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
        onManualSync={handleManualSync}
        isSyncing={isSyncing}
      />

      {/* Peshawar High Court Judgments & Order Sheet PDF Fetcher */}
      <JudgmentsModal
        isOpen={isJudgmentsOpen}
        onClose={() => setIsJudgmentsOpen(false)}
        isOnline={isOnline}
        initialCaseNo={judgmentsInitialCase?.caseNo}
        initialYear={judgmentsInitialCase?.year}
        initialBenchId={judgmentsInitialCase?.benchId}
      />
    </AndroidFrame>
  );
}
