import { CourtCase, UserProfile } from '../types';
import { formatDisplayDate } from './dateUtils';
import ExcelJS from 'exceljs';

export async function buildDocketExcelWorkbook(
  cases: CourtCase[],
  profile: UserProfile,
  userEmail?: string
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `${profile.honorific} ${profile.name}`;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Cases Docket', {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 5,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  sheet.addRow([`LITIGATION ASSISTANT - COURT CASES DOCKET`]);
  sheet.addRow([`Advocate / User: ${profile.honorific} ${profile.name} | District: ${profile.district}${userEmail ? ` | Email: ${userEmail}` : ''}`]);
  sheet.addRow([`Export Date: ${new Date().toLocaleDateString('en-GB')} | Total Cases: ${cases.length}`]);
  sheet.addRow([]);

  const headerRow = sheet.addRow([
    '#',
    'Court',
    'Case / Appeal No.',
    'Year',
    'Case Title',
    'Department / State',
    'Bench / Justice',
    'Court Room',
    'Cause List Sr. #',
    'Status / Deleted',
    'Next Date (Fixed On)',
    'Advocate Name',
    'Decision / Stage',
  ]);

  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF064E3B' },
  };

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  cases.forEach((c, idx) => {
    const isPhc = c.court === 'PHC' || c.id.startsWith('phc-');
    const d = c.nextDate ? new Date(c.nextDate) : null;
    const isUpcoming = d && !isNaN(d.getTime()) && d.getTime() >= now.getTime();
    const fixedOn = c.nextDate && isUpcoming ? formatDisplayDate(c.nextDate) : 'No date fixed';

    const row = sheet.addRow([
      idx + 1,
      isPhc ? 'PHC' : 'KPST',
      c.appealNo,
      c.year,
      c.caseTitle || '-',
      c.department || '-',
      isPhc ? (c.justiceName || '(-)') : (c.causeListBench || c.bench || '(-)'),
      c.courtRoom || (isPhc ? 'Court Room 1' : '-'),
      c.causeListSrNo || '-',
      c.isOnDeletedList ? 'DELETED' : (c.causeListSrNo ? 'On Roster' : 'Regular'),
      fixedOn,
      c.advocateName || '-',
      c.decision || 'Under Process',
    ]);

    if (c.isOnDeletedList) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFE4E6' },
      };
    }
  });

  sheet.columns.forEach((col) => {
    col.width = 18;
  });
  if (sheet.columns[0]) sheet.columns[0].width = 6;
  if (sheet.columns[4]) sheet.columns[4].width = 32;
  if (sheet.columns[5]) sheet.columns[5].width = 24;

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

/**
 * Requirement 10: Download Cases in Excel format (.csv compatible with Excel)
 */
