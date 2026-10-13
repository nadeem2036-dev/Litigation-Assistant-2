import React from 'react';
import { Plus } from 'lucide-react';

interface AndroidFrameProps {
  children: React.ReactNode;
  onAddCase: () => void;
  onOpenCauseList?: () => void;
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({ children, onAddCase }) => {
  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-900 flex flex-col relative antialiased selection:bg-emerald-600 selection:text-white overflow-x-hidden">
      {/* Full-width Responsive Main Container proportional to phone screens */}
      <main className="w-full flex-1 mx-auto max-w-7xl px-2.5 sm:px-4 md:px-6 py-2.5 sm:py-4 space-y-3.5 sm:space-y-6 pb-24 sm:pb-12 overflow-x-hidden">
        {children}
      </main>

      {/* Floating Action Button (FAB) for quick mobile case entry */}
      <button
        onClick={onAddCase}
        title="Add New Court Case"
        aria-label="Add Case"
        className="fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-40 w-13 h-13 sm:w-14 sm:h-14 bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 rounded-full shadow-xl shadow-amber-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition border-2 border-white cursor-pointer"
      >
        <Plus className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
      </button>
    </div>
  );
};
