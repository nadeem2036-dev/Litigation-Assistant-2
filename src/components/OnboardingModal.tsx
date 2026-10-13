import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, KP_DISTRICTS, HONORIFICS } from '../types';
import { Scale, MapPin, User, CheckCircle2, Camera, Trash2, ShieldCheck, Users } from 'lucide-react';
import { getAllLocalUsers, normalizeUserId, UserAccountData } from '../utils/userStorage';

interface OnboardingModalProps {
  isOpen: boolean;
  initialProfile?: UserProfile;
  onSave: (profile: UserProfile) => void;
  onClose?: () => void;
  isEditing?: boolean;
  onSwitchUser?: (userId: string) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  initialProfile,
  onSave,
  onClose,
  isEditing = false,
  onSwitchUser,
}) => {
  const [name, setName] = useState(initialProfile?.name || '');
  const [username, setUsername] = useState(initialProfile?.username || '');
  const [honorific, setHonorific] = useState(initialProfile?.honorific || 'Mr.');
  const [district, setDistrict] = useState(initialProfile?.district || 'Peshawar');
  const [profilePictureUrl, setProfilePictureUrl] = useState(initialProfile?.profilePictureUrl || '');
  const [error, setError] = useState('');
  const [localUsers, setLocalUsers] = useState<UserAccountData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalUsers(getAllLocalUsers());
      setName(initialProfile?.name || '');
      setUsername(initialProfile?.username || '');
      setHonorific(initialProfile?.honorific || 'Mr.');
      setDistrict(initialProfile?.district || 'Peshawar');
      setProfilePictureUrl(initialProfile?.profilePictureUrl || '');
      setError('');
    }
  }, [isOpen, initialProfile]);

  if (!isOpen) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Please choose an image under 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setProfilePictureUrl(result);
        setError('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your full name or advocate title');
      return;
    }

    const fallbackUsername = normalizeUserId(name);
    const cleanUsername = username.trim() ? normalizeUserId(username) : fallbackUsername;

    if (!cleanUsername) {
      setError('Please provide a valid username or reference ID');
      return;
    }

    onSave({
      name: name.trim(),
      honorific,
      district,
      username: cleanUsername,
      referenceId: cleanUsername,
      profilePictureUrl: profilePictureUrl || undefined,
      isOnboarded: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-emerald-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with KP Gov green branding */}
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 p-5 sm:p-6 text-white text-center relative shrink-0">
          <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 bg-emerald-700/60 rounded-full flex items-center justify-center shadow-inner mb-2.5 sm:mb-3 border border-emerald-400/30">
            <Scale className="w-7 h-7 sm:w-8 sm:h-8 text-amber-300" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">
            {isEditing ? 'Update Profile & Multi-User Settings' : 'Welcome to Litigation Assistant'}
          </h2>
          <p className="text-xs text-emerald-200 mt-1 max-w-xs mx-auto">
            {isEditing
              ? 'Modify your identity, reference ID, and jurisdiction district'
              : 'Enter your username and profile name to isolate your docket in local browser storage'}
          </p>
        </div>

        {/* Existing Users Switcher if multiple accounts exist on this device */}
        {localUsers.length > 0 && !isEditing && (
          <div className="px-5 pt-3 pb-1 bg-emerald-50/70 border-b border-emerald-100">
            <div className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5 mb-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-700" />
              <span>Existing Profiles on this device:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pb-2">
              {localUsers.map((u) => (
                <button
                  key={u.userId}
                  type="button"
                  onClick={() => {
                    if (onSwitchUser) onSwitchUser(u.userId);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg text-[11px] font-semibold text-emerald-900 transition flex items-center gap-1 active:scale-95"
                >
                  <span>@{u.username}</span>
                  <span className="text-[9px] text-slate-500 font-normal">({u.name})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-medium">
              {error}
            </div>
          )}

          {/* Profile Picture Upload */}
          <div className="flex flex-col items-center justify-center pt-1 pb-1">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full border-2 border-emerald-500/40 p-0.5 bg-emerald-50 shadow-md flex items-center justify-center overflow-hidden">
                {profilePictureUrl ? (
                  <img
                    src={profilePictureUrl}
                    alt="Profile Avatar"
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-emerald-800 text-amber-200 flex items-center justify-center text-xl font-bold">
                    {name ? name.slice(0, 2).toUpperCase() : 'LA'}
                  </div>
                )}
              </div>

              {/* Upload button overlay */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-full shadow-md border-2 border-white transition active:scale-90"
                title="Upload Profile Picture"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />

            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
              >
                {profilePictureUrl ? 'Change Picture' : 'Upload Profile Picture'}
              </button>

              {profilePictureUrl && (
                <button
                  type="button"
                  onClick={() => setProfilePictureUrl('')}
                  className="text-[11px] text-rose-600 hover:text-rose-800 flex items-center gap-0.5"
                  title="Remove photo"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove</span>
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              JPG, PNG or WEBP (Max 2MB)
            </p>
          </div>

          {/* Username / Reference ID (Multi-User Isolation) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Username or Reference ID *</span>
              <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Isolated Storage</span>
              </span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                @
              </div>
              <input
                type="text"
                required
                placeholder="e.g. advocate_ali or ref-2026"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
                  if (error) setError('');
                }}
                className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              All your tracked cases, settings, and search history are isolated in browser storage under this ID so multiple users never overwrite each other.
            </p>
          </div>

          {/* Honorific & Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Full Name or Advocate Title *
            </label>
            <div className="flex gap-2">
              <select
                value={honorific}
                onChange={(e) => setHonorific(e.target.value)}
                className="w-24 px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
              >
                {HONORIFICS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>

              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. Muhammad Nadeem"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!username && !isEditing) {
                      setUsername(normalizeUserId(e.target.value));
                    }
                    if (error) setError('');
                  }}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Displayed in the official court welcome banner and exported dockets.
            </p>
          </div>

          {/* District Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>District (Khyber Pakhtunkhwa) *</span>
              <span className="text-[10px] text-emerald-700 font-normal">36 Districts Available</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <MapPin className="w-4 h-4 text-emerald-600" />
              </div>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white appearance-none cursor-pointer"
              >
                {KP_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    District {d} {d === 'Peshawar' ? '(Principal Seat)' : ['Swat', 'Abbottabad', 'Dera Ismail Khan'].includes(d) ? '(Circuit Bench)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Select your residence or practicing jurisdiction district in KP.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            {isEditing && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 border border-slate-300 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-100 transition active:scale-[0.98]"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              {isEditing ? 'Save Changes' : 'Activate My Docket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