export function exportToExcel(cases: CourtCase[], profile?: UserProfile) {
  const headers = [
    'Sr. #',
    'Court / Forum',
    'Case / Appeal No',
    'Year',
    'Case Title',
    'Department / Jurisdiction',
    'Bench',
    'Advocate Name',
    'Nature of Case',
    'Decision',
    'Decided On',
    'Next Date (Fixed On)',
    'Court Room',
    'Bench / Justice',
    'Cause List Sr. No',
    'Deleted List?',
    'Place of Hearing',
    'Last Synchronized',
  ];

  const escapeCell = (val: string | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const rows = cases.map((c, index) => {
    const isPhc = c.court === 'PHC' || c.id.startsWith('phc-');
    const d = c.nextDate ? new Date(c.nextDate) : null;
    const isUpcoming = d && !isNaN(d.getTime()) && d.getTime() >= now.getTime();
    const dateDisplay = c.nextDate && isUpcoming ? formatDisplayDate(c.nextDate) : 'No date fixed';

    let benchDisplay = '-';
    if (isPhc) {
      benchDisplay = c.justiceName && c.justiceName !== '(-)' ? c.justiceName : '(-)';
    } else {
      benchDisplay = c.causeListBench || c.bench || '(-)';
    }

    return [
      index + 1,
      escapeCell(isPhc ? 'Peshawar High Court (PHC)' : 'KP Service Tribunal (KPST)'),
      escapeCell(c.appealNo),
      escapeCell(c.year),
      escapeCell(c.caseTitle),
      escapeCell(c.department),
      escapeCell(c.advocateName),
      escapeCell(c.natureOfCase),
      escapeCell(c.decision),
      escapeCell(c.decidedOn || '-'),
      escapeCell(dateDisplay),
      escapeCell(c.courtRoom || '-'),
      escapeCell(benchDisplay),
      escapeCell(c.causeListSrNo ? `Sr. #${c.causeListSrNo}` : '-'),
      escapeCell(c.isOnDeletedList ? 'YES (DELETED LIST)' : 'NO'),
      escapeCell(c.placeOfHearing || 'Peshawar'),
      escapeCell(new Date(c.lastUpdated).toLocaleString()),
    ];
  });

  // Include user header info
  let csvContent = '\uFEFF'; // UTF-8 BOM for Microsoft Excel
  if (profile) {
    csvContent += `"KHYBER PAKHTUNKHWA SERVICES TRIBUNAL (KPST) - CASE LIST"\n`;
    csvContent += `"User: ${profile.honorific} ${profile.name} | District: ${profile.district} | Generated: ${new Date().toLocaleString()}"\n\n`;
  }

  csvContent += headers.map(escapeCell).join(',') + '\n';
  rows.forEach((row) => {
    csvContent += row.join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const filename = `KPST_Cases_${profile ? profile.name.replace(/\s+/g, '_') : 'Export'}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Requirement 10: Download Cases in PDF format
 * Opens a dedicated court docket printable view styled exactly like an official KPST Cause Document.
 */
export function exportToPdf(cases: CourtCase[], profile?: UserProfile) {
  const dateNow = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>KPST Court Cases Docket - ${profile?.name || 'Cases'}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 10px;
      font-size: 11px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #064e3b;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .emblem-title {
      color: #064e3b;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.5px;
      margin: 0 0 4px 0;
      text-transform: uppercase;
    }
    .sub-title {
      font-size: 13px;
      color: #047857;
      font-weight: 600;
      margin: 0 0 6px 0;
    }
    .meta-bar {
      display: flex;
      justify-content: space-between;
      background: #f0fdf4;
      padding: 8px 14px;
      border-radius: 6px;
      border: 1px solid #bbf7d0;
      font-size: 11px;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 10.5px;
    }
    th {
      background-color: #064e3b;
      color: white;
      text-align: left;
      padding: 7px 6px;
      font-weight: 600;
      border: 1px solid #064e3b;
    }
    td {
      padding: 7px 6px;
      border: 1px solid #cbd5e1;
      vertical-align: top;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 9.5px;
    }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-accepted { background: #dcfce7; color: #166534; }
    .badge-dismissed { background: #fee2e2; color: #991b1b; }
    .footer {
      margin-top: 24px;
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      color: #64748b;
      font-size: 9px;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="emblem-title">KHYBER PAKHTUNKHWA SERVICES TRIBUNAL</h1>
    <div class="sub-title">OFFICIAL COURT CASE STATUS & HEARING SCHEDULE DOCKET</div>
    <div style="color: #64748b; font-size: 10px;">Principal Seat Peshawar & Circuit Benches: Abbottabad | Swat | D.I. Khan</div>
  </div>

  <div class="meta-bar">
    <div><strong>Petitioner / Litigant:</strong> ${profile?.honorific || 'Mr.'} ${profile?.name || 'Court User'}</div>
    <div><strong>District:</strong> ${profile?.district || 'Peshawar'}</div>
    <div><strong>Total Cases:</strong> ${cases.length}</div>
    <div><strong>Docket Date:</strong> ${dateNow}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 25px;">#</th>
        <th style="width: 80px;">Appeal No.</th>
        <th style="width: 130px;">Case Title</th>
        <th style="width: 100px;">Nature of Case</th>
        <th style="width: 90px;">Department</th>
        <th style="width: 80px;">Decision</th>
        <th style="width: 85px;">Next Date</th>
        <th style="width: 90px;">Bench</th>
        <th style="width: 75px;">Cause List Sr#</th>
        <th style="width: 80px;">Advocate</th>
      </tr>
    </thead>
    <tbody>
      ${cases
        .map(
          (c, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${c.appealNo}</strong> / ${c.year}</td>
          <td><strong>${c.caseTitle || '-'}</strong></td>
          <td>${c.natureOfCase || '-'}</td>
          <td>${c.department || '-'}</td>
          <td>
            <span class="badge ${
              c.decision?.toLowerCase().includes('accept')
                ? 'badge-accepted'
                : c.decision?.toLowerCase().includes('dismiss')
                ? 'badge-dismissed'
                : 'badge-pending'
            }">${c.decision || 'Under Hearing'}</span>
          </td>
          <td><strong>${formatDisplayDate(c.nextDate)}</strong></td>
          <td>${c.causeListBench || c.bench || '-'}</td>
          <td>${c.causeListSrNo ? `Sr. #${c.causeListSrNo}` : '-'}</td>
          <td>${c.advocateName || '-'}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="footer">
    <div>Source: Khyber Pakhtunkhwa Services Tribunal (https://kpst.gov.pk) | Generated via KPST Mobile Tracker App</div>
    <div>Document generated for legal reference only. Subject to official court confirmation.</div>
  </div>
</body>
</html>
  `;

  // Safely print via an in-page hidden iframe without window.open or popups
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          // If printing within iframe is restricted, download as HTML docket file
          downloadDocketFile(html, profile);
        }
        setTimeout(() => {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }, 400);
      return;
    }
  } catch {
    // Fallback if iframe creation fails
  }

  downloadDocketFile(html, profile);
}

function downloadDocketFile(html: string, profile?: UserProfile) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `KPST_Court_Docket_${profile ? profile.name.replace(/\s+/g, '_') : 'Cases'}_${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
