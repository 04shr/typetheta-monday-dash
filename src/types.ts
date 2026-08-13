export interface MondayColumn {
  id: string;
  title: string;
  type: string;
}

export interface MondayColumnValue {
  id: string;
  text: string;
  value: string | null;
}

export interface MondayUpdate {
  id: string;
  body: string;
  text_body?: string;
  created_at: string;
  creator: {
    id: string;
    name: string;
    photo_thumb: string | null;
  };
}

export interface MondaySubitem {
  id: string;
  name: string;
  status: string; // e.g. "New Task", "In Progress", "Done", "Stuck"
  dueDate: string | null; // "YYYY-MM-DD"
  ownerName: string | null;
  lastUpdatedAt: string | null; // ISO Date String or YYYY-MM-DD
}

export interface MondayItem {
  id: string;
  name: string;
  group?: {
    id: string;
    title: string;
  } | null;
  column_values: MondayColumnValue[];
  updates: MondayUpdate[];
  subitems?: MondaySubitem[];
}

export interface MondayBoard {
  id: string;
  name: string;
  columns: MondayColumn[];
  items_page?: {
    items: MondayItem[];
  };
}

export interface ColumnMapping {
  statusColId: string;
  managerColId: string;
  dueDateColId: string;
  internalDueDateColId: string;
  dueDateReminderColId: string; // optional, e.g., a specific alert setting or date
}

export interface ProjectEmail {
  id: string;
  sender: string;
  subject: string;
  receivedAt: string; // ISO string
  isResponded: boolean;
  respondedAt?: string; // ISO string
  reminderSentCount: number;
  lastReminderSentAt?: string; // ISO string
}

export interface MappedProject {
  id: string;
  name: string;
  status: string;
  groupId?: string;
  groupTitle?: string;
  manager: {
    name: string;
    avatar: string | null;
  };
  dueDate: string | null; // "YYYY-MM-DD"
  internalDueDate: string | null; // "YYYY-MM-DD"
  lastRespondedAt: string | null; // ISO Date String or YYYY-MM-DD
  isOverdue: boolean; // missed due date
  isInternalOverdue: boolean; // missed internal due date
  isUnresponded2Days: boolean; // no response (update) in last 2 days
  updates: MondayUpdate[];
  rawColumnValues: { [key: string]: string };
  emails?: ProjectEmail[]; // client emails tracking SLA
  hasActiveSlaBreach?: boolean;
  slaBreachEmailsCount?: number;
  subitems?: MondaySubitem[];
  riskLevel?: "Red" | "Amber" | "Green" | string;
  riskReasons?: string[];
}

export interface SlaConfig {
  slaHoursLimit: number; // default: 4
  workingHoursStart: number; // default: 8
  workingHoursEnd: number; // default: 20
  staleDaysLimit: number; // default: 3
  clientDeadlineAlertDays: number; // default: 7
}

export interface BoardConfig {
  mapping: ColumnMapping;
  allowedGroups: string[];
  slaConfig: SlaConfig;
}

export interface PmPromise {
  id: string;
  projectId: string;
  projectName: string;
  managerName: string;
  sourceType: "update" | "email" | "subitem";
  sourceExcerpt: string;
  promiseSummary: string;
  promisedDate: string;
  isOverdue: boolean;
  isDueToday: boolean;
  status: "OVERDUE" | "PENDING_TODAY" | "PENDING_FUTURE" | "FULFILLED";
  clientEmail?: string;
  detectedAt: string;
}
