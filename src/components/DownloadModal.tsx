import React, { useState } from 'react';
import { CourtCase, UserProfile } from '../types';
import { FileSpreadsheet, FileText, Download, X, CheckCircle2 } from 'lucide-react';
import { exportToPdf, buildDocketExcelWorkbook } from '../utils/exportUtils';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: CourtCase[];
  profile: UserProfile;
  userEmail?: string;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  isOpen,
  onClose,
  cases,
  profile,
  userEmail,
}) => {
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadRealXlsx = async () => {
    try {
      setIsGeneratingExcel(true);
      const buffer = await buildDocketExcelWorkbook(cases, profile, userEmail);
      const blob = new Blob([buffer as any], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Litigation_Assistant_${profile.name.replace(/\s+/g, '_')}_Legal_Docket.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadSuccessMsg('Excel docket downloaded successfully (.xlsx)!');
      setTimeout(() => setDownloadSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to generate Excel .xlsx file:', err);
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  const handleDownloadPdf = () => {
    exportToPdf(cases, profile);
    setDownloadSuccessMsg('PDF docket generated successfully!');
    setTimeout(() => setDownloadSuccessMsg(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-700/50 flex items-center justify-center border border-teal-400/30">
              <Download className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h3 className="font-bold text-base">Export Cases Docket</h3>
              <p className="text-[11px] text-emerald-200">Official Case Dockets in Excel (.xlsx) &amp; PDF</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700">Account / Advocate:</span>
              <span className="font-bold text-slate-900">{profile.honorific} {profile.name}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1">
              <span className="font-semibold text-slate-700">District / Office:</span>
              <span className="text-slate-800">{profile.district}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1">
              <span className="font-semibold text-slate-700">Tracked Cases:</span>
              <span className="font-bold text-emerald-800">{cases.length} Total</span>
            </div>
          </div>

          {downloadSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{downloadSuccessMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Excel Download Option */}
            <button
              onClick={handleDownloadRealXlsx}
              disabled={isGeneratingExcel}
              className="p-3.5 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 hover:border-emerald-500 transition text-left flex items-start gap-3 group active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-xs text-emerald-950 flex items-center justify-between">
                  <span>Download .XLSX</span>
                  <span className="text-[9px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-bold">
                    Legal / Print
                  </span>
                </div>
                <p className="text-[10px] text-emerald-800 mt-0.5 leading-snug">
                  Legal paper size, Landscape, repeated headers on every page, with separate KPST &amp; PHC tabs.
                </p>
              </div>
            </button>

            {/* PDF Download Option */}
            <button
              onClick={handleDownloadPdf}
              className="p-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/70 hover:bg-teal-50/70 hover:border-teal-500 transition text-left flex items-start gap-3 group active:scale-[0.99] cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-teal-800 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                  <span>Download PDF</span>
                  <span className="text-[9px] bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded font-bold">
                    Docket
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">
                  Print-ready court docket with Khyber Pakhtunkhwa judicial headers and hearing list.
                </p>
              </div>
            </button>
          </div>
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
