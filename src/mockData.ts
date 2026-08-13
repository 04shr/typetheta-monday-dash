import { MondayBoard, ColumnMapping } from "./types";

// Current mock reference date is 2026-07-01 (or can be dynamic relative to current)
// We will structure groups and subitems to match the user's audit guidelines perfectly.
export const MOCK_BOARD: MondayBoard = {
  id: "987654321",
  name: "📋 Master Delivery & Client Engagements Board",
  columns: [
    { id: "status", title: "Project Status", type: "status" },
    { id: "manager", title: "Project Manager", type: "people" },
    { id: "due_date", title: "Due Date", type: "date" },
    { id: "internal_due", title: "Internal Due Date", type: "date" },
    { id: "reminder", title: "Alert Settings", type: "text" },
  ],
  items_page: {
    items: [
      {
        id: "item_1",
        name: "Acme Corp Mobile App Refresh",
        group: { id: "in_progress", title: "IN PROGRESS" },
        column_values: [
          { id: "status", text: "Working on it", value: null },
          { id: "manager", text: "Sarah Connor", value: null },
          { id: "due_date", text: "2026-07-04", value: null }, // Client deadline within 7 days! (today is 2026-07-01, within 7 days -> Red risk!)
          { id: "internal_due", text: "2026-06-30", value: null }, // Internal due date in the past -> Red risk!
          { id: "reminder", text: "Standard Track", value: null },
        ],
        updates: [
          {
            id: "u_1_1",
            body: "API connection is solid. Doing final styling on widgets today.",
            created_at: "2026-06-29T10:00:00Z", // Updated 2 days ago (Amber if 3-5, so this is safe)
            creator: {
              id: "usr_sarah",
              name: "Sarah Connor",
              photo_thumb: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
            },
          },
        ],
        subitems: [
          {
            id: "sub_1_1",
            name: "Figma UI Review Signup",
            status: "Done",
            dueDate: "2026-06-25",
            ownerName: "Sarah Connor",
            lastUpdatedAt: "2026-06-25T11:00:00Z"
          },
          {
            id: "sub_1_2",
            name: "QA Client Acceptance Testing",
            status: "New Task",
            dueDate: "2026-06-30", // Overdue and still New Task! -> Red risk!
            ownerName: "Sarah Connor",
            lastUpdatedAt: "2026-06-28T09:00:00Z"
          }
        ]
      },
      {
        id: "item_2",
        name: "Hooli Cloud Infrastructure Migration",
        group: { id: "in_progress", title: "IN PROGRESS" },
        column_values: [
          { id: "status", text: "Stuck", value: null },
          { id: "manager", text: "Marcus Aurelius", value: null },
          { id: "due_date", text: "2026-07-15", value: null }, // Future
          { id: "internal_due", text: "2026-07-10", value: null }, // Future
          { id: "reminder", text: "Client chased", value: null },
        ],
        updates: [
          {
            id: "u_2_1",
            body: "Stuck on routing table replication. Database administrators are looking at cloud console.",
            created_at: "2026-06-26T14:30:00Z", // Stale update! Last updated 5 days ago (>3 days -> Amber/Red!)
            creator: {
              id: "usr_marcus",
              name: "Marcus Aurelius",
              photo_thumb: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
            },
          },
        ],
        subitems: [
          {
            id: "sub_2_1",
            name: "Spanner cluster provisioning",
            status: "In Progress",
            dueDate: "2026-06-29", // Overdue active subitem! -> Red risk!
            ownerName: "Marcus Aurelius",
            lastUpdatedAt: "2026-06-26T14:30:00Z"
          },
          {
            id: "sub_2_2",
            name: "Replica verification scripts",
            status: "New Task",
            dueDate: null, // Subitem has no due date! -> Amber/Red potential blocker!
            ownerName: null, // Subitem has no owner! -> Amber/Red potential blocker!
            lastUpdatedAt: "2026-06-26T14:30:00Z"
          }
        ]
      },
      {
        id: "item_3",
        name: "Pied Piper Compression Protocol",
        group: { id: "one_off", title: "ONE-OFF PROJECTS" },
        column_values: [
          { id: "status", text: "Working on it", value: null },
          { id: "manager", text: "Alan Turing", value: null },
          { id: "due_date", text: "2026-07-12", value: null },
          { id: "internal_due", text: "2026-07-06", value: null },
          { id: "reminder", text: "Normal", value: null },
        ],
        updates: [
          {
            id: "u_3_1",
            body: "Algorithm efficiency reached 2.4 bits/pixel. Testing file upload limits.",
            created_at: "2026-07-01T08:00:00Z", // Updated today!
            creator: {
              id: "usr_alan",
              name: "Alan Turing",
              photo_thumb: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
            },
          },
        ],
        subitems: [
          {
            id: "sub_3_1",
            name: "Core decoder library",
            status: "Done",
            dueDate: "2026-06-28",
            ownerName: "Alan Turing",
            lastUpdatedAt: "2026-07-01T08:00:00Z"
          },
          {
            id: "sub_3_2",
            name: "Android wrapper integration",
            status: "In Progress",
            dueDate: "2026-07-03", // Safe future
            ownerName: "Alan Turing",
            lastUpdatedAt: "2026-07-01T08:00:00Z"
          }
        ]
      },
      {
        id: "item_4",
        name: "Cyberdyne Systems Security Auditing",
        group: { id: "monthly", title: "MONTHLY PROJECTS" },
        column_values: [
          { id: "status", text: "Done", value: null },
          { id: "manager", text: "Ada Lovelace", value: null },
          { id: "due_date", text: "2026-06-30", value: null }, // Completed, past date is fine
          { id: "internal_due", text: "2026-06-28", value: null },
          { id: "reminder", text: "Cleared", value: null },
        ],
        updates: [
          {
            id: "u_4_1",
            body: "Audit completed successfully. Signed off by external lead. Everything secure.",
            created_at: "2026-06-30T16:00:00Z",
            creator: {
              id: "usr_ada",
              name: "Ada Lovelace",
              photo_thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
            },
          },
        ],
        subitems: [
          {
            id: "sub_4_1",
            name: "Penetration scan reporting",
            status: "Done",
            dueDate: "2026-06-28",
            ownerName: "Ada Lovelace",
            lastUpdatedAt: "2026-06-30T16:00:00Z"
          }
        ]
      },
      {
        id: "item_5",
        name: "Initech Database Normalization",
        group: { id: "yearly", title: "YEARLY PROJECTS" },
        column_values: [
          { id: "status", text: "New Task", value: null },
          { id: "manager", text: "Linus Torvalds", value: null },
          { id: "due_date", text: "2026-06-25", value: null }, // Overdue but still New Task! -> Red risk!
          { id: "internal_due", text: "2026-06-20", value: null }, // Overdue internal due date! -> Red risk!
          { id: "reminder", text: "None", value: null },
        ],
        updates: [], // No updates! -> Stale & No updates -> Amber/Red!
        subitems: [
          {
            id: "sub_5_1",
            name: "Schema schema audit",
            status: "New Task",
            dueDate: "2026-06-18", // Overdue subitem! -> Red risk!
            ownerName: null, // No owner! -> Red risk!
            lastUpdatedAt: null
          }
        ]
      },
      {
        id: "item_6",
        name: "Soylent Corp Logistics Dashboard",
        group: { id: "ongoing", title: "ONGOING" },
        column_values: [
          { id: "status", text: "Working on it", value: null },
          { id: "manager", text: "Ada Lovelace", value: null },
          { id: "due_date", text: "2026-07-20", value: null },
          { id: "internal_due", text: "2026-07-15", value: null },
          { id: "reminder", text: "Standard", value: null },
        ],
        updates: [
          {
            id: "u_6_1",
            body: "Reviewing delivery logistics tracking with stakeholder. Client wants to see a chart mockup.",
            created_at: "2026-06-27T10:00:00Z", // Last updated 4 days ago -> Amber!
            creator: {
              id: "usr_ada",
              name: "Ada Lovelace",
              photo_thumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
            },
          },
        ],
        subitems: [
          {
            id: "sub_6_1",
            name: "Dashboard widgets wireframing",
            status: "In Progress",
            dueDate: "2026-07-02", // Safe future
            ownerName: "Ada Lovelace",
            lastUpdatedAt: "2026-06-27T10:00:00Z" // Stale subitem update (4 days ago) -> Amber!
          }
        ]
      },
      {
        id: "item_7",
        name: "Umbrella Corp Bio-Security Integration",
        group: { id: "new_lead", title: "NEW LEAD" },
        column_values: [
          { id: "status", text: "Working on it", value: null },
          { id: "manager", text: "Unassigned", value: null }, // Missing manager field! -> Red risk (messy fields)
          { id: "due_date", text: null, value: null }, // Missing client due date! -> Red risk (messy fields)
          { id: "internal_due", text: "2026-07-05", value: null },
          { id: "reminder", text: "Urgent check", value: null },
        ],
        updates: [
          {
            id: "u_7_1",
            body: "Scoped requirements with stakeholder. Looking for a lead developer.",
            created_at: "2026-07-01T09:00:00Z",
            creator: {
              id: "usr_me",
              name: "Ankit Sethia",
              photo_thumb: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
            },
          },
        ],
        subitems: []
      },
      {
        id: "item_archive",
        name: "Old Legacy Setup",
        group: { id: "archived_stuff", title: "Archived & Excluded" }, // Group should be ignored!
        column_values: [
          { id: "status", text: "Done", value: null },
          { id: "manager", text: "Linus Torvalds", value: null },
          { id: "due_date", text: "2025-12-12", value: null },
          { id: "internal_due", text: "2025-12-01", value: null },
          { id: "reminder", text: "Done", value: null },
        ],
        updates: [],
        subitems: []
      }
    ],
  },
};

export const DEFAULT_MOCK_MAPPING: ColumnMapping = {
  statusColId: "status",
  managerColId: "manager",
  dueDateColId: "due_date",
  internalDueDateColId: "internal_due",
  dueDateReminderColId: "reminder",
};
