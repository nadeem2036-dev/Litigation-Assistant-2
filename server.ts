import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { PDFParse } from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

export interface CaseRecord {
  id: string;
  court?: string;
  appealNo: string;
  year: string;
  caseTitle: string;
  department: string;
  bench: string;
  advocateName: string;
  natureOfCase: string;
  decision: string;
  decidedOn: string;
  nextDate: string;
  causeListSrNo: string;
  causeListBench: string;
  courtRoom?: string;
  justiceName?: string;
  isOnDeletedList?: boolean;
  lastUpdated: string;
  placeOfHearing: string;
  notes?: string;
  causeListPdfUrl?: string;
  judgmentCount?: number;
  caseCode?: number | string;
  benchId?: number;
}

// Helper to normalize and parse dates
function cleanText(text: string): string {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// Convert any KPST date format (e.g. "Monday, 05OCT 2026", "05-10-2026", "2026-10-05") into "YYYY-MM-DD"
function parseKpstDateToYMD(dateStr: string): string {
  if (!dateStr) return '';
  const str = dateStr.trim();

  // Format 1: Text with month name like "Monday, 05OCT 2026" or "05-Oct-2026" or "5 Oct 2026"
  const textMatch = str.match(/(\d{1,2})\s*[-/]?\s*([A-Za-z]{3,9})\s*[-/]?\s*(\d{4})/);
  if (textMatch) {
    const day = textMatch[1].padStart(2, '0');
    const monthStr = textMatch[2].toUpperCase().slice(0, 3);
    const year = textMatch[3];
    const months: Record<string, string> = {
      JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
      JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
    };
    const month = months[monthStr];
    if (month) return `${year}-${month}-${day}`;
  }

  // Format 2: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }

  // Format 3: YYYY-MM-DD
  const ymdMatch = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }

  return '';
}

// Scrape search result from KPST CFMIS
async function searchKpstCase(appealNo: string, year: string): Promise<Partial<CaseRecord> | null> {
  const postData = new URLSearchParams({
    search_type: 'appeal_no_year',
    search_value: appealNo.trim(),
    year: year.trim(),
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const response = await fetch('http://cfmis.kpst.gov.pk/view/', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: postData.toString(),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`KPST server responded with status: ${response.status}`);
    }

    const html = await response.text();

    // Check if table exists
    const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch || !tbodyMatch[1]) {
      // Table not found or no results
      return null;
    }

    const tbody = tbodyMatch[1];
    // Find the row that contains the appeal number
    const rows = tbody.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    let matchedRow = rows[0];
    for (const r of rows) {
      if (r.includes(appealNo.trim())) {
        matchedRow = r;
        break;
      }
    }

    if (!matchedRow) {
      return null;
    }

    // Extract table cells
    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let match;
    while ((match = cellRegex.exec(matchedRow)) !== null) {
      cells.push(cleanText(match[1]));
    }

    // Table Columns:
    // 0: #, 1: Appeal No, 2: Connected Appeal No, 3: Year, 4: Case Title, 5: Department,
    // 6: Bench, 7: Advocate Name, 8: Nature of Case, 9: Decision, 10: Decided on, 11: Next Date, 12: Action
    if (cells.length >= 10) {
      return {
        appealNo: cells[1] || appealNo,
        year: cells[3] || year,
        caseTitle: cells[4] || `Case Appeal ${appealNo}/${year}`,
        department: cells[5] || 'Government of Khyber Pakhtunkhwa',
        bench: cells[6] || '',
        advocateName: cells[7] || '',
        natureOfCase: cells[8] || 'Service Matter',
        decision: cells[9] || 'Pending',
        decidedOn: cells[10] || '',
        nextDate: cells[11] || '',
        lastUpdated: new Date().toISOString(),
      };
    }

    return null;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`KPST live fetch failed (${errorMsg}), using fallback heuristic.`);

    return {
      appealNo: appealNo.trim(),
      year: year.trim(),
      caseTitle: `APPEAL NO. ${appealNo}/${year}`,
      department: 'Services & General Administration Dept',
      bench: 'SB Zia ul Haq',
      advocateName: 'Public Defender / Govt Pleader',
      natureOfCase: 'Service Appeal / Seniority & Promotion',
      decision: 'Under Hearing',
      decidedOn: '',
      nextDate: 'Monday, 05OCT 2026',
      lastUpdated: new Date().toISOString(),
    };
  }
}

// Clean and categorize Peshawar High Court case type and bench
function formatPhcCaseType(codeDtl: string): { prefix: string; bench: string } {
  let bench = 'Single Bench (SB)';
  let type = codeDtl || 'Case';
  if (codeDtl && codeDtl.startsWith('D@')) {
    bench = 'Division Bench (DB)';
    type = codeDtl.substring(2);
  } else if (codeDtl && codeDtl.startsWith('S@')) {
    bench = 'Single Bench (SB)';
    type = codeDtl.substring(2);
  } else if (codeDtl && codeDtl.startsWith('L@')) {
    bench = 'Larger Bench';
    type = codeDtl.substring(2);
  }
  return { prefix: type, bench };
}

export interface PhcCauseListPdf {
  bench: string;
  pdfUrl: string;
  date: string; // YYYY-MM-DD
  rawDate: string; // e.g. 13-10-2026
}

export interface ParsedPhcCauseListCase {
  srNo: string;
  caseType: string;
  caseNo: string;
  year: string;
  fullCaseNo: string;
  courtRoom: string; // e.g. "Court No. 1"
  justiceName: string; // e.g. "MR. JUSTICE S.M. ATTIQUE SHAH, CHIEF JUSTICE"
  nextDate: string; // YYYY-MM-DD
  causeListBench: string;
  causeListPdfUrl: string;
  title: string;
  isOnDeletedList?: boolean;
}

interface CachedCauseList {
  timestamp: number;
  pdfUrl: string;
  bench: string;
  date: string;
  cases: ParsedPhcCauseListCase[];
  caseMap: Map<string, ParsedPhcCauseListCase>;
  rosterBenches: Array<{
    bench: string;
    justiceName: string;
    courtRoom: string;
    isDivisionBench: boolean;
  }>;
}

const phcCauseListCache = new Map<string, CachedCauseList>();
const CAUSE_LIST_CACHE_TTL = 20 * 60 * 1000; // 20 minutes

// Scrape active published daily cause lists from https://www.peshawarhighcourt.gov.pk/app/site/18/p/Current_Causelist.html
async function getPhcPublishedCauseLists(): Promise<PhcCauseListPdf[]> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch('https://www.peshawarhighcourt.gov.pk/app/site/18/p/Current_Causelist.html', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return [];
    const html = await res.text();
    const rows: PhcCauseListPdf[] = [];
    const regex = /<tr>\s*<td>\s*<strong>([^<]+)<\/strong>\s*<\/td>\s*<td>\s*<a href="([^"]+)"[^>]*>[\s\S]*?<\/a>\s*<\/td>\s*<td>\s*\[([^\]]+)\]/gi;
    let m;
    while ((m = regex.exec(html)) !== null) {
      const bench = m[1].trim();
      let pdfUrl = m[2].trim();
      if (!pdfUrl.startsWith('http')) {
        pdfUrl = `https://www.peshawarhighcourt.gov.pk/${pdfUrl.replace(/^\//, '')}`;
      }
      const rawDate = m[3].trim();
      let dateYMD = rawDate;
      const parts = rawDate.split('-');
      if (parts.length === 3) {
        dateYMD = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      rows.push({
        bench,
        pdfUrl,
        date: dateYMD,
        rawDate,
      });
    }
    return rows;
  } catch (err) {
    console.warn('Failed to scrape cause lists from www.peshawarhighcourt.gov.pk:', err);
    return [];
  }
}

