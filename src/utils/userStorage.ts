/**
 * Multi-User Isolation Storage System
 * Scopes all court cases, settings, search history, and profile data
 * to isolated per-user localStorage keys to prevent concurrent users
 * on different devices or shared browsers from overwriting each other's data.
 */

import { CourtCase, UserProfile } from '../types';

export interface UserSettings {
  soundEnabled: boolean;
  autoRefresh: boolean;
  hearingReminderDays: number;
  theme: 'emerald' | 'dark' | 'slate';
}

export interface UserAccountData {
  userId: string; // Lowercase unique identifier / username / reference ID
  username: string;
  name: string;
  honorific: string;
  district: string;
  referenceId: string;
  profilePictureUrl?: string;
  createdDate: string;
  lastLoginDate: string;
}

const STORAGE_KEYS = {
  ACTIVE_USER_ID: 'kpst_active_user_id',
  USERS_INDEX: 'kpst_all_local_users_v2',
  LEGACY_CASES: 'kpst_court_cases',
  LEGACY_PROFILE: 'kpst_user_profile',
  LEGACY_CURRENT_USER: 'kpst_current_user',
};

const DEFAULT_SETTINGS: UserSettings = {
  soundEnabled: true,
  autoRefresh: true,
  hearingReminderDays: 1,
  theme: 'emerald',
};

/**
 * Normalizes username / reference ID to safe unique key
 */
export function normalizeUserId(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

/**
 * Get active user ID in this browser session
 */
export function getActiveUserId(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID);
}

/**
 * Set active user ID in this browser session
 */
export function setActiveUserId(userId: string): void {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, userId);
}

/**
 * Clear active user (logout)
 */
export function clearActiveUser(): void {
  localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER_ID);
}

/**
 * Get all registered user profiles on this browser/device
 */
export function getAllLocalUsers(): UserAccountData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS_INDEX);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Save user profile to local index and isolated user key
 */
export function saveLocalUser(userData: UserAccountData): void {
  const users = getAllLocalUsers();
  const existingIdx = users.findIndex((u) => u.userId === userData.userId);

  if (existingIdx >= 0) {
    users[existingIdx] = userData;
  } else {
    users.push(userData);
  }

  localStorage.setItem(STORAGE_KEYS.USERS_INDEX, JSON.stringify(users));
  localStorage.setItem(`kpst_user_${userData.userId}_profile`, JSON.stringify(userData));
  setActiveUserId(userData.userId);
}

/**
 * Get isolated profile for specific user
 */
export function getUserProfile(userId: string): UserProfile | null {
  try {
    const raw = localStorage.getItem(`kpst_user_${userId}_profile`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      name: parsed.name,
      honorific: parsed.honorific || 'Mr.',
      district: parsed.district || 'Peshawar',
      profilePictureUrl: parsed.profilePictureUrl,
      isOnboarded: true,
    };
  } catch {
    return null;
  }
}

/**
 * Get isolated court cases for specific user
 */
export function getUserCases(userId: string): CourtCase[] {
  try {
    const raw = localStorage.getItem(`kpst_user_${userId}_cases`);
    if (raw) {
      return JSON.parse(raw);
    }

    // Check if there is legacy un-isolated data for migration
    const legacyRaw = localStorage.getItem(STORAGE_KEYS.LEGACY_CASES);
    if (legacyRaw) {
      const cases: CourtCase[] = JSON.parse(legacyRaw);
      // Migrate to user isolated storage
      saveUserCases(userId, cases);
      return cases;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Save isolated court cases for specific user
 */
export function saveUserCases(userId: string, cases: CourtCase[]): void {
  localStorage.setItem(`kpst_user_${userId}_cases`, JSON.stringify(cases));
}

/**
 * Get isolated settings for specific user
 */
export function getUserSettings(userId: string): UserSettings {
  try {
    const raw = localStorage.getItem(`kpst_user_${userId}_settings`);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save isolated settings for specific user
 */
export function saveUserSettings(userId: string, settings: Partial<UserSettings>): void {
  const current = getUserSettings(userId);
  const updated = { ...current, ...settings };
  localStorage.setItem(`kpst_user_${userId}_settings`, JSON.stringify(updated));
}

/**
 * Get isolated search history for specific user
 */
export function getUserSearchHistory(userId: string): string[] {
  try {
    const raw = localStorage.getItem(`kpst_user_${userId}_search_history`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Record isolated search query for specific user (capped at 15 recent items)
 */
export function addUserSearchHistory(userId: string, query: string): void {
  if (!query || !query.trim()) return;
  const clean = query.trim();
  const history = getUserSearchHistory(userId).filter((item) => item.toLowerCase() !== clean.toLowerCase());
  history.unshift(clean);
  if (history.length > 15) history.pop();
  localStorage.setItem(`kpst_user_${userId}_search_history`, JSON.stringify(history));
}
