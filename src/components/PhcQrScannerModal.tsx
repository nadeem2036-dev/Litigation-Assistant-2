import React, { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  QrCode,
  Camera,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Landmark,
  ShieldCheck,
  Calendar,
  User,
  Scale,
} from 'lucide-react';
import { CourtCase } from '../types';
import { formatDisplayDate } from '../utils/dateUtils';

interface PhcQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaseFound: (courtCase: CourtCase) => void;
  existingCases?: CourtCase[];
}

export const PhcQrScannerModal: React.FC<PhcQrScannerModalProps> = ({
  isOpen,
  onClose,
  onCaseFound,
  existingCases = [],
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedRawText, setScannedRawText] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);
  const [retrievedCase, setRetrievedCase] = useState<CourtCase | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop camera stream safely
  const stopCamera = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Parse QR text and query PHC online systems
  const handleDecodedCode = useCallback(async (codeText: string) => {
    if (!codeText || isProcessing) return;
    setScannedRawText(codeText);
    setIsProcessing(true);
    setFetchMessage('Receipt QR Code scanned! Approaching Peshawar High Court online databases...');

    try {
      // 1. Extract params from URL or text
      let caseCode: string | null = null;
      let benchId = 1;
      let caseNo: string | null = null;
      let caseYear: string | null = null;

      try {
        const urlObj = new URL(codeText.trim());
        caseCode = urlObj.searchParams.get('caseCode') || urlObj.searchParams.get('casecode');
        const b = urlObj.searchParams.get('bench');
        if (b) benchId = parseInt(b, 10) || 1;
        const cn = urlObj.searchParams.get('caseNo') || urlObj.searchParams.get('caseno');
        if (cn) caseNo = cn;
        const cy = urlObj.searchParams.get('caseYear') || urlObj.searchParams.get('caseyear');
        if (cy) caseYear = cy;
      } catch {
        // Plain text parsing
        const codeMatch = codeText.match(/case[_\s-]?code[:=\s]*(\d+)/i) || codeText.match(/(\d{5,7})/);
        if (codeMatch) caseCode = codeMatch[1];

        const benchMatch = codeText.match(/bench[:=\s]*(\d+)/i);
        if (benchMatch) benchId = parseInt(benchMatch[1], 10) || 1;

        const caseMatch = codeText.match(/([a-zA-Z\s.]+)\s*(\d+)\s*[/–-]\s*(\d{4})/i);
        if (caseMatch) {
          caseNo = caseMatch[2];
          caseYear = caseMatch[3];
        }
      }

      setFetchMessage(`Searching PHC records (Bench: ${benchId}${caseCode ? `, Code: ${caseCode}` : ''})...`);

      // 2. Query search endpoint
      const response = await fetch('/api/phc/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseNo: caseNo || '1',
          caseYear: caseYear || '2024',
          caseCode: caseCode || undefined,
          benchId,
        }),
      });

      const data = await response.json();

      if (data.success && Array.isArray(data.cases) && data.cases.length > 0) {
        // Find best match
        let matched = data.cases[0];
        if (caseCode) {
          const codeMatch = data.cases.find((c: any) => String(c.caseCode) === String(caseCode));
          if (codeMatch) matched = codeMatch;
        }

        const foundCase: CourtCase = {
          ...matched,
          court: 'PHC',
          placeOfHearing: benchId === 1 ? 'Peshawar' : benchId === 3 ? 'Abbottabad' : benchId === 2 ? 'D.I Khan' : benchId === 4 ? 'Swat' : 'Peshawar',
        };

        setRetrievedCase(foundCase);

        // Check if duplicate already exists
        const duplicate = existingCases.some(
          (c) =>
            c.court === 'PHC' &&
            c.appealNo.toLowerCase().replace(/[^a-z0-9]/g, '') === foundCase.appealNo.toLowerCase().replace(/[^a-z0-9]/g, '') &&
            c.year === foundCase.year
        );
        setIsDuplicate(duplicate);

        setFetchMessage(
          duplicate
            ? '(Already Added) This case is already in your tracking docket.'
            : 'Record successfully verified from Peshawar High Court CFMIS!'
        );
      } else {
        // Manual fallback from scanned data
        const fallbackCase: CourtCase = {
          id: `phc-scanned-${caseCode || Date.now()}`,
          court: 'PHC',
          appealNo: caseNo || 'Receipt Case',
          year: caseYear || new Date().getFullYear().toString(),
          caseTitle: `PHC CASE ${caseNo || 'Scanned'}/${caseYear || new Date().getFullYear()}`,
          department: 'Peshawar High Court (Principal Seat)',
          bench: 'Single Bench (SB)',
          advocateName: '',
          natureOfCase: 'High Court Case (Scanned Receipt)',
          decision: 'Under Hearing / Pending',
          nextDate: '',
          causeListSrNo: '',
          causeListBench: '',
          courtRoom: 'Court Room 1',
          placeOfHearing: benchId === 1 ? 'Peshawar' : benchId === 3 ? 'Abbottabad' : benchId === 2 ? 'D.I Khan' : 'Peshawar',
          lastUpdated: new Date().toISOString(),
          caseCode: caseCode || undefined,
          benchId,
        };

        setRetrievedCase(fallbackCase);
        setFetchMessage('QR Code details read. Please verify details before adding.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error reaching PHC portals';
      setFetchMessage(`Portal search timeout: ${msg}. QR raw code: ${codeText}`);
    } finally {
      setIsProcessing(false);
      stopCamera();
    }
  }, [existingCases, isProcessing, stopCamera]);

  // Scan frame from live video
  const scanVideoFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          handleDecodedCode(code.data);
          return;
        }
      }
    }

    animationFrameId.current = requestAnimationFrame(scanVideoFrame);
  }, [handleDecodedCode]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera access is not supported by your browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        animationFrameId.current = requestAnimationFrame(scanVideoFrame);
      }
    } catch (err: unknown) {
      console.warn('Camera stream error:', err);
      setCameraError('Unable to open camera. Please grant camera permission or upload a photo of the receipt.');
    }
  }, [scanVideoFrame, stopCamera]);

  // Handle uploaded image file
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFetchMessage('Reading QR code from uploaded receipt image...');

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            handleDecodedCode(code.data);
          } else {
            setIsProcessing(false);
            setFetchMessage('Could not find a valid QR Code in the uploaded image. Please ensure the QR Code is clearly visible and well-lit.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, startCamera, stopCamera]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-400/30 shadow-md">
              <QrCode className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <span>Scan PHC Receipt (QR Code)</span>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30 uppercase font-bold">
                  Receipt Reader
                </span>
              </h3>
              <p className="text-[11px] text-blue-200/90">
                Peshawar High Court Institution Receipt Scanner &amp; Online CFMIS Verifier
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls: Camera vs Photo Upload */}
        <div className="px-5 pt-3 bg-slate-100 border-b border-slate-200 flex items-center gap-2 text-xs font-bold">
          <button
            onClick={() => {
              setActiveTab('camera');
              setRetrievedCase(null);
            }}
            className={`px-4 py-2 rounded-t-xl transition flex items-center gap-1.5 border-t border-x ${
              activeTab === 'camera'
                ? 'bg-white text-blue-950 border-slate-300 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-blue-700" />
            <span>Live Camera Scanner</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('upload');
              stopCamera();
              setRetrievedCase(null);
            }}
            className={`px-4 py-2 rounded-t-xl transition flex items-center gap-1.5 border-t border-x ${
              activeTab === 'upload'
                ? 'bg-white text-blue-950 border-slate-300 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-indigo-700" />
            <span>Upload Receipt Photo</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          {/* Active Scanner View */}
          {activeTab === 'camera' ? (
            <div className="space-y-3">
              <div className="relative w-full aspect-4/3 bg-slate-950 rounded-xl overflow-hidden border-2 border-dashed border-blue-500/40 flex items-center justify-center shadow-inner">
                {cameraError ? (
                  <div className="p-5 text-center text-slate-300 space-y-3">
                    <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                    <p className="text-xs">{cameraError}</p>
                    <button
                      onClick={() => setActiveTab('upload')}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Switch to Image Upload</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Scanner Target Box with Animated Line */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-48 border-2 border-amber-400 rounded-2xl relative shadow-lg">
                        <div className="absolute inset-x-0 top-0 h-0.5 bg-amber-300 animate-pulse" />
                        <div className="absolute -top-6 inset-x-0 text-center text-[10px] text-amber-300 font-bold uppercase tracking-wider bg-black/60 px-2 py-0.5 rounded-full mx-auto w-max">
                          Point at Receipt QR Code
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <p className="text-[11px] text-center text-slate-500">
                Hold the Peshawar High Court institution receipt steady in front of your camera.
              </p>
            </div>
          ) : (
            /* Upload View */
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-8 border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/50 rounded-xl text-center cursor-pointer transition space-y-3 group"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mx-auto group-hover:scale-110 transition">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm">Tap to Select Receipt Photo</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Choose from Gallery, Downloads or Take Photo
                  </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>
          )}

          {/* Status / Message Banner */}
          {fetchMessage && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                isDuplicate
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : retrievedCase
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0 mt-0.5" />
              ) : isDuplicate ? (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              ) : retrievedCase ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Search className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 font-medium">{fetchMessage}</div>
            </div>
          )}

          {/* Retrieved Case Details Display */}
          {retrievedCase && (
            <div className="border border-blue-200 rounded-xl bg-blue-50/50 p-4 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-blue-700" />
                  <span className="font-extrabold text-blue-950 text-sm">
                    {retrievedCase.appealNo}/{retrievedCase.year}
                  </span>
                  <span className="text-[10px] bg-blue-200 text-blue-900 font-bold px-2 py-0.5 rounded-full">
                    {retrievedCase.placeOfHearing}
                  </span>
                </div>
                {isDuplicate && (
                  <span className="text-[11px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">
                    (Already Added)
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div>
                  <span className="font-bold text-slate-700">Case Title:</span>{' '}
                  <span className="text-slate-900 font-semibold">{retrievedCase.caseTitle}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700">Department / Respondent:</span>{' '}
                  <span className="text-slate-800">{retrievedCase.department}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-slate-700">
                  <div>
                    <span className="font-bold">Next Date (Fixed On):</span>{' '}
                    <span className="font-semibold text-blue-900">
                      {retrievedCase.nextDate ? formatDisplayDate(retrievedCase.nextDate) : 'No date fixed'}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold">Court Room:</span>{' '}
                    <span>{retrievedCase.courtRoom || 'Court Room 1'}</span>
                  </div>
                  <div>
                    <span className="font-bold">Bench / Justice:</span>{' '}
                    <span>{retrievedCase.justiceName || retrievedCase.bench}</span>
                  </div>
                  <div>
                    <span className="font-bold">Status:</span>{' '}
                    <span className="font-medium text-emerald-800">{retrievedCase.decision}</span>
                  </div>
                </div>
                {retrievedCase.advocateName && (
                  <div>
                    <span className="font-bold text-slate-700">Advocate(s):</span>{' '}
                    <span className="text-slate-800">{retrievedCase.advocateName}</span>
                  </div>
                )}
              </div>

              {/* Action: Add Case (with duplicate prevention) */}
              <div className="pt-2 flex items-center gap-2">
                {isDuplicate ? (
                  <div className="w-full py-2.5 px-3 bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-center font-bold text-xs flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-700" />
                    <span>Case Already in Tracking List</span>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      onCaseFound(retrievedCase);
                      stopCamera();
                      onClose();
                    }}
                    className="w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md active:scale-98"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    <span>Add Verified Case to Litigation Assistant</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
