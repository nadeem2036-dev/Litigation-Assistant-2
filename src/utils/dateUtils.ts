import { CourtCase, HearingAlert } from '../types';

/**
 * Parses diverse court date formats into a standard JS Date object.
 * Returns null if invalid or not specified.
 */
export function parseHearingDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'n/a') return null;

  // Format 1: Textual, e.g. "Monday, 05OCT 2026" or "05-Oct-2026" or "5 Oct 2026"
  const textMatch = trimmed.match(/(\d{1,2})\s*[-/]?\s*([A-Za-z]{3,9})\s*[-/]?\s*(\d{4})/);
  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const monthStr = textMatch[2].toUpperCase().slice(0, 3);
    const year = parseInt(textMatch[3], 10);
    const months: Record<string, number> = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
    };
    if (months[monthStr] !== undefined) {
      return new Date(year, months[monthStr], day, 0, 0, 0);
    }
  }

  // Format 2: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day, 0, 0, 0);
    if (!isNaN(d.getTime())) return d;
  }

  // Format 3: YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day, 0, 0, 0);
    if (!isNaN(d.getTime())) return d;
  }

  // Format 4: Standard Date constructor fallback
  const cleanText = trimmed.replace(/^[a-zA-Z]+,\s*/, '');
  const parsed = new Date(cleanText);
  if (!isNaN(parsed.getTime())) {
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  return null;
}

/**
 * Sorts court cases so that the case with the earliest upcoming hearing date is first.
 * Cases without hearing date or already decided come after upcoming hearings.
 */
export function sortCasesByHearingDate(cases: CourtCase[]): CourtCase[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return [...cases].sort((a, b) => {
    const dateA = parseHearingDate(a.nextDate);
    const dateB = parseHearingDate(b.nextDate);

    // If both have valid hearing dates
    if (dateA && dateB) {
      const isAUpcoming = dateA.getTime() >= now.getTime();
      const isBUpcoming = dateB.getTime() >= now.getTime();

      // Prioritize upcoming dates over past dates
      if (isAUpcoming && !isBUpcoming) return -1;
      if (!isAUpcoming && isBUpcoming) return 1;

      // Both upcoming or both past: sort chronologically (earliest first)
      return dateA.getTime() - dateB.getTime();
    }

    // A has date, B doesn't -> A comes first
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;

    // Neither has date: sort by year and appeal number descending
    const yearA = parseInt(a.year, 10) || 0;
    const yearB = parseInt(b.year, 10) || 0;
    if (yearA !== yearB) return yearB - yearA;

    const noA = parseInt(a.appealNo, 10) || 0;
    const noB = parseInt(b.appealNo, 10) || 0;
    return noB - noA;
  });
}

/**
 * Requirement 8:
 * "The app should notify the user about every case on 11:00 AM one day before the case
 * is to be heard by the court. For example, if a case is fixed for hearing on 24-10-2026,
 * the app should notify the user at 11:00 AM on 23-10-2026 with a message that
 * ([Case Title] Scheduled for 24-10-2026)."
 */
export function calculateNotificationTriggerTime(hearingDateStr: string): Date | null {
  const hearingDate = parseHearingDate(hearingDateStr);
  if (!hearingDate) return null;

  // One day before hearing date at 11:00:00 AM
  const alertDate = new Date(hearingDate);
  alertDate.setDate(alertDate.getDate() - 1);
  alertDate.setHours(11, 0, 0, 0);

  return alertDate;
}

/**
 * Standardize display date as DD-MM-YYYY
 */
export function formatDisplayDate(dateStr: string): string {
  const d = parseHearingDate(dateStr);
  if (!d) return dateStr || '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Convert any date string into YYYY-MM-DD for HTML input or API query
 */
export function parseKpstDateToYMD(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseHearingDate(dateStr);
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate hearing alert object for a case
 */
export function generateCaseAlert(courtCase: CourtCase): HearingAlert | null {
  if (!courtCase.nextDate) return null;
  const triggerTime = calculateNotificationTriggerTime(courtCase.nextDate);
  if (!triggerTime) return null;

  const formattedHearing = formatDisplayDate(courtCase.nextDate);
  const now = new Date();

  return {
    id: `alert-${courtCase.id}-${formattedHearing}`,
    caseId: courtCase.id,
    caseTitle: courtCase.caseTitle || `Appeal No. ${courtCase.appealNo}/${courtCase.year}`,
    appealNo: courtCase.appealNo,
    year: courtCase.year,
    hearingDate: formattedHearing,
    alertScheduledTime: triggerTime.toISOString(),
    hasTriggered: now.getTime() >= triggerTime.getTime(),
    message: `${courtCase.caseTitle || `Appeal ${courtCase.appealNo}/${courtCase.year}`} Scheduled for ${formattedHearing}`,
  };
}