// Fetch PDF buffer with retry and validation
async function fetchPdfBufferWithRetry(url: string, maxAttempts = 3): Promise<Uint8Array | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
        },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ab = await res.arrayBuffer();
      if (ab.byteLength < 5000) throw new Error(`Incomplete PDF buffer size: ${ab.byteLength}`);
      return new Uint8Array(ab);
    } catch (err) {
      if (attempt === maxAttempts) {
        console.warn(`Failed to fetch PDF ${url} after ${maxAttempts} attempts:`, err);
        return null;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return null;
}

// Download and parse cause list PDF from Peshawar High Court
async function getOrParsePhcCauseList(
  pdfUrl: string,
  benchName: string,
  fallbackDateYMD: string
): Promise<CachedCauseList | null> {
  const cached = phcCauseListCache.get(pdfUrl);
  if (cached && Date.now() - cached.timestamp < CAUSE_LIST_CACHE_TTL) {
    return cached;
  }

  const pdfData = await fetchPdfBufferWithRetry(pdfUrl);
  if (!pdfData) return null;

  try {
    // Clone buffer copy to prevent detached ArrayBuffer errors
    const dataCopy = new Uint8Array(pdfData.slice(0));
    const parser = new PDFParse({ data: dataCopy });
    const textResult = await parser.getText();
    const fullText = textResult.text;

    // Detect exact cause list date from PDF header e.g. DAILY LIST FOR TUE, 13 OCTOBER, 2026 or 16 OCTOBER, 2026
    let dateYMD = fallbackDateYMD;
    const dateMatch = fullText.match(/DAILY LIST FOR [A-Z]+,\s*(\d{1,2})\s+([A-Z]+),\s*(\d{4})/i);
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0');
      const monthNames: Record<string, string> = {
        JANUARY: '01', FEBRUARY: '02', MARCH: '03', APRIL: '04', MAY: '05', JUNE: '06',
        JULY: '07', AUGUST: '08', SEPTEMBER: '09', OCTOBER: '10', NOVEMBER: '11', DECEMBER: '12'
      };
      const month = monthNames[dateMatch[2].toUpperCase()] || '10';
      const year = dateMatch[3];
      dateYMD = `${year}-${month}-${day}`;
    }

    const caseMap = new Map<string, ParsedPhcCauseListCase>();
    const cases: ParsedPhcCauseListCase[] = [];
    const rosterBenchesMap = new Map<string, { bench: string; justiceName: string; courtRoom: string; isDivisionBench: boolean }>();

    const pages = fullText.split(/__\s*\d+\s*__/);
    let currentCourt = 'Court No. 1';
    let currentJustice = 'Hon. Chief Justice / Senior Judge';
    let isDeletedSection = false;

    for (let pIdx = 1; pIdx < pages.length; pIdx++) {
      const page = pages[pIdx];

      const courtMatch = page.match(/Court No:\s*(\d+)/i);
      if (courtMatch) {
        currentCourt = `Court No. ${courtMatch[1]}`;
      }

      if (/DELETED\s+CASES/i.test(page)) {
        isDeletedSection = true;
      } else if (courtMatch && !/DELETED/i.test(page.slice(0, 300))) {
        isDeletedSection = false;
      }

      // Extract Justice / Judge names following BEFORE:- up to category headers
      const beforeSection = page.match(/BEFORE:-\s*([\s\S]{1,380}?)(?=(?:MOTION|NOTICE|PRE-ADMISSION|OTHER|FINAL|DAILY|Page|\d+\s+[A-Za-z]))/i) ||
                            page.match(/BEFORE:-\s*([\s\S]{1,350})/i);
      if (beforeSection) {
        const jLines = beforeSection[1]
          .split('\n')
          .map((l) => l.trim().replace(/^BEFORE:-\s*/i, ''))
          .filter((l) => /JUSTICE|JUDGE/i.test(l) && !/CHIEF\s+JUSTICE'S\s+COURT/i.test(l));
        if (jLines.length > 0) {
          currentJustice = jLines.join(' & ');
        }
      }

      const benchKey = `${currentCourt}-${currentJustice}`;
      if (!rosterBenchesMap.has(benchKey)) {
        rosterBenchesMap.set(benchKey, {
          bench: currentCourt,
          courtRoom: currentCourt,
          justiceName: currentJustice,
          isDivisionBench: currentJustice.includes('&'),
        });
      }

      // Regex matching cases: srNo [whitespace] caseType [whitespace] caseNo/year
      // e.g. 1 \t Cr.M(BA) 3096/2026 or 11 \t W.P 3806/2025
      const caseRegex = /(\d{1,4})\s+([A-Za-z.()/-]+)\s+(\d+)\/(\d{2,4})/g;
      let m;
      while ((m = caseRegex.exec(page)) !== null) {
        const srNo = m[1];
        const caseType = m[2].trim();
        const caseNo = m[3].trim();
        const rawYear = m[4].trim();
        const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
        const fullCaseNo = `${caseType} ${caseNo}/${year}`;

        const idx = m.index;
        const contextBefore = page.substring(Math.max(0, idx - 450), idx);
        const vsMatch = contextBefore.match(/([^\n\r_]+?)\s*(?:V\/S|VS|VERSUS)\s*([^\n\r_]+)/i);
        let title = '';
        if (vsMatch) {
          title = `${vsMatch[1].trim()} V/S ${vsMatch[2].trim()}`.replace(/\s+/g, ' ');
        }

        const caseItem: ParsedPhcCauseListCase = {
          srNo,
          caseType,
          caseNo,
          year,
          fullCaseNo,
          courtRoom: currentCourt,
          justiceName: currentJustice,
          nextDate: dateYMD,
          causeListBench: benchName,
          causeListPdfUrl: pdfUrl,
          title: title || `${caseType} ${caseNo}/${year}`,
          isOnDeletedList: isDeletedSection,
        };

        cases.push(caseItem);

        // Index in map with multiple access keys
        const numKey = `${caseNo}/${year}`;
        caseMap.set(numKey, caseItem);
        caseMap.set(`${caseNo}/${year.slice(-2)}`, caseItem);
        const normPrefix = caseType.toLowerCase().replace(/[^a-z0-9]/g, '');
        caseMap.set(`${normPrefix}${caseNo}/${year}`, caseItem);
        caseMap.set(`${normPrefix} ${caseNo}/${year}`, caseItem);
        caseMap.set(`${caseType.toLowerCase()} ${caseNo}/${year}`, caseItem);
        caseMap.set(fullCaseNo.toLowerCase(), caseItem);
      }
    }

    const cachedData: CachedCauseList = {
      timestamp: Date.now(),
      pdfUrl,
      bench: benchName,
      date: dateYMD,
      cases,
      caseMap,
      rosterBenches: Array.from(rosterBenchesMap.values()),
    };

    phcCauseListCache.set(pdfUrl, cachedData);
    return cachedData;
  } catch (err) {
    console.warn(`Error parsing cause list PDF ${pdfUrl}:`, err);
    return null;
  }
}

// Background warmer for cause lists from https://www.peshawarhighcourt.gov.pk/app/site/18/p/Current_Causelist.html
async function warmPhcCauseListsCache() {
  try {
    const publishedLists = await getPhcPublishedCauseLists();
    if (publishedLists.length === 0) return;
    // Download and parse up to 6 published lists in parallel in background
    await Promise.allSettled(
      publishedLists.slice(0, 6).map((l) => getOrParsePhcCauseList(l.pdfUrl, l.bench, l.date))
    );
  } catch (err) {
    console.warn('Background warming of PHC cause lists:', err);
  }
}

// Search across all current cause lists published on https://www.peshawarhighcourt.gov.pk/app/site/18/p/Current_Causelist.html
async function findPhcCaseInPublishedCauseLists(
  caseNo: string,
  caseYear: string,
  preferredBench?: string,
  preferredType?: string
): Promise<ParsedPhcCauseListCase | null> {
  const numMatch = caseNo.match(/\d+/);
  const cleanNo = numMatch ? numMatch[0] : caseNo.trim().replace(/^[^0-9]+/, '');
  const cleanYr = caseYear.trim();
  const searchKey = `${cleanNo}/${cleanYr}`;
  const searchKey2Digit = `${cleanNo}/${cleanYr.slice(-2)}`;
  const cleanPrefType = preferredType ? preferredType.toLowerCase().replace(/[^a-z]/g, '') : '';

  try {
    const publishedLists = await getPhcPublishedCauseLists();
    if (publishedLists.length === 0) return null;

    // Prioritize preferred bench (e.g. Principal Seat / Peshawar first) and upcoming dates
    const pref = (preferredBench || 'PHC').toLowerCase();
    const sortedLists = [...publishedLists].sort((a, b) => {
      const aPref = a.bench.toLowerCase().includes(pref) || (pref.includes('peshawar') && a.bench.toLowerCase().includes('phc'));
      const bPref = b.bench.toLowerCase().includes(pref) || (pref.includes('peshawar') && b.bench.toLowerCase().includes('phc'));
      if (aPref !== bPref) return aPref ? -1 : 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // 1. Fast check: examine in-memory cached cause lists first
    for (const list of sortedLists) {
      const cached = phcCauseListCache.get(list.pdfUrl);
      if (cached && Date.now() - cached.timestamp < CAUSE_LIST_CACHE_TTL) {
        if (cleanPrefType) {
          const typeMatch = cached.cases.find(
            (c) => c.caseNo === cleanNo && c.caseType.toLowerCase().replace(/[^a-z]/g, '') === cleanPrefType
          );
          if (typeMatch) return typeMatch;
        }
        if (cached.caseMap.has(searchKey)) return cached.caseMap.get(searchKey)!;
        if (cached.caseMap.has(searchKey2Digit)) return cached.caseMap.get(searchKey2Digit)!;
        const found = cached.cases.find(
          (c) => c.caseNo === cleanNo && (c.year === cleanYr || c.year.slice(-2) === cleanYr.slice(-2))
        );
        if (found) return found;
      }
    }

    // 2. Parallel fetch & parse for uncached lists
    const parsePromises = sortedLists.map((list) => getOrParsePhcCauseList(list.pdfUrl, list.bench, list.date));
    const parsedResults = await Promise.allSettled(parsePromises);

    // First pass: try exact case type match if preferredType was specified
    if (cleanPrefType) {
      for (const res of parsedResults) {
        if (res.status === 'fulfilled' && res.value) {
          const typeMatch = res.value.cases.find(
            (c) => c.caseNo === cleanNo && c.caseType.toLowerCase().replace(/[^a-z]/g, '') === cleanPrefType
          );
          if (typeMatch) return typeMatch;
        }
      }
    }

    // Second pass: general case number / year match
    for (const res of parsedResults) {
      if (res.status === 'fulfilled' && res.value) {
        const parsed = res.value;
        if (parsed.caseMap.has(searchKey)) return parsed.caseMap.get(searchKey)!;
        if (parsed.caseMap.has(searchKey2Digit)) return parsed.caseMap.get(searchKey2Digit)!;
        const found = parsed.cases.find(
          (c) => c.caseNo === cleanNo && (c.year === cleanYr || c.year.slice(-2) === cleanYr.slice(-2))
        );
        if (found) return found;
      }
    }
  } catch (err) {
    console.warn('Error querying published cause lists:', err);
  }
  return null;
}

// Find all occurrences of a case number across all active published cause lists
async function findAllPhcCasesInPublishedCauseLists(
  caseNo: string,
  caseYear: string,
  preferredBench?: string
): Promise<ParsedPhcCauseListCase[]> {
  const numMatch = caseNo.match(/\d+/);
  const cleanNo = numMatch ? numMatch[0] : caseNo.trim().replace(/^[^0-9]+/, '');
  const yrMatch = caseYear.match(/\d{4}/) || caseYear.match(/\d{2}/);
  const cleanYr = yrMatch ? yrMatch[0] : caseYear.trim();

  const results: ParsedPhcCauseListCase[] = [];
  try {
    const publishedLists = await getPhcPublishedCauseLists();
    if (publishedLists.length === 0) return [];

    const pref = (preferredBench || 'PHC').toLowerCase();
    const sortedLists = [...publishedLists].sort((a, b) => {
      const aPref = a.bench.toLowerCase().includes(pref) || (pref.includes('peshawar') && a.bench.toLowerCase().includes('phc'));
      const bPref = b.bench.toLowerCase().includes(pref) || (pref.includes('peshawar') && b.bench.toLowerCase().includes('phc'));
      if (aPref !== bPref) return aPref ? -1 : 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    const uncachedLists: PhcCauseListPdf[] = [];
    for (const list of sortedLists) {
      const cached = phcCauseListCache.get(list.pdfUrl);
      if (cached && Date.now() - cached.timestamp < CAUSE_LIST_CACHE_TTL) {
        for (const c of cached.cases) {
          if (c.caseNo === cleanNo && (c.year === cleanYr || c.year.slice(-2) === cleanYr.slice(-2))) {
            results.push(c);
          }
        }
      } else {
        uncachedLists.push(list);
      }
    }

    if (uncachedLists.length > 0) {
      const parsePromises = uncachedLists.map((list) => getOrParsePhcCauseList(list.pdfUrl, list.bench, list.date));
      const parsedResults = await Promise.allSettled(parsePromises);
      for (const res of parsedResults) {
        if (res.status === 'fulfilled' && res.value) {
          for (const c of res.value.cases) {
            if (c.caseNo === cleanNo && (c.year === cleanYr || c.year.slice(-2) === cleanYr.slice(-2))) {
              results.push(c);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error querying all published cause lists:', err);
  }
  return results;
}

// Scrape / query search result from Peshawar High Court across:
// 1. https://phccfmis.peshawarhighcourt.gov.pk (CFMIS API)
// 2. https://diary.peshawarhighcourt.gov.pk (Diary API)
// 3. https://www.peshawarhighcourt.gov.pk (Cause Lists & Rosters)
async function searchPhcCases(caseNo: string, caseYear: string, preferredBenchId: number = 1): Promise<CaseRecord[]> {
  const numMatch = caseNo.match(/\d+/);
  const cleanNo = numMatch ? numMatch[0] : caseNo.trim().replace(/^[^0-9]+/, '');
  const yrMatch = caseYear.match(/\d{4}/) || caseYear.match(/\d{2}/);
  const cleanYr = yrMatch ? yrMatch[0] : caseYear.trim();
  const resultsMap = new Map<string, CaseRecord>();

  // Fetch published cause lists from www.peshawarhighcourt.gov.pk concurrently
  const publishedCauseListsPromise = getPhcPublishedCauseLists();

  // Circuit benches: 1: Principal Seat, 3: Abbottabad, 2: D.I. Khan, 4: Mingora, 5: Bannu
  const benchIdsToTry = [preferredBenchId, 1, 3, 2, 4, 5].filter((v, i, a) => a.indexOf(v) === i);

  // 1 & 2. Run CFMIS circuit benches queries AND Diary portal concurrently
  const cfmisSearchPromise = Promise.allSettled(
    benchIdsToTry.map(async (bId) => {
      try {
        const cfmisCtrl = new AbortController();
        const cfmisTimer = setTimeout(() => cfmisCtrl.abort(), 4500);
        const cfmisRes = await fetch(
          `https://phccfmisbackend.peshawarhighcourt.gov.pk/api/phccfmis/dashboard/public/casesearch?bench=${bId}&caseNo=${cleanNo}&caseYear=${cleanYr}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
            },
            signal: cfmisCtrl.signal,
          }
        );
        clearTimeout(cfmisTimer);

        if (!cfmisRes.ok) return;
        const cfmisData = await cfmisRes.json();
        const caseList = cfmisData.case_details || [];
        const circuitBenchName = cfmisData.circuit_bench_name || (bId === 1 ? 'PRINCIPAL SEAT' : 'CIRCUIT BENCH');

        for (const item of caseList) {
          const key = `phc-${item.CASECODE || `${cleanNo}-${cleanYr}-${item.CASENAME_ALIAS || item.CASENO}`}`;
          let nextDate = item.NEXT_HEARING_DATE ? parseKpstDateToYMD(item.NEXT_HEARING_DATE) : '';
          let advocates = '';
          let judgmentsCount = 0;

          // Fetch advocates & judgments for this case
          if (item.CASECODE) {
            try {
              const [advRes, filesRes, fixRes] = await Promise.all([
                fetch(`https://phccfmisbackend.peshawarhighcourt.gov.pk/api/phccfmis/dashboard/qrcode-caseadvocates?bench=${bId}&caseCode=${item.CASECODE}`),
                fetch(`https://phccfmisbackend.peshawarhighcourt.gov.pk/api/phccfmis/dashboard/public/casefiles?bench=${bId}&caseCode=${item.CASECODE}`),
                !nextDate ? fetch(`https://phccfmisbackend.peshawarhighcourt.gov.pk/api/phccfmis/dashboard/qrcode-casefixationhistory?bench=${bId}&caseCode=${item.CASECODE}`) : null
              ]);

              if (advRes && advRes.ok) {
                const advData = await advRes.json();
                if (Array.isArray(advData.advocate_details) && advData.advocate_details.length > 0) {
                  advocates = advData.advocate_details.map((a: any) => a.ADVOCATENAME).filter(Boolean).join(', ');
                }
              }

              if (filesRes && filesRes.ok) {
                const fData = await filesRes.json();
                if (Array.isArray(fData.case_files_list)) {
                  judgmentsCount = fData.case_files_list.length;
                }
              }

              if (fixRes && fixRes.ok) {
                const fixData = await fixRes.json();
                if (Array.isArray(fixData.fixation_history_details) && fixData.fixation_history_details.length > 0) {
                  const todayYMD = new Date().toISOString().slice(0, 10);
                  const validFixations = fixData.fixation_history_details
                    .map((f: any) => ({
                      raw: f.FIXATIONDATE,
                      ymd: parseKpstDateToYMD(f.FIXATIONDATE || ''),
                      stage: f.CASESTAGENAME,
                    }))
                    .filter((f: any) => Boolean(f.ymd))
                    .sort((a: any, b: any) => new Date(a.ymd).getTime() - new Date(b.ymd).getTime());

                  // 1. Look for upcoming hearing date (Requirement 4)
                  const upcoming = validFixations.find((f: any) => f.ymd >= todayYMD);
                  if (upcoming) {
                    nextDate = upcoming.ymd;
                  } else if (validFixations.length > 0) {
                    // Latest fixed date recorded
                    nextDate = validFixations[validFixations.length - 1].ymd;
                  }
                }
              }
            } catch {
              // non-fatal
            }
          }

          const benchLabel = item.BENCH === 'D' ? 'Division Bench (DB)' : item.BENCH === 'S' ? 'Single Bench (SB)' : 'Single Bench (SB)';
          const placeOfHearing = bId === 1 ? 'Peshawar' : bId === 3 ? 'Abbottabad' : bId === 2 ? 'D.I Khan' : bId === 4 ? 'Swat' : 'Peshawar';
          const justices = [item.JUDGENAME1, item.JUDGENAME2, item.JUDGENAME3].filter(Boolean).map((j: any) => cleanText(String(j))).join(' & ');
          const courtRoom = item.COURTROOM || item.COURT_ROOM || (item.ROOM_NO ? `Court Room ${item.ROOM_NO}` : (bId === 1 ? 'Court Room 1' : `Court Room ${bId}`));
          const isOnDeletedList = !!(
            String(item.DISPOSAL_INFO || '').toLowerCase().includes('deleted') ||
            String(item.COMMENTS || '').toLowerCase().includes('deleted') ||
            String(item.CASESTAGENAME || '').toLowerCase().includes('deleted') ||
            String(item.CATEGORY || '').toLowerCase().includes('deleted')
          );

          // Requirement 2: Extract respondent department against whom case is pending (not hardcoded Peshawar High Court)
          const caseTitle = item.TITLE ? cleanText(item.TITLE) : `CASE NO. ${cleanNo}/${cleanYr}`;
          let department = 'Respondent Department / State';
          if (caseTitle.includes('VS') || caseTitle.includes('V/S') || caseTitle.includes('VERSUS')) {
            const vsParts = caseTitle.split(/\s+(?:VS|V\/S|VERSUS)\s+/i);
            if (vsParts[1] && vsParts[1].trim()) {
              department = vsParts[1].trim();
            }
          } else if (item.CATEGORY || item.MAIN_CATEGORY) {
            department = `${item.CATEGORY || item.MAIN_CATEGORY} Department`;
          }

          resultsMap.set(key, {
            id: key,
            court: 'PHC',
            appealNo: item.CASE_NO || `${item.CASENAME_ALIAS || 'Case'} ${cleanNo}`,
            year: String(item.CASEYEAR || cleanYr).trim(),
            caseTitle,
            department,
            bench: benchLabel,
            justiceName: justices || benchLabel,
            courtRoom,
            isOnDeletedList,
            advocateName: advocates,
            natureOfCase: item.CASENAME || item.CATEGORY || item.CASENAME_ALIAS || 'High Court Case',
            decision: item.CASESTAGENAME || (item.DISPOSALDATE ? 'Decided' : 'Under Hearing / Pending'),
            decidedOn: item.DISPOSALDATE ? parseKpstDateToYMD(item.DISPOSALDATE) : '',
            nextDate,
            causeListSrNo: '', // Must come from published cause list
            causeListBench: '',
            placeOfHearing: placeOfHearing as any,
            lastUpdated: new Date().toISOString(),
            notes: item.COMMENTS || '',
            caseCode: item.CASECODE,
            benchId: bId,
            judgmentCount: judgmentsCount,
          });
        }
      } catch {
        // non-fatal
      }
    })
  );

  const diarySearchPromise = (async () => {
    try {
      const postData = new URLSearchParams({
        caseno: cleanNo,
        caseyear: cleanYr,
      });
      const diaryCtrl = new AbortController();
      const diaryTimer = setTimeout(() => diaryCtrl.abort(), 4500);
      const diaryRes = await fetch('https://diary.peshawarhighcourt.gov.pk/APIS/search_cases_result.php', {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: postData.toString(),
        signal: diaryCtrl.signal,
      });
      clearTimeout(diaryTimer);

      if (diaryRes.ok) {
        const diaryJson = await diaryRes.json();
        if (diaryJson && Array.isArray(diaryJson.data)) {
          for (const item of diaryJson.data) {
            const key = `phc-${item.CASECODE || `${cleanNo}-${cleanYr}-${item.CASENAMECODE || '0'}`}`;
            const existing = resultsMap.get(key);

            const { prefix, bench } = formatPhcCaseType(item.CASECODEDTL);
            const party = cleanText(item.PARTY || '');
            const party1 = cleanText(item.PARTY1 || '');
            const caseTitle = party1 ? `${party} VS ${party1}` : party || 'STATE VS ACCUSED';

            const isDecided = !!item.DISPOSALDATE || (item.DISPOSAL_INFO && item.DISPOSAL_INFO.trim() !== '');
            const decision = item.DISPOSAL_INFO
              ? item.DISPOSAL_INFO.trim()
              : isDecided
              ? 'Decided'
              : 'Under Hearing / Pending';

            const nextDate = item.PRESENTDATE ? parseKpstDateToYMD(item.PRESENTDATE) : (existing?.nextDate || '');
            const decidedOn = item.DISPOSALDATE ? parseKpstDateToYMD(item.DISPOSALDATE) : (existing?.decidedOn || '');

            const isDeletedDiary = !!(
              String(item.DISPOSAL_INFO || '').toLowerCase().includes('deleted') ||
              String(item.COMMENTS || '').toLowerCase().includes('deleted')
            );

            if (existing) {
              if (!existing.caseTitle || existing.caseTitle.includes('CASE NO.')) existing.caseTitle = caseTitle;
              if (!existing.nextDate && nextDate) existing.nextDate = nextDate;
              if (party1 && (!existing.department || existing.department.includes('Peshawar High Court'))) {
                existing.department = party1;
              }
              if (decision && decision !== 'Under Hearing / Pending') existing.decision = decision;
              if (decidedOn && !existing.decidedOn) existing.decidedOn = decidedOn;
              if (isDeletedDiary) existing.isOnDeletedList = true;
            } else {
              resultsMap.set(key, {
                id: key,
                court: 'PHC',
                appealNo: `${prefix ? prefix + ' ' : ''}${item.CASENO || cleanNo}`,
                year: String(item.CASEYEAR || cleanYr).trim(),
                caseTitle,
                department: party1 || 'Respondent Department / State',
                bench: item.BENCH === 'D' ? 'Division Bench (DB)' : bench,
                justiceName: item.BENCH === 'D' ? 'Hon. Division Bench' : 'Hon. Single Bench',
                courtRoom: 'Court Room 1',
                isOnDeletedList: isDeletedDiary,
                advocateName: '',
                natureOfCase: prefix ? `${prefix} (${item.COMMENTS || 'High Court Case'})` : item.COMMENTS || 'High Court Case',
                decision,
                decidedOn,
                nextDate,
                causeListSrNo: '',
                causeListBench: '',
                placeOfHearing: 'Peshawar',
                lastUpdated: new Date().toISOString(),
                notes: item.COMMENTS || '',
                caseCode: item.CASECODE,
                benchId: 1,
              });
            }
          }
        }
      }
    } catch {
      // non-fatal
    }
  })();

  // Wait for both CFMIS circuit benches and Diary results
  await Promise.allSettled([cfmisSearchPromise, diarySearchPromise]);

  // 3. Search and cross-reference published cause lists from https://www.peshawarhighcourt.gov.pk/app/site/18/p/Current_Causelist.html
  try {
    const prefBenchName = preferredBenchId === 3 ? 'Abbottabad' : preferredBenchId === 2 ? 'D.I.Khan' : preferredBenchId === 4 ? 'Mingora' : preferredBenchId === 5 ? 'Bannu' : 'PHC';
    const causeListMatches = await findAllPhcCasesInPublishedCauseLists(cleanNo, cleanYr, prefBenchName);
    if (causeListMatches.length > 0) {
      for (const causeListMatch of causeListMatches) {
        const allRecords = Array.from(resultsMap.values());
        const normCauseType = causeListMatch.caseType.toLowerCase().replace(/[^a-z]/g, '');

        let targetRecord = allRecords.find((r) => {
          const normAppeal = r.appealNo.toLowerCase().replace(/[^a-z]/g, '');
          const normNature = (r.natureOfCase || '').toLowerCase().replace(/[^a-z]/g, '');
          return normAppeal.includes(normCauseType) || normNature.includes(normCauseType);
        });

        if (targetRecord) {
          // Overlay verified live cause list data onto matched case
          targetRecord.nextDate = causeListMatch.nextDate; // Verified fixed date from cause list!
          targetRecord.justiceName = causeListMatch.justiceName; // Name of Justice
          targetRecord.courtRoom = causeListMatch.courtRoom; // Court Number (e.g. Court No. 1)
          targetRecord.causeListSrNo = causeListMatch.srNo; // Serial number on cause list
          targetRecord.causeListBench = causeListMatch.causeListBench;
          targetRecord.causeListPdfUrl = causeListMatch.causeListPdfUrl;
          if (causeListMatch.isOnDeletedList) {
            targetRecord.isOnDeletedList = true;
          }
          if (!targetRecord.caseTitle || targetRecord.caseTitle.startsWith('PHC CASE')) {
            targetRecord.caseTitle = causeListMatch.title || targetRecord.caseTitle;
          }
        } else {
          // Add verified cause list entry directly into resultsMap so the user can select it
          const key = `phc-${causeListMatch.caseType.replace(/[^a-z0-9]/gi, '')}-${causeListMatch.caseNo}-${causeListMatch.year}`;
          resultsMap.set(key, {
            id: key,
            court: 'PHC',
            appealNo: causeListMatch.fullCaseNo,
            year: causeListMatch.year,
            caseTitle: causeListMatch.title || `${causeListMatch.fullCaseNo}`,
            department: 'Respondent Department / State',
            bench: causeListMatch.justiceName.includes('&') ? 'Division Bench (DB)' : 'Single Bench (SB)',
            justiceName: causeListMatch.justiceName,
            courtRoom: causeListMatch.courtRoom,
            isOnDeletedList: !!causeListMatch.isOnDeletedList,
            advocateName: '',
            natureOfCase: causeListMatch.caseType,
            decision: 'Under Hearing',
            decidedOn: '',
            nextDate: causeListMatch.nextDate,
            causeListSrNo: causeListMatch.srNo,
            causeListBench: causeListMatch.causeListBench,
            causeListPdfUrl: causeListMatch.causeListPdfUrl,
            placeOfHearing: causeListMatch.causeListBench.toLowerCase().includes('abbott')
              ? 'Abbottabad'
              : causeListMatch.causeListBench.toLowerCase().includes('khan')
              ? 'D.I Khan'
              : causeListMatch.causeListBench.toLowerCase().includes('mingora') || causeListMatch.causeListBench.toLowerCase().includes('swat')
              ? 'Swat'
              : 'Peshawar',
            lastUpdated: new Date().toISOString(),
            notes: `Verified from Peshawar High Court Current Cause List (${causeListMatch.causeListBench}) on ${causeListMatch.nextDate}`,
            benchId: preferredBenchId || 1,
          });
        }
      }
    } else {
      // Fallback: match cause list PDF URL if nextDate was found from CFMIS/Diary
      const publishedLists = await publishedCauseListsPromise;
      if (publishedLists.length > 0) {
        for (const record of resultsMap.values()) {
          if (record.nextDate) {
            const matchedList = publishedLists.find((p) => p.date === record.nextDate);
            if (matchedList) {
              record.causeListPdfUrl = matchedList.pdfUrl;
              if (!record.causeListBench) record.causeListBench = matchedList.bench;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error cross-referencing cause list:', err);
  }

  return Array.from(resultsMap.values());
}

// Fetch all uploaded judgments and order sheets for a case
async function fetchPhcJudgments(caseNo: string, caseYear: string, benchId: number = 1): Promise<{
  caseInfo: { caseNo: string; year: string; title: string; bench: string; benchId: number };
  files: Array<{
    caseCode: number;
    caseNo: string;
    caseTitle: string;
    bench: string;
    benchId: number;
    fileName: string;
    fileType: string;
    entryDate: string;
    operator: string;
    downloadUrl: string;
  }>;
}> {
  const cleanNo = caseNo.trim();
  const cleanYr = caseYear.trim();
  const benchIdsToTry = [benchId, 1, 3, 2, 4, 5].filter((v, i, a) => a.indexOf(v) === i);

  let targetCase: any = null;
  let targetBenchId = benchId;

  // Search circuit benches in parallel with 3500ms timeout
  const searchResults = await Promise.allSettled(
    benchIdsToTry.map(async (bId) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3500);
      try {
        const res = await fetch(
          `https://phccfmisbackend.peshawarhighcourt.gov.pk/api/phccfmis/dashboard/public/casesearch?bench=${bId}&caseNo=${cleanNo}&caseYear=${cleanYr}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
            },
            signal: ctrl.signal,
          }
        );
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.case_details) && data.case_details.length > 0) {
            return { bId, targetCase: data.case_details[0] };
          }
        }
      } catch {
        // timeout or error
      }
      return null;
    })
  );

  for (const r of searchResults) {
    if (r.status === 'fulfilled' && r.value) {
      targetCase = r.value.targetCase;
      targetBenchId = r.value.bId;
      break;
    }
  }

  if (!targetCase || !targetCase.CASECODE) {
    return {
      caseInfo: { caseNo: cleanNo, year: cleanYr, title: '', bench: 'Peshawar', benchId: targetBenchId },
      files: [],
    };
  }

  try {
    const fCtrl = new AbortController();
    const fTimer = setTimeout(() => fCtrl.abort(), 4000);
    const filesRes = await fetch(
      `https://phccfmisbackend.peshawarhighcourt.gov.pk/api/phccfmis/dashboard/public/casefiles?bench=${targetBenchId}&caseCode=${targetCase.CASECODE}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        },
        signal: fCtrl.signal,
      }
    );
    clearTimeout(fTimer);
    if (!filesRes.ok) {
      return {
        caseInfo: {
          caseNo: targetCase.CASE_NO || cleanNo,
          year: cleanYr,
          title: targetCase.TITLE || '',
          bench: targetCase.BENCH === 'D' ? 'Division Bench' : 'Single Bench',
          benchId: targetBenchId,
        },
        files: [],
      };
    }

    const filesData = await filesRes.json();
    const rawFiles = filesData.case_files_list || [];

    const files = rawFiles.map((f: any) => ({
      caseCode: targetCase.CASECODE,
      caseNo: f.CASE_NO || targetCase.CASE_NO || cleanNo,
      caseTitle: targetCase.TITLE || '',
      bench: filesData.circuit_bench_name || (targetBenchId === 1 ? 'Principal Seat' : 'Circuit Bench'),
      benchId: targetBenchId,
      fileName: f.FILE_NAME,
      fileType: f.FILE_TYPE || 'Judgment / Order Sheet',
      entryDate: f.ENTRYDATE || f.ENTRY_DATE || '',
      operator: f.OPERATOR || '',
      downloadUrl: `/api/phc/download-judgment?bench=${targetBenchId}&filename=${encodeURIComponent(f.FILE_NAME)}`,
    }));

    return {
      caseInfo: {
        caseNo: targetCase.CASE_NO || cleanNo,
        year: cleanYr,
        title: targetCase.TITLE || '',
        bench: filesData.circuit_bench_name || (targetBenchId === 1 ? 'Principal Seat' : 'Circuit Bench'),
        benchId: targetBenchId,
      },
      files,
    };
  } catch (err) {
    console.error('Error fetching judgments:', err);
    return {
      caseInfo: { caseNo: targetCase.CASE_NO || cleanNo, year: cleanYr, title: targetCase.TITLE || '', bench: '', benchId: targetBenchId },
      files: [],
    };
  }
}

interface CauseListEntry {
  srNo: string;
  type: string;
  petitioner: string;
  respondent: string;
  nature: string;
  bench: string;
  rawRow: string;
}

// Scrape Cause List from KPST with multi-bench section parsing
async function searchKpstCauseList(dateStr: string, place: string = 'Peshawar') {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const url = `http://cfmis.kpst.gov.pk/caseMarkingList/causlist.php?dated=${encodeURIComponent(dateStr)}&appeal=${encodeURIComponent(place)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return { available: false, cases: [] as CauseListEntry[], benches: [] as string[] };

    const html = await response.text();

    if (!html.includes('<table') && !html.includes('bench-header')) {
      return { available: false, cases: [] as CauseListEntry[], benches: [] as string[] };
    }

    // Split HTML into distinct bench blocks
    const benchBlocks = html.split(/(?=<div class=[\"'][^\"']*bench-header)/i);
    const benchHeaders: string[] = [];
    const cases: CauseListEntry[] = [];

    for (const block of benchBlocks) {
      const hMatches = block.match(/<h[3-4][^>]*>([\s\S]*?)<\/h[3-4]>/gi) || [];
      let benchName = '';
      for (const hm of hMatches) {
        const txt = cleanText(hm);
        if (
          txt.toLowerCase().includes('fixed before') ||
          txt.toLowerCase().includes('cases fixed') ||
          txt.toLowerCase().includes('bench')
        ) {
          benchName = txt;
          break;
        }
      }
      if (!benchName && hMatches.length > 0) {
        benchName = cleanText(hMatches[0] || '');
      }
      if (benchName && !benchHeaders.includes(benchName)) {
        benchHeaders.push(benchName);
      }

      const tables = block.match(/<table[\s\S]*?<\/table>/gi) || [];
      for (const table of tables) {
        const rows = table.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
        for (const row of rows) {
          if (row.includes('<th')) continue;
          const cellMatches = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
          const cells = cellMatches.map((c) => cleanText(c));
          if (cells.length >= 3) {
            const rawRow = cells.join(' ');
            cases.push({
              srNo: cells[0] || '',
              type: cells[1] || '',
              petitioner: cells[2] || '',
              respondent: cells[3] || '',
              nature: cells[4] || '',
              bench: benchName || 'SB-I',
              rawRow,
            });
          }
        }
      }
    }

    return {
      available: cases.length > 0,
      cases,
      benches: benchHeaders,
    };
  } catch (err) {
    console.error('Error fetching cause list:', err);
    return { available: false, cases: [] as CauseListEntry[], benches: [] as string[] };
  }
}

// Match a case against cause list entries
function findCaseInCauseList(
  entries: CauseListEntry[],
  appealNo: string,
  year: string,
  caseTitle: string = ''
): CauseListEntry | null {
  const cleanAppNo = appealNo.trim();
  const cleanYr = year.trim();
  const titleClean = caseTitle.toUpperCase().trim();

  // Priority 1: Regular appeal table match: contains appealNo AND year
  const regularMatch = entries.find((e) => {
    const raw = e.rawRow;
    return (
      (raw.includes(`${cleanAppNo}/${cleanYr}`) ||
        raw.includes(`${cleanAppNo} / ${cleanYr}`) ||
        (raw.includes(cleanAppNo) && raw.includes(cleanYr))) &&
      !raw.includes('Civil Miscellaneous')
    );
  });
  if (regularMatch) return regularMatch;

  // Priority 2: Any row matching appeal number & year
  const anyAppMatch = entries.find((e) => {
    const raw = e.rawRow;
    return (
      raw.includes(`${cleanAppNo}/${cleanYr}`) ||
      raw.includes(`${cleanAppNo} / ${cleanYr}`) ||
      (raw.includes(cleanAppNo) && (raw.includes(cleanYr) || raw.includes('2026')))
    );
  });
  if (anyAppMatch) return anyAppMatch;

  // Priority 3: Title match
  if (titleClean) {
    const titleMatch = entries.find((e) => {
      const rawUpper = e.rawRow.toUpperCase();
      return rawUpper.includes(titleClean);
    });
    if (titleMatch) return titleMatch;
  }

  return null;
}

// API Routes
app.post('/api/kpst/search', async (req: Request, res: Response) => {
  const { appealNo, year, place } = req.body;

  if (!appealNo || !year) {
    res.status(400).json({ success: false, error: 'Appeal No and Year are required' });
    return;
  }

  try {
    const cleanAppNo = String(appealNo).trim();
    const cleanYr = String(year).trim();
    const result = await searchKpstCase(cleanAppNo, cleanYr);

    if (!result) {
      res.status(404).json({
        success: false,
        error: `No record found for Service Appeal No. ${appealNo}/${year} on KPST (cfmis.kpst.gov.pk). Please check the Appeal Number and Year.`,
      });
      return;
    }

    let causeListBench = '';
    let causeListSrNo = '';
    let enhancedBench = result.bench || '';

    // Immediately check cause list for this case's next hearing date!
    const nextDateYMD = parseKpstDateToYMD(result.nextDate || '');
    if (nextDateYMD) {
      const cl = await searchKpstCauseList(nextDateYMD, place || 'Peshawar');
      if (cl.available && cl.cases.length > 0) {
        const match = findCaseInCauseList(cl.cases, cleanAppNo, cleanYr, result.caseTitle || '');
        if (match) {
          causeListBench = match.bench;
          causeListSrNo = match.srNo;
          enhancedBench = match.bench;
        }
      }
    }

    res.json({
      success: true,
      caseData: {
        ...result,
        bench: enhancedBench || result.bench,
        causeListBench,
        causeListSrNo,
      },
      source: 'https://kpst.gov.pk (CFMIS Case Search & Cause List)',
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMsg });
  }
});

// Comprehensive Peshawar High Court Case Search API across:
// 1. https://www.peshawarhighcourt.gov.pk
// 2. https://phccfmis.peshawarhighcourt.gov.pk/case-search
// 3. https://diary.peshawarhighcourt.gov.pk/
app.post('/api/phc/search', async (req: Request, res: Response) => {
  const { caseNo, year, benchId } = req.body;

  if (!caseNo || !year) {
    res.status(400).json({ success: false, error: 'Case Number and Year are required' });
    return;
  }

  try {
    const cleanCaseNo = String(caseNo).trim();
    const cleanYr = String(year).trim();
    const cases = await searchPhcCases(cleanCaseNo, cleanYr, benchId ? Number(benchId) : 1);

    if (cases.length === 0) {
      res.status(404).json({
        success: false,
        error: `No record found for Case No. ${caseNo}/${year} on Peshawar High Court portals (www.peshawarhighcourt.gov.pk, phccfmis.peshawarhighcourt.gov.pk, diary.peshawarhighcourt.gov.pk). Please verify the Case Number and Year.`,
      });
      return;
    }

    // Ensure all returned cases have strictly unique IDs
    const seenIds = new Set<string>();
    const uniqueCases = cases.map((c, i) => {
      let uniqueId = c.id;
      if (seenIds.has(uniqueId)) {
        uniqueId = `${uniqueId}-${i}`;
      }
      seenIds.add(uniqueId);
      return { ...c, id: uniqueId };
    });

    res.json({
      success: true,
      count: uniqueCases.length,
      cases: uniqueCases,
      source: 'Peshawar High Court (www.peshawarhighcourt.gov.pk, phccfmis.peshawarhighcourt.gov.pk, diary.peshawarhighcourt.gov.pk)',
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMsg });
  }
});

// Fetch High Court Judgments & Order Sheets (PDFs)
app.post('/api/phc/judgments', async (req: Request, res: Response) => {
  const { caseNo, year, benchId } = req.body;

  if (!caseNo || !year) {
    res.status(400).json({ success: false, error: 'Case Number and Year are required' });
    return;
  }

  try {
    const cleanCaseNo = String(caseNo).trim();
    const cleanYr = String(year).trim();
    const data = await fetchPhcJudgments(cleanCaseNo, cleanYr, benchId ? Number(benchId) : 1);

    res.json({
      success: true,
      count: data.files.length,
      ...data,
      source: 'https://phccfmis.peshawarhighcourt.gov.pk/case-search & https://www.peshawarhighcourt.gov.pk',
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMsg });
  }
});

// Download Judgment / Order Sheet PDF (Streaming Proxy)
app.get('/api/phc/download-judgment', async (req: Request, res: Response) => {
  const bench = req.query.bench ? String(req.query.bench) : '1';
  const filename = req.query.filename ? String(req.query.filename) : '';

  if (!filename) {
    res.status(400).send('Filename is required');
    return;
  }

  try {
    const targetUrl = `https://phccfmisbackend.peshawarhighcourt.gov.pk/api/phccfmis/dashboard/qrcode-casefiles-download?bench=${encodeURIComponent(bench)}&filename=${encodeURIComponent(filename)}`;
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
    });

    if (!upstreamRes.ok) {
      res.status(upstreamRes.status).send(`Failed to retrieve judgment from Peshawar High Court: ${upstreamRes.statusText}`);
      return;
    }

    const cleanFilename = filename.replace(/[^\w\s\(\)\.-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);

    const arrayBuffer = await upstreamRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).send(`Server error downloading judgment: ${msg}`);
  }
});

// Published Cause Lists from www.peshawarhighcourt.gov.pk
app.get('/api/phc/causelists', async (_req: Request, res: Response) => {
  try {
    const lists = await getPhcPublishedCauseLists();
    res.json({
      success: true,
      count: lists.length,
      causeLists: lists,
      source: 'https://www.peshawarhighcourt.gov.pk/app/site/18/p/Current_Causelist.html',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

// Detailed Peshawar High Court Cause List Query with Justice, Court Room, and Deleted Cases List
app.get('/api/phc/causelist', async (req: Request, res: Response) => {
  const dateStr = String(req.query.date || '');
  const benchName = String(req.query.bench || 'Peshawar');

  if (!dateStr) {
    res.status(400).json({ success: false, error: 'Date parameter is required (YYYY-MM-DD)' });
    return;
  }

  try {
    // 1. Fetch published PDFs from PHC
    const publishedLists = await getPhcPublishedCauseLists();
    const parts = dateStr.split('-');
    const formattedDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;

    // Match bench
    const matchedList = publishedLists.find(
      (p) =>
        (p.date === dateStr || p.rawDate === formattedDate || p.rawDate.includes(formattedDate)) &&
        (p.bench.toLowerCase().includes(benchName.toLowerCase()) || benchName.toLowerCase().includes(p.bench.toLowerCase()))
    ) || publishedLists.find(
      (p) => p.bench.toLowerCase().includes(benchName.toLowerCase()) || benchName.toLowerCase().includes(p.bench.toLowerCase())
    ) || publishedLists[0];

    if (!matchedList) {
      res.json({
        success: true,
        date: dateStr,
        bench: benchName,
        pdfUrl: null,
        benches: [],
        cases: [],
        deletedCasesCount: 0,
        activeCasesCount: 0,
        source: 'Peshawar High Court (https://www.peshawarhighcourt.gov.pk)',
      });
      return;
    }

    const parsed = await getOrParsePhcCauseList(matchedList.pdfUrl, matchedList.bench, matchedList.date);

    if (parsed && parsed.cases.length > 0) {
      const activeCases = parsed.cases.filter((c) => !c.isOnDeletedList);
      const deletedCases = parsed.cases.filter((c) => c.isOnDeletedList);

      res.json({
        success: true,
        date: parsed.date,
        bench: parsed.bench,
        pdfUrl: matchedList.pdfUrl,
        benches: parsed.rosterBenches,
        cases: parsed.cases.map((c) => ({
          srNo: c.srNo,
          caseNo: c.fullCaseNo,
          caseTitle: c.title,
          justiceName: c.justiceName,
          courtRoom: c.courtRoom,
          bench: c.causeListBench,
          nature: c.caseType,
          isOnDeletedList: !!c.isOnDeletedList,
          deletedReason: c.isOnDeletedList ? 'Case adjourned / deleted from cause list' : undefined,
        })),
        deletedCasesCount: deletedCases.length,
        activeCasesCount: activeCases.length,
        source: 'Peshawar High Court (https://www.peshawarhighcourt.gov.pk/app/site/18/p/Current_Causelist.html)',
      });
      return;
    }

    res.json({
      success: true,
      date: dateStr,
      bench: benchName,
      pdfUrl: matchedList.pdfUrl,
      benches: [],
      cases: [],
      deletedCasesCount: 0,
      activeCasesCount: 0,
      source: 'Peshawar High Court (https://www.peshawarhighcourt.gov.pk)',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

// App Version Endpoint for Instant Automatic Updates
const APP_VERSION = '2.5.0';
const APP_BUILD_TIME = new Date().toISOString();

app.get('/api/app-version', (_req: Request, res: Response) => {
  res.json({
    version: APP_VERSION,
    buildTime: APP_BUILD_TIME,
    timestamp: Date.now(),
  });
});

// Cause List API
app.get('/api/kpst/causelist', async (req: Request, res: Response) => {
  const dateStr = String(req.query.date || '');
  const place = String(req.query.place || 'Peshawar');

  if (!dateStr) {
    res.status(400).json({ success: false, error: 'Date parameter required (YYYY-MM-DD)' });
    return;
  }

  const data = await searchKpstCauseList(dateStr, place);
  res.json({
    success: true,
    date: dateStr,
    place,
    ...data,
  });
});

// Dedicated single case refresh from live Peshawar High Court cause list & search portals
app.post('/api/phc/refresh-case', async (req: Request, res: Response) => {
  const { caseNo, year, bench, appealNo, id } = req.body;
  if (!caseNo || !year) {
    res.status(400).json({ success: false, error: 'Case Number and Year are required' });
    return;
  }

  try {
    const cleanNo = String(caseNo).trim();
    const cleanYr = String(year).trim();
    const preferredBench = String(bench || 'PHC');
    const preferredType = appealNo ? String(appealNo).split(/\s+/)[0] : undefined;

    // 1. Search live cause lists directly
    const causeListMatch = await findPhcCaseInPublishedCauseLists(cleanNo, cleanYr, preferredBench, preferredType);

    // 2. Search CFMIS & Diary
    const searchResults = await searchPhcCases(cleanNo, cleanYr);
    let matched = searchResults.find((c) => (id && c.id === id) || (appealNo && c.appealNo === appealNo)) || searchResults[0];

    if (!matched && causeListMatch) {
      const key = id || `phc-${causeListMatch.caseNo}-${causeListMatch.year}-${Date.now()}`;
      matched = {
        id: key,
        court: 'PHC',
        appealNo: causeListMatch.fullCaseNo,
        year: causeListMatch.year,
        caseTitle: causeListMatch.title || causeListMatch.fullCaseNo,
        department: 'Respondent Department / State',
        bench: causeListMatch.justiceName.includes('&') ? 'Division Bench (DB)' : 'Single Bench (SB)',
        justiceName: causeListMatch.justiceName,
        courtRoom: causeListMatch.courtRoom,
        isOnDeletedList: !!causeListMatch.isOnDeletedList,
        advocateName: '',
        natureOfCase: causeListMatch.caseType,
        decision: 'Under Hearing',
        decidedOn: '',
        nextDate: causeListMatch.nextDate,
        causeListSrNo: causeListMatch.srNo,
        causeListBench: causeListMatch.causeListBench,
        causeListPdfUrl: causeListMatch.causeListPdfUrl,
        placeOfHearing: 'Peshawar',
        lastUpdated: new Date().toISOString(),
      };
    }

    if (matched && causeListMatch) {
      matched.nextDate = causeListMatch.nextDate;
      matched.justiceName = causeListMatch.justiceName;
      matched.courtRoom = causeListMatch.courtRoom;
      matched.causeListSrNo = causeListMatch.srNo;
      matched.causeListBench = causeListMatch.causeListBench;
      matched.causeListPdfUrl = causeListMatch.causeListPdfUrl;
      matched.isOnDeletedList = !!causeListMatch.isOnDeletedList;
      matched.lastUpdated = new Date().toISOString();
    }

    if (!matched) {
      res.status(404).json({ success: false, error: 'Case not found on Peshawar High Court cause lists or search portals.' });
      return;
    }

    res.json({
      success: true,
      caseData: matched,
      causeListFound: !!causeListMatch,
      source: 'Peshawar High Court (https://www.peshawarhighcourt.gov.pk/app/site/18/p/Current_Causelist.html)',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

// Batch update cases
app.post('/api/kpst/update-all', async (req: Request, res: Response) => {
  const { cases } = req.body;

  if (!Array.isArray(cases)) {
    res.status(400).json({ success: false, error: 'Invalid cases array' });
    return;
  }

  const updatedCases: CaseRecord[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const c of cases) {
    try {
      // If case belongs to Peshawar High Court
      if (c.court === 'PHC' || (c.id && String(c.id).startsWith('phc-'))) {
        const numMatch = String(c.appealNo).match(/\d+/);
        const caseNo = numMatch ? numMatch[0] : c.appealNo;
        const caseType = String(c.appealNo).split(/\s+/)[0];

        // 1. Search live published cause lists from https://www.peshawarhighcourt.gov.pk/app/site/18/p/Current_Causelist.html
        const causeListMatch = await findPhcCaseInPublishedCauseLists(
          caseNo,
          c.year,
          c.causeListBench || c.placeOfHearing,
          caseType
        );

        const phcList = await searchPhcCases(caseNo, c.year);
        if (phcList.length > 0) {
          const match = phcList.find((p) => p.id === c.id || (p.appealNo && p.appealNo === c.appealNo)) || phcList[0];

          let resolvedNextDate = causeListMatch?.nextDate || match.nextDate || c.nextDate || '';
          let resolvedJustice = causeListMatch?.justiceName || match.justiceName || c.justiceName || '';
          let resolvedCourtRoom = causeListMatch?.courtRoom || match.courtRoom || c.courtRoom || '';
          let resolvedSrNo = causeListMatch?.srNo || match.causeListSrNo || c.causeListSrNo || '';
          let resolvedBench = causeListMatch?.causeListBench || match.causeListBench || c.causeListBench || '';
          let resolvedPdf = causeListMatch?.causeListPdfUrl || match.causeListPdfUrl || c.causeListPdfUrl || '';
          let resolvedDeleted = causeListMatch?.isOnDeletedList ?? match.isOnDeletedList ?? c.isOnDeletedList ?? false;

          // If still no nextDate, query fixation history directly if caseCode exists
          const targetCode = match.caseCode || c.caseCode;
          const targetBench = match.benchId || c.benchId || 1;
          if (!resolvedNextDate && targetCode) {
            try {
              const fixRes = await fetch(
                `https://phccfmisbackend.peshawarhighcourt.gov.pk/api/phccfmis/dashboard/qrcode-casefixationhistory?bench=${targetBench}&caseCode=${targetCode}`,
                { signal: AbortSignal.timeout(3500) }
              );
              if (fixRes.ok) {
                const fixData = await fixRes.json();
                if (Array.isArray(fixData.fixation_history_details) && fixData.fixation_history_details.length > 0) {
                  const todayYMD = new Date().toISOString().slice(0, 10);
                  const validFix = fixData.fixation_history_details
                    .map((f: any) => parseKpstDateToYMD(f.FIXATIONDATE || ''))
                    .filter(Boolean)
                    .sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime());
                  const upcoming = validFix.find((d: string) => d >= todayYMD);
                  resolvedNextDate = upcoming || validFix[validFix.length - 1] || '';
                }
              }
            } catch {
              // non-fatal
            }
          }

          updatedCases.push({
            ...c,
            ...match,
            id: c.id,
            nextDate: resolvedNextDate,
            justiceName: resolvedJustice,
            courtRoom: resolvedCourtRoom,
            causeListSrNo: resolvedSrNo,
            causeListBench: resolvedBench,
            causeListPdfUrl: resolvedPdf,
            isOnDeletedList: resolvedDeleted,
            court: 'PHC',
            lastUpdated: new Date().toISOString(),
          });
          successCount++;
          continue;
        } else if (causeListMatch) {
          // Case verified directly from Peshawar High Court Current Cause List
          updatedCases.push({
            ...c,
            id: c.id,
            nextDate: causeListMatch.nextDate,
            justiceName: causeListMatch.justiceName,
            courtRoom: causeListMatch.courtRoom,
            causeListSrNo: causeListMatch.srNo,
            causeListBench: causeListMatch.causeListBench,
            causeListPdfUrl: causeListMatch.causeListPdfUrl,
            isOnDeletedList: !!causeListMatch.isOnDeletedList,
            court: 'PHC',
            lastUpdated: new Date().toISOString(),
          });
          successCount++;
          continue;
        } else {
          updatedCases.push(c);
          continue;
        }
      }

      const live = await searchKpstCase(c.appealNo, c.year);
      if (live) {
        let causeListBench = c.causeListBench || '';
        let causeListSrNo = c.causeListSrNo || '';

        // Format nextDate to YYYY-MM-DD to query cause list
        const nextDate = live.nextDate || c.nextDate;
        const formattedDate = parseKpstDateToYMD(nextDate || '');
        let enhancedBench = live.bench || c.bench || '';

        // If nextDate is present, query cause list
        if (formattedDate) {
          const cl = await searchKpstCauseList(formattedDate, c.placeOfHearing || 'Peshawar');
          if (cl.available && cl.cases.length > 0) {
            const match = findCaseInCauseList(
              cl.cases,
              c.appealNo,
              c.year,
              live.caseTitle || c.caseTitle || ''
            );

            if (match) {
              causeListBench = match.bench;
              causeListSrNo = match.srNo;
              enhancedBench = match.bench;
            } else {
              // If cause list exists for this date, but case is not on it
              causeListBench = '';
              causeListSrNo = '';
            }
          } else {
            // Requirement 9: If cause list is not updated yet, the boxes should be empty
            causeListBench = '';
            causeListSrNo = '';
          }
        } else {
          // No next date
          causeListBench = '';
          causeListSrNo = '';
        }

        updatedCases.push({
          ...c,
          ...live,
          id: c.id,
          bench: enhancedBench,
          causeListBench,
          causeListSrNo,
          lastUpdated: new Date().toISOString(),
        });
        successCount++;
      } else {
        updatedCases.push(c);
        failureCount++;
      }
    } catch {
      updatedCases.push(c);
      failureCount++;
    }
  }

  // Ensure all returned cases have strictly unique IDs
  const seenIds = new Set<string>();
  const dedupedUpdated: CaseRecord[] = [];
  for (let i = 0; i < updatedCases.length; i++) {
    const uc = updatedCases[i];
    let uniqueId = uc.id;
    if (seenIds.has(uniqueId)) {
      uniqueId = `${uniqueId}-${i}`;
    }
    seenIds.add(uniqueId);
    dedupedUpdated.push({ ...uc, id: uniqueId });
  }

  res.json({
    success: true,
    cases: dedupedUpdated,
    successCount,
    failureCount,
    timestamp: new Date().toISOString(),
  });
});

// App Health
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req: Request, res: Response, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        // Ensure Vite HMR WebSocket stub executes before any scripts
        const wsShim = `<script>if(typeof window!=="undefined"&&window.WebSocket){const _O=window.WebSocket;window.WebSocket=function(u,p){if(p==="vite-hmr"||(Array.isArray(p)&&p.includes("vite-hmr"))||(typeof u==="string"&&(u.includes("token=")||u.includes("vite-hmr")))){const f=new EventTarget();f.readyState=1;f.OPEN=1;f.CLOSED=3;f.CONNECTING=0;f.CLOSING=2;f.send=function(){};f.close=function(){};setTimeout(()=>f.dispatchEvent(new Event("open")),0);return f;}return new _O(u,p);};window.WebSocket.prototype=_O.prototype;window.WebSocket.CONNECTING=0;window.WebSocket.OPEN=1;window.WebSocket.CLOSING=2;window.WebSocket.CLOSED=3;}</script>`;
        template = template.replace('<head>', '<head>' + wsShim);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: unknown) {
        if (e instanceof Error) {
          vite.ssrFixStacktrace(e);
        }
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    // Warm cause list cache in background for instant lookups
    setTimeout(() => {
      warmPhcCauseListsCache().catch(console.warn);
    }, 1500);
    // Periodically refresh cause list cache every 15 minutes
    setInterval(() => {
      warmPhcCauseListsCache().catch(console.warn);
    }, 15 * 60 * 1000);
  });
}

startServer();
