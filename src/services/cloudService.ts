import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { CourtCase } from '../types';
import { hashPassword, verifyPassword, sanitizeUsername } from '../utils/authUtils';

export interface CloudUserAccount {
  username: string;
  passwordHash: string;
  email: string;
  name: string;
  honorific: string;
  district: string;
  createdAt: string;
  lastLogin: string;
  recoveryCode?: string;
  recoveryExpires?: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {},
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Register a new user account with unique username, password, and recovery email
 */
export async function registerUserAccount(
  rawUsername: string,
  rawPassword: string,
  rawEmail: string,
  profile: { name: string; honorific?: string; district: string }
): Promise<{ success: boolean; error?: string; user?: CloudUserAccount }> {
  const username = sanitizeUsername(rawUsername);
  if (!username || username.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters (letters, numbers, underscores)' };
  }
  if (!rawPassword || rawPassword.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters long' };
  }
  const email = sanitizeEmail(rawEmail);
  if (!email || !email.includes('@') || !email.includes('.')) {
    return { success: false, error: 'Please enter a valid email address for account and password recovery' };
  }

  const accountRef = doc(db, 'accounts', username);
  const recoveryRef = doc(db, 'recovery_emails', email);

  try {
    const existing = await getDoc(accountRef);
    if (existing.exists()) {
      return { success: false, error: `Username "${username}" is already taken. Please choose another username or sign in.` };
    }

    const passwordHash = await hashPassword(rawPassword);
    const now = new Date().toISOString();

    const accountData: CloudUserAccount = {
      username,
      passwordHash,
      email,
      name: profile.name.trim() || username,
      honorific: profile.honorific || 'Mr.',
      district: profile.district || 'Peshawar',
      createdAt: now,
      lastLogin: now,
    };

    // Save account
    await setDoc(accountRef, accountData);

    // Save recovery index mapping email -> username
    try {
      await setDoc(recoveryRef, {
        email,
        username,
        updatedAt: now,
      });
    } catch (e) {
      console.warn('Could not set recovery email index:', e);
    }

    return { success: true, user: accountData };
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, `accounts/${username}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  }
}

/**
 * Sign in existing user account with username and password
 */
export async function authenticateUserAccount(
  rawUsername: string,
  rawPassword: string
): Promise<{ success: boolean; error?: string; user?: CloudUserAccount }> {
  const username = sanitizeUsername(rawUsername);
  if (!username) {
    return { success: false, error: 'Please enter your username' };
  }
  if (!rawPassword) {
    return { success: false, error: 'Please enter your password' };
  }

  const accountRef = doc(db, 'accounts', username);

  try {
    const docSnap = await getDoc(accountRef);
    if (!docSnap.exists()) {
      return { success: false, error: `Account with username "${username}" not found. Please check spelling or register.` };
    }

    const accountData = docSnap.data() as CloudUserAccount;
    const isPasswordValid = await verifyPassword(rawPassword, accountData.passwordHash);

    if (!isPasswordValid) {
      return { success: false, error: 'Incorrect password. If you forgot it, use the recovery link below.' };
    }

    // Update lastLogin timestamp
    try {
      await setDoc(accountRef, { ...accountData, lastLogin: new Date().toISOString() });
    } catch {
      // non-critical
    }

    return { success: true, user: accountData };
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.GET, `accounts/${username}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  }
}

/**
 * Change account password for authenticated user (Requirement 14)
 */
export async function changeUserPassword(
  rawUsername: string,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const username = sanitizeUsername(rawUsername);
  if (!username) {
    return { success: false, error: 'User is not signed in' };
  }
  if (!oldPassword) {
    return { success: false, error: 'Please enter your current password' };
  }
  if (!newPassword || newPassword.length < 4) {
    return { success: false, error: 'New password must be at least 4 characters long' };
  }
  if (oldPassword === newPassword) {
    return { success: false, error: 'New password must be different from current password' };
  }

  const accountRef = doc(db, 'accounts', username);

  try {
    const docSnap = await getDoc(accountRef);
    if (!docSnap.exists()) {
      return { success: false, error: 'Account not found' };
    }

    const accountData = docSnap.data() as CloudUserAccount;
    const isOldValid = await verifyPassword(oldPassword, accountData.passwordHash);

    if (!isOldValid) {
      return { success: false, error: 'Current password is incorrect' };
    }

    const newHash = await hashPassword(newPassword);
    await setDoc(accountRef, {
      ...accountData,
      passwordHash: newHash,
      lastLogin: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, `accounts/${username}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  }
}

/**
 * Request account recovery using registered email.
 * Finds the username and generates a 6-digit recovery code.
 */
export async function requestAccountRecovery(
  rawEmail: string
): Promise<{ success: boolean; error?: string; username?: string; recoveryCode?: string; email?: string }> {
  const email = sanitizeEmail(rawEmail);
  if (!email || !email.includes('@') || !email.includes('.')) {
    return { success: false, error: 'Please enter a valid email address' };
  }

  try {
    const recoveryRef = doc(db, 'recovery_emails', email);
    const recSnap = await getDoc(recoveryRef);

    let targetUsername = '';

    if (recSnap.exists()) {
      targetUsername = recSnap.data()?.username || '';
    }

    // If not in recovery_emails, scan accounts collection for this email
    if (!targetUsername) {
      const accountsSnap = await getDocs(collection(db, 'accounts'));
      accountsSnap.forEach((d) => {
        const data = d.data() as CloudUserAccount;
        if (data.email && sanitizeEmail(data.email) === email) {
          targetUsername = data.username;
        }
      });
    }

    if (!targetUsername) {
      return {
        success: false,
        error: `No registered account found for email "${email}". Please verify your email or create a new account.`,
      };
    }

    // Generate 6-digit code
    const recoveryCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

    // Update recovery_emails and accounts document
    await setDoc(
      recoveryRef,
      {
        email,
        username: targetUsername,
        recoveryCode,
        expiresAt,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const accountRef = doc(db, 'accounts', targetUsername);
    await setDoc(
      accountRef,
      {
        recoveryCode,
        recoveryExpires: expiresAt,
      },
      { merge: true }
    );

    return {
      success: true,
      username: targetUsername,
      recoveryCode,
      email,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Recovery request failed: ${msg}` };
  }
}

/**
 * Verify recovery code and reset user's password
 */
export async function resetPasswordWithCode(
  rawEmail: string,
  enteredCode: string,
  newPassword: string
): Promise<{ success: boolean; error?: string; user?: CloudUserAccount }> {
  const email = sanitizeEmail(rawEmail);
  const code = enteredCode.trim();

  if (!code || code.length !== 6) {
    return { success: false, error: 'Please enter the 6-digit recovery code' };
  }
  if (!newPassword || newPassword.length < 4) {
    return { success: false, error: 'New password must be at least 4 characters long' };
  }

  try {
    const recoveryRef = doc(db, 'recovery_emails', email);
    const recSnap = await getDoc(recoveryRef);

    if (!recSnap.exists()) {
      return { success: false, error: 'Recovery session expired or not found. Please request a new code.' };
    }

    const recData = recSnap.data();
    if (recData.recoveryCode !== code) {
      return { success: false, error: 'Invalid 6-digit verification code. Please check and try again.' };
    }

    if (recData.expiresAt && new Date(recData.expiresAt).getTime() < Date.now()) {
      return { success: false, error: 'This recovery code has expired. Please request a new recovery code.' };
    }

    const username = recData.username;
    const accountRef = doc(db, 'accounts', username);
    const accSnap = await getDoc(accountRef);

    if (!accSnap.exists()) {
      return { success: false, error: `Account @${username} could not be found.` };
    }

    const currentAccData = accSnap.data() as CloudUserAccount;
    const newPasswordHash = await hashPassword(newPassword);

    const updatedAccData: CloudUserAccount = {
      ...currentAccData,
      passwordHash: newPasswordHash,
      recoveryCode: '',
      recoveryExpires: '',
      lastLogin: new Date().toISOString(),
    };

    await setDoc(accountRef, updatedAccData);

    // Clear code from recovery index
    await setDoc(
      recoveryRef,
      {
        recoveryCode: '',
        expiresAt: '',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return { success: true, user: updatedAccData };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Password reset failed: ${msg}` };
  }
}

/**
 * Fetch all saved court cases for this username from Firestore
 */
export async function fetchCloudCases(rawUsername: string): Promise<CourtCase[]> {
  const username = sanitizeUsername(rawUsername);
  if (!username) return [];

  const casesColRef = collection(db, 'accounts', username, 'cases');

  try {
    const snap = await getDocs(casesColRef);
    const list: CourtCase[] = [];
    snap.forEach((docItem) => {
      list.push(docItem.data() as CourtCase);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `accounts/${username}/cases`);
  }
}

/**
 * Save or update an individual court case under the user's account
 */
export async function saveCloudCase(rawUsername: string, courtCase: CourtCase): Promise<void> {
  const username = sanitizeUsername(rawUsername);
  if (!username || !courtCase.id) return;

  const caseRef = doc(db, 'accounts', username, 'cases', courtCase.id);

  try {
    await setDoc(caseRef, {
      ...courtCase,
      username,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `accounts/${username}/cases/${courtCase.id}`);
  }
}

/**
 * Delete a court case from user's account
 */
export async function deleteCloudCase(rawUsername: string, caseId: string): Promise<void> {
  const username = sanitizeUsername(rawUsername);
  if (!username || !caseId) return;

  const caseRef = doc(db, 'accounts', username, 'cases', caseId);

  try {
    await deleteDoc(caseRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `accounts/${username}/cases/${caseId}`);
  }
}

/**
 * Sync all cases to cloud in a batch
 */
export async function syncAllCasesToCloud(rawUsername: string, cases: CourtCase[]): Promise<void> {
  const username = sanitizeUsername(rawUsername);
  if (!username || cases.length === 0) return;

  try {
    const batch = writeBatch(db);
    cases.forEach((c) => {
      const caseRef = doc(db, 'accounts', username, 'cases', c.id);
      batch.set(caseRef, {
        ...c,
        username,
        lastUpdated: new Date().toISOString(),
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `accounts/${username}/cases`);
  }
}
