import React, { useState } from 'react';
import { CourtCase, HearingAlert } from '../types';
import { Bell, Clock, CheckCircle2, AlertTriangle, Volume2, ShieldCheck, X } from 'lucide-react';
import { formatDisplayDate, calculateNotificationTriggerTime } from '../utils/dateUtils';
import { playAlertChime } from '../utils/soundUtils';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  cases: CourtCase[];
  alerts: HearingAlert[];
  permission: NotificationPermission;
  onRequestPermission: () => void;
  onSendTestNotification: (courtCase?: CourtCase) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  cases,
  alerts,
  permission,
  onRequestPermission,
  onSendTestNotification,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(true);

  if (!isOpen) return null;

  const now = new Date();

  // Calculate upcoming 11:00 AM alerts
  const scheduledAlerts = cases
    .filter((c) => !!c.nextDate)
    .map((c) => {
      const triggerTime = calculateNotificationTriggerTime(c.nextDate);
      return {
        courtCase: c,
        triggerTime,
        isTriggered: triggerTime ? now.getTime() >= triggerTime.getTime() : false,
      };
    })
    .filter((item) => item.triggerTime !== null);

  const handleTestChimeAndNotification = () => {
    if (soundEnabled) {
      playAlertChime();
    }
    const sampleCase = cases[0];
    onSendTestNotification(sampleCase);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-400/30">
              <Bell className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-base">Court Hearing Alerts (11:00 AM)</h3>
              <p className="text-[11px] text-emerald-200">Automated 24h Eve Notification Engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto text-xs">
          {/* Requirement 8 Specification Box */}
          <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl text-amber-950 space-y-1">
            <div className="font-bold text-xs flex items-center gap-1.5 text-amber-900">
              <Clock className="w-4 h-4 text-amber-700" />
              <span>Court Rule Notification (Requirement 8)</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              "The app should notify the user about every case on <strong>11:00 AM one day before</strong> the case
              is to be heard by the court. For example, if a case is fixed for hearing on <strong>24-10-2026</strong>,
              the app should notify the user at <strong>11:00 AM on 23-10-2026</strong> with a message that:{' '}
              <code>[Case Title] Scheduled for 24-10-2026</code>"
            </p>
          </div>

          {/* Browser Notification Status */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  permission === 'granted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {permission === 'granted' ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <div>
                <div className="font-bold text-slate-800">
                  System Push Notifications:{' '}
                  <span
                    className={
                      permission === 'granted'
                        ? 'text-emerald-700'
                        : permission === 'denied'
                        ? 'text-rose-700'
                        : 'text-amber-700'
                    }
                  >
                    {permission === 'granted' ? 'Active' : permission === 'denied' ? 'Blocked' : 'Action Required'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {permission === 'granted'
                    ? 'Android phone notifications enabled for 11:00 AM alerts'
                    : 'Grant permission to receive alerts even when app is in background'}
                </div>
              </div>
            </div>

            {permission !== 'granted' && (
              <button
                onClick={onRequestPermission}
                className="py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow-sm transition"
              >
                Enable
              </button>
            )}
          </div>

          {/* Controls: Sound & Test Notification */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
              <Volume2 className="w-4 h-4 text-emerald-700" />
              <span>Court Chime Alert Sound</span>
            </label>

            <button
              onClick={handleTestChimeAndNotification}
              className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg font-semibold text-xs transition active:scale-95 flex items-center gap-1.5"
            >
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span>Test 11:00 AM Alert</span>
            </button>
          </div>

          {/* Scheduled Alert List for Tracked Cases */}
          <div>
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
              Scheduled 11:00 AM Hearing Reminders ({scheduledAlerts.length})
            </h4>

            {scheduledAlerts.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500">
                No upcoming hearing dates currently set for your court cases.
              </div>
            ) : (
              <div className="space-y-2">
                {scheduledAlerts.map((item, index) => {
                  const c = item.courtCase;
                  const t = item.triggerTime;
                  const isPast = item.isTriggered;

                  return (
                    <div
                      key={index}
                      className={`p-3 rounded-xl border transition ${
                        isPast
                          ? 'bg-slate-50 border-slate-200 text-slate-600'
                          : 'bg-emerald-50/60 border-emerald-200 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">
                          Appeal No. {c.appealNo}/{c.year} • {c.caseTitle}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isPast
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                          }`}
                        >
                          {isPast ? 'Alert Dispatched' : 'Scheduled 11:00 AM'}
                        </span>
                      </div>

                      <div className="mt-1.5 text-[11px] space-y-0.5 text-slate-600">
                        <div>
                          <strong>Hearing Date:</strong> {formatDisplayDate(c.nextDate)}
                        </div>
                        <div>
                          <strong>Scheduled Alert Time:</strong>{' '}
                          {t ? `${formatDisplayDate(t.toISOString().slice(0, 10))} at 11:00:00 AM PKT` : '-'}
                        </div>
                        <div className="text-emerald-800 font-mono text-[10px] bg-white/70 p-1.5 rounded border border-emerald-100 mt-1">
                          Notification Text: "[{c.caseTitle || `Appeal ${c.appealNo}`}] Scheduled for{' '}
                          {formatDisplayDate(c.nextDate)}"
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="py-2 px-5 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-700 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
