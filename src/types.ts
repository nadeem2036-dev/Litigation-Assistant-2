export interface UserProfile {
  name: string;
  honorific: string;
  district: string;
  username?: string;
  referenceId?: string;
  cnic?: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
  isOnboarded: boolean;
}

export interface CourtCase {
  id: string;
  court?: 'KPST' | 'PHC' | string;
  appealNo: string;
  year: string;
  caseTitle: string;
  department: string;
  bench: string;
  advocateName: string;
  natureOfCase: string;
  decision: string;
  decidedOn?: string;
  nextDate: string;
  causeListSrNo: string;
  causeListBench: string;
  courtRoom?: string;
  justiceName?: string;
  isOnDeletedList?: boolean;
  placeOfHearing: 'Peshawar' | 'Swat' | 'D.I Khan' | 'Abbottabad';
  lastUpdated: string;
  notes?: string;
  causeListPdfUrl?: string;
  judgmentCount?: number;
  caseCode?: number | string;
  benchId?: number;
}

export interface JudgmentRecord {
  caseCode: number | string;
  caseNo: string;
  caseTitle: string;
  bench: string;
  benchId: number;
  fileName: string;
  fileType: string;
  entryDate: string;
  operator?: string;
  downloadUrl: string;
}

export interface HearingAlert {
  id: string;
  caseId: string;
  caseTitle: string;
  appealNo: string;
  year: string;
  hearingDate: string;
  alertScheduledTime: string; // 11:00 AM day before
  hasTriggered: boolean;
  message: string;
}

export const KP_DISTRICTS = [
  'Peshawar',
  'Mardan',
  'Swat',
  'Abbottabad',
  'Dera Ismail Khan',
  'Kohat',
  'Bannu',
  'Haripur',
  'Swabi',
  'Charsadda',
  'Nowshera',
  'Malakand',
  'Buner',
  'Dir Lower',
  'Dir Upper',
  'Chitral Lower',
  'Chitral Upper',
  'Kohistan Upper',
  'Kohistan Lower',
  'Kolai Palas',
  'Shangla',
  'Mansehra',
  'Battagram',
  'Torghar',
  'Hangu',
  'Karak',
  'Kurram',
  'Orakzai',
  'North Waziristan',
  'South Waziristan Upper',
  'South Waziristan Lower',
  'Khyber',
  'Mohmand',
  'Bajaur',
  'Tank',
  'Lakki Marwat',
] as const;

export const HONORIFICS = ['Mr.', 'Ms.', 'Adv.', 'Dr.', 'Engr.', 'Malik', 'Syed', 'Mrs.'] as const;

export const PLACES_OF_HEARING = ['Peshawar', 'Swat', 'D.I Khan', 'Abbottabad'] as const;
