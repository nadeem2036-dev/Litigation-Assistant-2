import React, { useState } from 'react';
import { Smartphone, Download, X, Share2, PlusSquare, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallBannerProps {
  onInstalled?: () => void;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ onInstalled }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  // If already installed in standalone mode or user dismissed the prompt for this session
  if (isInstalled || isDismissed) {
    return null;
  }

  // Handle native install click (Android / Chromium / Desktop)
  const handleInstallClick = async () => {
    const success = await install();
    if (success && onInstalled) {
      onInstalled();
    }
  };

  // Chromium / Android / Desktop flow with beforeinstallprompt ready
  if (isInstallable) {
    return (
      <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 p-3 sm:p-3.5 rounded-2xl shadow-lg border-2 border-amber-300 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-slate-950 text-amber-300 flex items-center justify-center shrink-0 shadow-md">
            <Smartphone className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-wider text-slate-950 flex items-center gap-1.5 flex-wrap">
              <span>Install App to Mobile</span>
              <span className="text-[9px] bg-slate-950 text-amber-300 px-1.5 py-0.2 rounded font-extrabold uppercase">
                Native PWA
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-900 truncate sm:whitespace-normal mt-0.5">
              Install to your home screen for full-screen mode, faster launch & offline access.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleInstallClick}
            className="py-2 px-3.5 bg-slate-950 hover:bg-slate-900 active:scale-95 text-amber-300 rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install Now</span>
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            title="Dismiss install banner"
            className="p-1.5 rounded-lg hover:bg-amber-600/20 text-slate-950 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // iOS Safari flow (WebKit doesn't trigger beforeinstallprompt, requires Share -> Add to Home Screen)
  if (isIOS) {
    return (
      <>
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-3 sm:p-3.5 rounded-2xl shadow-lg border border-emerald-700/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-amber-300">Install on iPhone / iPad</div>
              <p className="text-[11px] text-slate-300 truncate sm:whitespace-normal">
                Add to your iOS Home Screen for standalone full-screen experience.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowIOSModal(true)}
              className="py-1.5 px-3 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>How to Install</span>
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Guided iOS Modal */}
        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4 text-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <Smartphone className="w-5 h-5 text-emerald-700" />
                  <span>Install on iPhone / iPad</span>
                </div>
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                    1
                  </div>
                  <div>
                    In the Safari toolbar at the bottom, tap the <strong>Share</strong> button (
                    <Share2 className="w-3.5 h-3.5 inline text-blue-600" />
                    ).
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                    2
                  </div>
                  <div>
                    Scroll down and tap <strong>Add to Home Screen</strong> (
                    <PlusSquare className="w-3.5 h-3.5 inline text-slate-700" />
                    ).
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-start gap-2.5 text-emerald-950">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    The <strong>Litigation Assistant</strong> icon appears on your home screen and opens in native standalone mode!
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSModal(false)}
                className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

// Compact Button version for header/toolbar integration
export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        title="Install KPST Litigation Assistant App to Mobile Home Screen"
        className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <button
        onClick={() => setShowIOSModal(true)}
        title="Install to iOS Home Screen"
        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-800/60 hover:bg-emerald-700 text-emerald-100 border border-emerald-700/40 transition flex items-center gap-1.5"
      >
        <Smartphone className="w-3.5 h-3.5 text-amber-300" />
        <span>Install App</span>
      </button>
    );
  }

  return null;
};
