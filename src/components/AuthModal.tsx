import React, { useState } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Cloud,
  LogOut,
  CheckCircle2,
  UserPlus,
  LogIn,
  RefreshCw,
  X,
  AlertCircle,
  Mail,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';
import { KP_DISTRICTS } from '../types';
import {
  CloudUserAccount,
  registerUserAccount,
  authenticateUserAccount,
  requestAccountRecovery,
  resetPasswordWithCode,
  changeUserPassword,
} from '../services/cloudService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: CloudUserAccount | null;
  onLoginSuccess: (user: CloudUserAccount, isNewRegistration: boolean) => void;
  onLogout: () => void;
  onManualSync?: () => void;
  isSyncing?: boolean;
  isMandatory?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  onLogout,
  onManualSync,
  isSyncing = false,
  isMandatory = false,
}) => {
  const [mode, setMode] = useState<'signin' | 'register' | 'recover'>(currentUser ? 'signin' : 'register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Recovery state
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [recoveredUsername, setRecoveredUsername] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [displayCodeNotice, setDisplayCodeNotice] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Change Password state (Requirement 14)
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Registration profile fields
  const [name, setName] = useState('');
  const [honorific, setHonorific] = useState('Mr.');
  const [district, setDistrict] = useState('Peshawar');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  // Change Password Handler (Requirement 14)
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setPasswordMsg(null);

    if (!oldPasswordInput) {
      setPasswordMsg({ type: 'error', text: 'Please enter your current password' });
      return;
    }
    if (!newPasswordInput || newPasswordInput.length < 4) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 4 characters long' });
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    setPasswordLoading(true);
    const res = await changeUserPassword(currentUser.username, oldPasswordInput, newPasswordInput);
    setPasswordLoading(false);

    if (res.success) {
      setPasswordMsg({ type: 'success', text: 'Password successfully changed! Use your new password on next login.' });
      setOldPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setTimeout(() => {
        setShowChangePassword(false);
      }, 3000);
    } else {
      setPasswordMsg({ type: 'error', text: res.error || 'Failed to change password' });
    }
  };

  // Handle standard Sign In / Register
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!name.trim()) {
          setError('Please enter your full name');
          setLoading(false);
          return;
        }
        if (!email.trim() || !email.includes('@')) {
          setError('Please enter a valid email address for account and password recovery');
          setLoading(false);
          return;
        }

        const res = await registerUserAccount(username, password, email, {
          name: name.trim(),
          honorific,
          district,
        });

        if (!res.success || !res.user) {
          setError(res.error || 'Registration failed');
        } else {
          localStorage.setItem('kpst_registered_email', email.trim().toLowerCase());
          setSuccessMsg('Account registered successfully! Welcome to Litigation Assistant.');
          setTimeout(() => {
            onLoginSuccess(res.user!, true);
            if (!isMandatory) onClose();
          }, 700);
        }
      } else if (mode === 'signin') {
        const res = await authenticateUserAccount(username, password);
        if (!res.success || !res.user) {
          setError(res.error || 'Authentication failed');
        } else {
          setSuccessMsg(`Welcome back, ${res.user.honorific} ${res.user.name}!`);
          setTimeout(() => {
            onLoginSuccess(res.user!, false);
            if (!isMandatory) onClose();
          }, 600);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Request recovery by email
  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setDisplayCodeNotice('');
    setLoading(true);

    try {
      const res = await requestAccountRecovery(email);
      if (!res.success || !res.username) {
        setError(res.error || 'Could not find an account with this email');
      } else {
        setRecoveredUsername(res.username);
        setDisplayCodeNotice(res.recoveryCode || '');
        setRecoveryStep(2);
        setSuccessMsg(`Account found! Your registered username is: @${res.username}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Recovery request failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Reset password using verification code
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await resetPasswordWithCode(email, recoveryCode, newPassword);
      if (!res.success || !res.user) {
        setError(res.error || 'Password reset failed');
      } else {
        setSuccessMsg(`Password reset successful! Logging you in as @${res.user.username}...`);
        setTimeout(() => {
          onLoginSuccess(res.user!, false);
          if (!isMandatory) onClose();
        }, 800);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-400/30">
              {mode === 'recover' ? (
                <KeyRound className="w-5 h-5 text-amber-300" />
              ) : (
                <Cloud className="w-5 h-5 text-amber-300" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base">
                {currentUser
                  ? 'User Account & Cloud Sync'
                  : mode === 'recover'
                  ? 'Recover Username & Password'
                  : mode === 'register'
                  ? 'Litigant & Advocate Registration'
                  : 'Sign In to Your Account'}
              </h3>
              <p className="text-[11px] text-emerald-200">
                {mode === 'recover'
                  ? 'Retrieve your username & reset password using your email'
                  : isMandatory
                  ? 'Registration or Sign In required to access your court cases'
                  : 'Access your KPST cases on any mobile phone or browser'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Continue in offline mode"
            className="p-1 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {/* If already logged in */}
          {currentUser ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-bold text-emerald-950 text-sm">
                    {currentUser.honorific} {currentUser.name}
                  </div>
                  <div className="text-emerald-800 font-mono text-[11px]">
                    Username: <span className="font-bold">@{currentUser.username}</span>
                  </div>
                  {currentUser.email && (
                    <div className="text-emerald-700 text-[11px]">
                      Email: <span className="font-semibold">{currentUser.email}</span>
                    </div>
                  )}
                  <div className="text-emerald-700 text-[11px]">
                    District: <span className="font-semibold">{currentUser.district}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 text-[11px]">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Cross-Device Cloud Access Active</span>
                </div>
                <p className="text-[11px]">
                  All your tracked cases and updates are synced to your username. If you open this app on another phone or web browser, sign in with <strong>@{currentUser.username}</strong> and your password to fetch all your cases.
                </p>
              </div>

              {/* Change Password Section (Requirement 14) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePassword(!showChangePassword);
                    setPasswordMsg(null);
                  }}
                  className="w-full p-3 text-left font-bold text-xs text-slate-800 hover:bg-slate-50 flex items-center justify-between transition"
                >
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-emerald-700" />
                    <span>Change Account Password</span>
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold">
                    {showChangePassword ? 'Hide' : 'Change Password'}
                  </span>
                </button>

                {showChangePassword && (
                  <form onSubmit={handleChangePasswordSubmit} className="p-3.5 border-t border-slate-100 bg-slate-50/60 space-y-3">
                    {passwordMsg && (
                      <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                        passwordMsg.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        {passwordMsg.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span>{passwordMsg.text}</span>
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Current Password *
                      </label>
                      <input
                        type="password"
                        required
                        value={oldPasswordInput}
                        onChange={(e) => setOldPasswordInput(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        New Password *
                      </label>
                      <input
                        type="password"
                        required
                        minLength={4}
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        placeholder="Enter at least 4 characters"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Confirm New Password *
                      </label>
                      <input
                        type="password"
                        required
                        minLength={4}
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className="w-full py-2 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-amber-300" />
                      <span>{passwordLoading ? 'Updating Password...' : 'Save New Password'}</span>
                    </button>
                  </form>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                {onManualSync && (
                  <button
                    onClick={onManualSync}
                    disabled={isSyncing}
                    className="flex-1 py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Cloud Cases'}</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    onLogout();
                    if (!isMandatory) onClose();
                  }}
                  className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          ) : mode === 'recover' ? (
            /* Account Recovery Mode */
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError('');
                  setSuccessMsg('');
                  setRecoveryStep(1);
                }}
                className="text-xs text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-1.5 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
              )}

              {recoveryStep === 1 ? (
                /* Step 1: Enter registered email */
                <form onSubmit={handleRequestRecovery} className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1">
                    <p className="font-bold text-slate-900">Forgot your username or password?</p>
                    <p className="text-[11px] text-slate-600">
                      Enter your registered email address. We will look up your username and generate a verification code to reset your password.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Registered Email Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. advocate.nadeem@gmail.com"
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition shadow-inner"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Searching Account...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4 text-amber-300" />
                        <span>Find Username & Send Code</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Step 2: Verification Code & New Password */
                <form onSubmit={handleResetPassword} className="space-y-4">
                  {/* Recovered Username Notification */}
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span>Username Recovered:</span>
                      <span className="font-mono text-sm bg-white px-2 py-0.5 rounded border border-amber-300 font-extrabold text-emerald-800">
                        @{recoveredUsername}
                      </span>
                    </div>
                    {displayCodeNotice && (
                      <div className="pt-1.5 text-[11px] text-amber-900">
                        A 6-digit verification code has been sent to <strong>{email}</strong>.
                        <div className="mt-1 p-2 bg-white rounded border border-amber-200 font-mono text-center text-sm font-bold tracking-widest text-slate-900">
                          {displayCodeNotice}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 6-digit Code */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Enter 6-Digit Verification Code <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 482910"
                      className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-center font-mono text-base font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition tracking-widest"
                    />
                  </div>

                  {/* New Password */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Create New Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter your new password"
                        className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-800"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-amber-300" />
                        <span>Reset Password & Log In</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* Sign in or Register form */
            <div className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Tabs */}
              <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                    setSuccessMsg('');
                  }}
                  className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
                    mode === 'register' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>New Registration</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError('');
                    setSuccessMsg('');
                  }}
                  className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
                    mode === 'signin' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              </div>

              {isMandatory && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    <strong>Account Required:</strong> Please register your username and password below. You can use these credentials to log in on any phone or browser to fetch your cases.
                  </span>
                </div>
              )}

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Username Input */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800">
                  Username <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                    placeholder="e.g. nadeem_khan"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition shadow-inner"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Unique ID for this device and any other mobile or browser.
                </p>
              </div>

              {/* Email Address Input (Mandatory during Registration) */}
              {mode === 'register' && (
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-800">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. advocate.nadeem@gmail.com"
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition shadow-inner"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Used to recover your username & password if you ever forget them.
                  </p>
                </div>
              )}

              {/* Password Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('recover');
                        setError('');
                        setSuccessMsg('');
                        setRecoveryStep(1);
                      }}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                    >
                      Forgot Username / Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your secret password"
                    className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-800"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Extra registration fields */}
              {mode === 'register' && (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-800">Title</label>
                      <select
                        value={honorific}
                        onChange={(e) => setHonorific(e.target.value)}
                        className="w-full px-2 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      >
                        <option value="Mr.">Mr.</option>
                        <option value="Ms.">Ms.</option>
                        <option value="Mrs.">Mrs.</option>
                        <option value="Advocate">Advocate</option>
                        <option value="Barrister">Barrister</option>
                        <option value="Dr.">Dr.</option>
                      </select>
                    </div>

                    <div className="col-span-2 space-y-1">
                      <label className="block text-[11px] font-bold text-slate-800">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Nadeem Khan"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-800">District (KP)</label>
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      {KP_DISTRICTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : mode === 'signin' ? (
                  <>
                    <LogIn className="w-4 h-4 text-amber-300" />
                    <span>Sign In & Fetch My Cases</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 text-amber-300" />
                    <span>Register Account & Enter</span>
                  </>
                )}
              </button>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-1.5">
                <p className="text-[10px] text-slate-500">
                  🔒 Data is securely indexed in cloud storage. No cases will be visible until you add your first case.
                </p>
                <div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline"
                  >
                    Continue in Offline Mode (Access Saved Cases Locally)
                  </button>
                </div>
              </div>
            </form>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};
