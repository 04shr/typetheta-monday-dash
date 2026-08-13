import { ProjectEmail, MappedProject } from "../types";

/**
 * Returns date details in Europe/London timezone.
 * Uses Intl.DateTimeFormat to be robust against daylight savings changes (GMT vs BST).
 */
export function getLondonDetails(date: Date) {
  const dtfParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/London',
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  });
  
  const parts = dtfParts.formatToParts(date);
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  
  const weekdayStr = partMap.weekday;
  const dayOfWeekMap: { [key: string]: number } = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = dayOfWeekMap[weekdayStr] ?? date.getDay();
  
  const hour = parseInt(partMap.hour || "0", 10);
  const minute = parseInt(partMap.minute || "0", 10);
  const day = parseInt(partMap.day || "1", 10);
  const month = parseInt(partMap.month || "1", 10);
  const year = parseInt(partMap.year || "2026", 10);
  
  return { dayOfWeek, hour, minute, day, month, year };
}

/**
 * Calculates the elapsed working hours (UK Working Hours default: Monday-Friday, 8am-8pm)
 * between receivedAt and completedAt (or now).
 */
export function getElapsedWorkingHours(
  receivedAtStr: string,
  completedAtStr?: string,
  startHour: number = 8,
  endHour: number = 20
): number {
  const start = new Date(receivedAtStr);
  const end = completedAtStr ? new Date(completedAtStr) : new Date();
  
  if (start >= end) return 0;
  
  let elapsedMinutes = 0;
  const stepMs = 5 * 60 * 1000; // 5-minute steps
  let currentMs = start.getTime();
  const endMs = end.getTime();
  
  while (currentMs < endMs) {
    const currentDate = new Date(currentMs);
    const details = getLondonDetails(currentDate);
    
    // Monday-Friday (1-5), startHour to endHour
    const isWorkingDay = details.dayOfWeek >= 1 && details.dayOfWeek <= 5;
    const isWorkingHour = details.hour >= startHour && details.hour < endHour;
    
    if (isWorkingDay && isWorkingHour) {
      elapsedMinutes += 5;
    }
    currentMs += stepMs;
  }
  
  return elapsedMinutes / 60;
}

/**
 * Calculates the exact SLA deadline date based on working-hour SLA
 * inside the UK working hours window (default Mon-Fri 8am-8pm).
 */
export function getSlaDeadline(
  receivedAtStr: string,
  slaHours: number = 4,
  startHour: number = 8,
  endHour: number = 20
): Date {
  const start = new Date(receivedAtStr);
  let currentMs = start.getTime();
  let accumulatedWorkingMinutes = 0;
  const targetWorkingMinutes = slaHours * 60;
  const stepMs = 5 * 60 * 1000; // 5-minute steps
  
  while (accumulatedWorkingMinutes < targetWorkingMinutes) {
    currentMs += stepMs;
    const currentDate = new Date(currentMs);
    const details = getLondonDetails(currentDate);
    
    const isWorkingDay = details.dayOfWeek >= 1 && details.dayOfWeek <= 5;
    const isWorkingHour = details.hour >= startHour && details.hour < endHour;
    
    if (isWorkingDay && isWorkingHour) {
      accumulatedWorkingMinutes += 5;
    }
  }
  
  return new Date(currentMs);
}

export function isSlaBreached(
  email: ProjectEmail,
  slaHours: number = 4,
  startHour: number = 8,
  endHour: number = 20
): boolean {
  if (email.isResponded) {
    const elapsed = getElapsedWorkingHours(email.receivedAt, email.respondedAt, startHour, endHour);
    return elapsed > slaHours;
  } else {
    const elapsed = getElapsedWorkingHours(email.receivedAt, undefined, startHour, endHour);
    return elapsed > slaHours;
  }
}

export function getSlaTimeRemaining(
  email: ProjectEmail,
  slaHours: number = 4,
  startHour: number = 8,
  endHour: number = 20
): { hours: number; minutes: number; isBreached: boolean } {
  const elapsed = getElapsedWorkingHours(email.receivedAt, undefined, startHour, endHour);
  if (elapsed >= slaHours) {
    return { hours: 0, minutes: 0, isBreached: true };
  }
  
  const deadline = getSlaDeadline(email.receivedAt, slaHours, startHour, endHour);
  const remainingMs = deadline.getTime() - Date.now();
  
  if (remainingMs <= 0) {
    return { hours: 0, minutes: 0, isBreached: true };
  }
  
  const totalMinutes = Math.floor(remainingMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes, isBreached: false };
}

/**
 * Interfaces for unmatched emails list
 */
export interface UnmatchedEmail {
  id: string;
  sender: string;
  emailAddress: string;
  subject: string;
  body: string;
  receivedAt: string;
  suggestedOwner: string;
  isFallback: boolean;
  reason: string;
}

/**
 * Match incoming emails to projects. If unable to match, we flag as unmatched
 * and suggest an owner (defaulting to Anna if unclear).
 */
export function matchEmailToProject(
  email: { sender: string; emailAddress: string; subject: string; body: string },
  projects: MappedProject[]
): { projectId: string | null; suggestedOwner: string; isFallback: boolean; reason: string } {
  const subjectLower = email.subject.toLowerCase();
  const bodyLower = email.body.toLowerCase();
  const senderLower = email.sender.toLowerCase();
  const emailLower = email.emailAddress.toLowerCase();

  // 1. Try matching with Monday pulse email / thread links where available (e.g., [item_X] or [pulse-X])
  const itemMatch = subjectLower.match(/\[(?:pulse-)?(item_\d+)\]/) || bodyLower.match(/\[(?:pulse-)?(item_\d+)\]/);
  if (itemMatch) {
    const projectId = itemMatch[1];
    const project = projects.find(p => p.id === projectId);
    if (project) {
      return {
        projectId: project.id,
        suggestedOwner: project.manager.name,
        isFallback: false,
        reason: `Matched via Monday thread pulse ID [${projectId}] in subject/body.`
      };
    }
  }

  // 2. Try matching with Client/project email address mapping
  // Let's check if the email address domain or text aligns with known project details
  for (const p of projects) {
    const projNameLower = p.name.toLowerCase();
    // If project name shares major words with sender or email address
    const projWords = projNameLower.split(/\s+/).filter(w => w.length > 3);
    const matchesEmail = projWords.some(w => emailLower.includes(w) || senderLower.includes(w));
    if (matchesEmail) {
      return {
        projectId: p.id,
        suggestedOwner: p.manager.name,
        isFallback: false,
        reason: `Matched sender/email domain "${email.emailAddress}" to Project "${p.name}" keywords.`
      };
    }
  }

  // 3. Try matching with Project/client name in subject or body
  for (const p of projects) {
    const projNameLower = p.name.toLowerCase();
    const cleanProjName = projNameLower.replace(/[^a-z0-9 ]/g, "");
    const words = cleanProjName.split(" ").filter(w => w.length > 3);
    
    // Check if whole project name or multiple keywords are found
    if (subjectLower.includes(projNameLower) || bodyLower.includes(projNameLower)) {
      return {
        projectId: p.id,
        suggestedOwner: p.manager.name,
        isFallback: false,
        reason: `Matched exact project name "${p.name}" in subject or body.`
      };
    }

    const matchesKeywords = words.length > 0 && words.every(w => subjectLower.includes(w) || bodyLower.includes(w));
    if (matchesKeywords) {
      return {
        projectId: p.id,
        suggestedOwner: p.manager.name,
        isFallback: false,
        reason: `Matched project name keywords in email subject/body.`
      };
    }
  }

  // 4. If no project match, try suggesting an owner based on keywords in the email
  // If the email contains words like "marketing" or "design" -> Sarah Connor
  // If "database", "spanner", "infrastructure" -> Marcus Aurelius
  // If "security", "compliance", "audit" -> Ada Lovelace
  // If "auth", "dev", "login", "code" -> Linus Torvalds
  // If "dashboard", "charts", "front-end" -> Alan Turing
  let suggestedOwner = "Anna";
  let isFallback = true;
  let reason = "No matching project found. Defaulted to Anna as fallback owner.";

  if (subjectLower.includes("design") || bodyLower.includes("design") || subjectLower.includes("marketing") || bodyLower.includes("marketing")) {
    suggestedOwner = "Sarah Connor";
    isFallback = false;
    reason = "No exact project match, but content suggests design/marketing. Routed to Sarah Connor.";
  } else if (subjectLower.includes("database") || bodyLower.includes("database") || subjectLower.includes("server") || bodyLower.includes("server") || subjectLower.includes("spanner")) {
    suggestedOwner = "Marcus Aurelius";
    isFallback = false;
    reason = "No exact project match, but database/infrastructure keywords found. Routed to Marcus Aurelius.";
  } else if (subjectLower.includes("security") || bodyLower.includes("security") || subjectLower.includes("audit") || bodyLower.includes("audit")) {
    suggestedOwner = "Ada Lovelace";
    isFallback = false;
    reason = "No exact project match, but security/audit keywords found. Routed to Ada Lovelace.";
  } else if (subjectLower.includes("auth") || bodyLower.includes("auth") || subjectLower.includes("code") || bodyLower.includes("bug")) {
    suggestedOwner = "Linus Torvalds";
    isFallback = false;
    reason = "No exact project match, but software code/auth keywords found. Routed to Linus Torvalds.";
  } else if (subjectLower.includes("dashboard") || bodyLower.includes("dashboard") || subjectLower.includes("ui") || bodyLower.includes("charts")) {
    suggestedOwner = "Alan Turing";
    isFallback = false;
    reason = "No exact project match, but dashboard/UI keywords found. Routed to Alan Turing.";
  }

  return {
    projectId: null,
    suggestedOwner,
    isFallback,
    reason
  };
}

export function getInitialMockEmails(projectId: string): ProjectEmail[] {
  const now = new Date();
  
  if (projectId === "item_1") {
    return [
      {
        id: "email_1_1",
        sender: "Gavin Belson (CEO, Hooli)",
        subject: "API login endpoints mismatch in dev",
        receivedAt: new Date(now.getTime() - 5.5 * 60 * 60 * 1000).toISOString(), // 5.5 hours ago (breached!)
        isResponded: false,
        reminderSentCount: 0
      },
      {
        id: "email_1_2",
        sender: "Richard Hendricks (Pied Piper)",
        subject: "URGENT: Compression library integration query - not heard back",
        receivedAt: new Date(now.getTime() - 1.5 * 60 * 60 * 1000).toISOString(), // 1.5 hours ago (pending, safe)
        isResponded: false,
        reminderSentCount: 0
      },
      {
        id: "email_1_3",
        sender: "Dinesh Chugtai (Systems Eng)",
        subject: "[item_1] Docker container deployment script check",
        receivedAt: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(), // 10 hours ago
        isResponded: true,
        respondedAt: new Date(now.getTime() - 9.2 * 60 * 60 * 1000).toISOString(), // responded within 48 mins (Met SLA!)
        reminderSentCount: 0
      }
    ];
  }
  
  if (projectId === "item_2") {
    return [
      {
        id: "email_2_1",
        sender: "Laurie Bream (Raviga Capital)",
        subject: "Spanner instance region confirmation - chasing again",
        receivedAt: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago (breached!)
        isResponded: false,
        reminderSentCount: 0
      },
      {
        id: "email_2_2",
        sender: "Laurie Bream (Raviga Capital)",
        subject: "Spanner database migration timeline overview",
        receivedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        isResponded: true,
        respondedAt: new Date(now.getTime() - 5.2 * 60 * 60 * 1000).toISOString(), // responded in 48 mins (Met SLA!)
        reminderSentCount: 0
      }
    ];
  }
  
  if (projectId === "item_3") {
    return [
      {
        id: "email_3_1",
        sender: "Ada Lovelace (Lead Auditor)",
        subject: "Security Audit Signoff Approval Request",
        receivedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        isResponded: true,
        respondedAt: new Date(now.getTime() - 23.5 * 60 * 60 * 1000).toISOString(), // Met SLA!
        reminderSentCount: 0
      }
    ];
  }
  
  if (projectId === "item_4") {
    return [
      {
        id: "email_4_1",
        sender: "Gilfoyle (Security Architect)",
        subject: "Auth0 Tenant credentials - delay unhappy with timelines",
        receivedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago (breached!)
        isResponded: false,
        reminderSentCount: 0
      }
    ];
  }
  
  if (projectId === "item_5") {
    return [
      {
        id: "email_5_1",
        sender: "Monica Hall (VP Product)",
        subject: "Review of high-fidelity dashboard design mockup",
        receivedAt: new Date(now.getTime() - 2.5 * 60 * 60 * 1000).toISOString(), // 2.5 hours ago (pending, safe)
        isResponded: false,
        reminderSentCount: 0
      }
    ];
  }
  
  // Dynamic deterministic seed generator for any other board items
  const cleanId = projectId.replace(/\D/g, "");
  const num = cleanId ? parseInt(cleanId, 10) : Array.from(projectId).reduce((acc, c) => acc + c.charCodeAt(0), 0);

  const clientSenders = [
    "Sarah Jenkins (Client VP)",
    "David Miller (Engineering Lead)",
    "Elena Rostova (Product Director)",
    "Michael Chang (CTO, Client)",
    "Rachel Green (Operations Manager)",
    "Tom Holland (Head of Digital)",
    "Sophia Patel (Finance & Accounts)",
    "Alex Vance (Security Officer)",
    "Chris Pratt (Project Sponsor)",
    "Emma Watson (Compliance Lead)"
  ];

  const clientSubjects = [
    "Clarification required on revised project scope and deliverables",
    "URGENT: Outstanding client invoice and pricing breakdown request",
    "Feedback on milestone design presentation - waiting for confirmation",
    "Chasing status update on server migration and deployment window",
    "Request for updated Gantt chart and delivery timeline signoff",
    "Security compliance documentation & SSO access request",
    "Query regarding API rate limits and production sandbox access",
    "Client team availability for weekly sync and demo session",
    "Approval requested for change order #3 budget adjustment",
    "User acceptance testing feedback and high-priority bug list"
  ];

  const sender = clientSenders[num % clientSenders.length];
  const subject = clientSubjects[num % clientSubjects.length];
  const mod = num % 4;

  if (mod === 0) {
    // 2 emails: 1 breached (6.5h ago), 1 pending (1.2h ago)
    return [
      {
        id: `email_${projectId}_1`,
        sender,
        subject,
        receivedAt: new Date(now.getTime() - 6.5 * 60 * 60 * 1000).toISOString(),
        isResponded: false,
        reminderSentCount: 0
      },
      {
        id: `email_${projectId}_2`,
        sender: clientSenders[(num + 1) % clientSenders.length],
        subject: clientSubjects[(num + 1) % clientSubjects.length],
        receivedAt: new Date(now.getTime() - 1.2 * 60 * 60 * 1000).toISOString(),
        isResponded: false,
        reminderSentCount: 0
      }
    ];
  } else if (mod === 1) {
    // 1 breached email (8.2h ago)
    return [
      {
        id: `email_${projectId}_1`,
        sender,
        subject,
        receivedAt: new Date(now.getTime() - 8.2 * 60 * 60 * 1000).toISOString(),
        isResponded: false,
        reminderSentCount: 0
      }
    ];
  } else if (mod === 2) {
    // 1 pending email within SLA limit (2.8h ago)
    return [
      {
        id: `email_${projectId}_1`,
        sender,
        subject,
        receivedAt: new Date(now.getTime() - 2.8 * 60 * 60 * 1000).toISOString(),
        isResponded: false,
        reminderSentCount: 0
      }
    ];
  } else {
    // 1 responded email + 1 unreplied email (5.1h ago)
    return [
      {
        id: `email_${projectId}_1`,
        sender,
        subject,
        receivedAt: new Date(now.getTime() - 5.1 * 60 * 60 * 1000).toISOString(),
        isResponded: false,
        reminderSentCount: 0
      },
      {
        id: `email_${projectId}_2`,
        sender: clientSenders[(num + 2) % clientSenders.length],
        subject: "Confirmation of signoff received",
        receivedAt: new Date(now.getTime() - 14 * 60 * 60 * 1000).toISOString(),
        isResponded: true,
        respondedAt: new Date(now.getTime() - 13.2 * 60 * 60 * 1000).toISOString(),
        reminderSentCount: 0
      }
    ];
  }
}

/**
 * Return some mock unmatched emails to demonstrate the matching system in the summary.
 */
export function getMockUnmatchedEmails(projects: MappedProject[]): UnmatchedEmail[] {
  const rawList = [
    {
      id: "unmatched_1",
      sender: "Erlich Bachman",
      emailAddress: "erlich@incubator.co",
      subject: "Aviato marketing brand identity - urgent update",
      body: "We have not heard back regarding our seed round visual design templates. We are unhappy with this delay. Please call me back today.",
      receivedAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "unmatched_2",
      sender: "Nelson Bighetti",
      emailAddress: "bighead@hooli.com",
      subject: "Unclear specs regarding Cloud Run container limits",
      body: "I am trying to run the security compliance scripts, but I don't know who has the access keys.",
      receivedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString()
    }
  ];

  return rawList.map(email => {
    const match = matchEmailToProject(email, projects);
    return {
      ...email,
      suggestedOwner: match.suggestedOwner,
      isFallback: match.isFallback,
      reason: match.reason
    };
  });
}

/**
 * Evaluates whether an update text contains actual project progress or is just a placeholder / non-update
 * (e.g., "no updates", "waiting", "n/a", "no change", "pending", "waiting on client").
 */
export function isMeaningfulUpdateBody(text: string | null | undefined): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase().replace(/[^\w\s]/g, "");
  if (!clean) return false;

  // Explicit non-update phrases
  const nonUpdateExactPhrases = [
    "no update",
    "no updates",
    "no update today",
    "no updates today",
    "no update as of now",
    "no updates as of now",
    "no change",
    "no changes",
    "nothing new",
    "nothing to report",
    "waiting",
    "waiting...",
    "waiting for update",
    "waiting for updates",
    "waiting for response",
    "waiting for feedback",
    "waiting for client",
    "waiting on client",
    "waiting on team",
    "still waiting",
    "pending",
    "pending update",
    "n a",
    "na",
    "none",
    "no status update",
    "no progress",
    "in progress no update",
    "on hold waiting",
    "no updates yet",
    "no update yet"
  ];

  if (nonUpdateExactPhrases.includes(clean)) {
    return false;
  }

  // Token check for short phrases (<= 6 words) made up entirely of non-update / fluff keywords
  const words = clean.split(/\s+/).filter(Boolean);
  const fluffKeywords = new Set([
    "no", "not", "update", "updates", "today", "now", "waiting", "still", "pending", 
    "none", "na", "change", "changes", "nothing", "new", "report", "progress",
    "client", "team", "as", "of", "for", "on", "in", "to", "hold", "yet"
  ]);

  const fluffCount = words.filter(w => fluffKeywords.has(w)).length;
  if (words.length <= 6 && fluffCount === words.length) {
    return false;
  }

  return true;
}

/**
 * Returns the timestamp string of the most recent meaningful update for a project,
 * ignoring non-substantive updates like "no updates" or "waiting".
 */
export function getLatestMeaningfulUpdateDate(project: MappedProject): string | null {
  if (project.updates && project.updates.length > 0) {
    const meaningfulUpdates = project.updates.filter(u => isMeaningfulUpdateBody(u.text_body || u.body));
    if (meaningfulUpdates.length > 0) {
      return meaningfulUpdates[0].created_at;
    }
    // If all updates in the feed are non-meaningful ("no updates", "waiting"), return null
    return null;
  }

  // Fallback to project.lastRespondedAt if no updates array exists
  return project.lastRespondedAt || null;
}

/**
 * Evaluates Red / Amber / Green health risk levels for a mapped project using configurable rules.
 */
export function calculateProjectRisk(
  p: MappedProject,
  todayStr: string = "2026-07-01",
  config?: {
    slaHoursLimit?: number;
    workingHoursStart?: number;
    workingHoursEnd?: number;
    staleDaysLimit?: number;
    clientDeadlineAlertDays?: number;
  }
): { riskLevel: "Red" | "Amber" | "Green"; reasons: string[]; actions: string[] } {
  const reasons: string[] = [];
  const actions: string[] = [];
  const today = new Date(todayStr);
  const isCompleted = ["done", "completed", "finished", "closed"].includes(p.status.toLowerCase());

  const slaHoursLimit = config?.slaHoursLimit ?? 4;
  const workingHoursStart = config?.workingHoursStart ?? 8;
  const workingHoursEnd = config?.workingHoursEnd ?? 20;
  const staleDaysLimit = config?.staleDaysLimit ?? 3;
  const clientDeadlineAlertDays = config?.clientDeadlineAlertDays ?? 7;

  if (isCompleted) {
    return {
      riskLevel: "Green",
      reasons: ["Project is completed successfully."],
      actions: ["No action required. Project is closed."]
    };
  }

  // --- RED RISK RULES ---
  // 1. Internal due date is today or overdue
  if (p.internalDueDate) {
    const internalDate = new Date(p.internalDueDate);
    const internalOnly = new Date(internalDate.getFullYear(), internalDate.getMonth(), internalDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (internalOnly <= todayOnly) {
      reasons.push(`Internal due date (${p.internalDueDate}) is today or overdue.`);
      actions.push("Review internal delays and assign more resources to hit delivery.");
    }
  }

  // 2. Client deadline is today or overdue
  if (p.dueDate) {
    const clientDate = new Date(p.dueDate);
    const clientOnly = new Date(clientDate.getFullYear(), clientDate.getMonth(), clientDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    if (clientOnly <= todayOnly) {
      reasons.push(`Client deadline (${p.dueDate}) is today or overdue.`);
      actions.push("Immediately contact the client, apologize, reset expectation, and prioritize work.");
    }
  }

  // Subitems analysis
  const subitems = p.subitems || [];
  const activeSubitems = subitems.filter(s => !["done", "completed"].includes(s.status.toLowerCase()));
  
  let subitemOverdueCount = 0;
  let subitemNewTaskOverdueCount = 0;
  let subitemMissingOwnerOrDateCount = 0;
  let subitemStaleCount = 0;

  activeSubitems.forEach(s => {
    // 3. Any active subitem is overdue
    if (s.dueDate) {
      const sDate = new Date(s.dueDate);
      const sOnly = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      if (sOnly < todayOnly) {
        subitemOverdueCount++;
        // 4. Any active subitem is still New Task with a due date today/overdue
        if (s.status === "New Task" || s.status === "Not Started") {
          subitemNewTaskOverdueCount++;
        }
      }
    }
    
    // 5. Any active subitem has no owner or no due date and could block delivery
    if (!s.ownerName || !s.dueDate) {
      subitemMissingOwnerOrDateCount++;
    }

    // Amber subitem update staleness check (staleDaysLimit days)
    if (s.lastUpdatedAt) {
      const sUpdate = new Date(s.lastUpdatedAt);
      const sUpdateOnly = new Date(sUpdate.getFullYear(), sUpdate.getMonth(), sUpdate.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const diffMs = todayOnly.getTime() - sUpdateOnly.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays >= staleDaysLimit) {
        subitemStaleCount++;
      }
    }
  });

  if (subitemOverdueCount > 0) {
    reasons.push(`${subitemOverdueCount} active subitem(s) are overdue.`);
    actions.push("Instruct the PM to immediately follow up and complete overdue subitems.");
  }
  if (subitemNewTaskOverdueCount > 0) {
    reasons.push(`${subitemNewTaskOverdueCount} subitem(s) are still in 'New Task' state past their due date.`);
    actions.push("Reassign or start work immediately on unstarted overdue subtasks.");
  }
  if (subitemMissingOwnerOrDateCount > 0) {
    reasons.push(`${subitemMissingOwnerOrDateCount} active subitem(s) have no owner or no due date, which could block delivery.`);
    actions.push("Assign owners and firm due dates on all unassigned/un-scoped subitems.");
  }

  // 6. Client email has not been replied to within custom SLA working hours
  const pendingEmails = (p.emails || []).filter(e => !e.isResponded);
  let emailSlaBreachedCount = 0;
  let clientChased = false;
  let clientComplaintLanguage = false;

  const complaintKeywords = ["urgent", "chasing", "not heard back", "delay", "unhappy", "complaint", "dissatisfied"];

  pendingEmails.forEach(e => {
    // Check SLA breach
    const workingHoursElapsed = getElapsedWorkingHours(e.receivedAt, undefined, workingHoursStart, workingHoursEnd);
    if (workingHoursElapsed > slaHoursLimit) {
      emailSlaBreachedCount++;
    }

    const subjectLower = e.subject.toLowerCase();
    
    // 7. Client has chased again
    if (subjectLower.includes("chase") || subjectLower.includes("chasing") || subjectLower.includes("chased")) {
      clientChased = true;
    }

    // 8. Client uses complaint language
    if (complaintKeywords.some(kw => subjectLower.includes(kw))) {
      clientComplaintLanguage = true;
    }
  });

  if (emailSlaBreachedCount > 0) {
    reasons.push(`${emailSlaBreachedCount} client email(s) breached the ${slaHoursLimit}-working-hour SLA.`);
    actions.push("Immediately draft a reply to the pending client email to stop further SLA damage.");
  }
  if (clientChased) {
    reasons.push("Client has chased for an update.");
    actions.push("Contact client directly with a call/urgent update to restore confidence.");
  }
  if (clientComplaintLanguage) {
    reasons.push("Client email contains complaint language (urgent, unhappy, delay, not heard back).");
    actions.push("Escalate immediately. Founder/Senior Lead should review client communication.");
  }

  // 9. Project is overdue but still New Task or In Progress
  if (p.dueDate) {
    const clientDate = new Date(p.dueDate);
    const clientOnly = new Date(clientDate.getFullYear(), clientDate.getMonth(), clientDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    if (clientOnly < todayOnly && (p.status === "New Task" || p.status === "Not Started" || p.status === "Working on it" || p.status === "In Progress")) {
      reasons.push(`Project is overdue (${p.dueDate}) but still in '${p.status}' state.`);
      actions.push("Set status to stuck and create an emergency recovery plan.");
    }
  }

  // 10. Project has serious missing/messy fields
  let isMessy = false;
  if (!p.manager.name || p.manager.name === "Unassigned" || p.manager.name === "") {
    reasons.push("Project has no assigned manager/owner.");
    actions.push("Assign an owner to this project immediately.");
    isMessy = true;
  }
  if (!p.dueDate) {
    reasons.push("Project has no client due date.");
    actions.push("Set a clear client deadline to maintain accountability.");
    isMessy = true;
  }
  if (!p.status || p.status === "None" || p.status === "") {
    reasons.push("Project status is missing or blank.");
    actions.push("Update project status to reflect current state.");
    isMessy = true;
  }

  // Determine if Red Risk is triggered
  if (reasons.length > 0) {
    return {
      riskLevel: "Red",
      reasons,
      actions: Array.from(new Set(actions))
    };
  }

  // --- AMBER RISK RULES ---
  const amberReasons: string[] = [];
  const amberActions: string[] = [];

  // Approaching client deadline within alert window
  if (p.dueDate) {
    const clientDate = new Date(p.dueDate);
    const clientOnly = new Date(clientDate.getFullYear(), clientDate.getMonth(), clientDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffTime = clientOnly.getTime() - todayOnly.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0 && diffDays <= clientDeadlineAlertDays) {
      amberReasons.push(`Client deadline (${p.dueDate}) is approaching within ${clientDeadlineAlertDays} days (${diffDays} days left).`);
      amberActions.push("Double-check all subitems and clear blockers to ensure timely client delivery.");
    }
  }

  // 1. Project has not been updated on Monday for staleDaysLimit days with a meaningful update
  const latestMeaningfulDateStr = getLatestMeaningfulUpdateDate(p);

  if (latestMeaningfulDateStr) {
    const lastDate = new Date(latestMeaningfulDateStr);
    const lastOnly = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const diffMs = todayOnly.getTime() - lastOnly.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays >= staleDaysLimit && diffDays <= (staleDaysLimit + 2)) {
      amberReasons.push(`Project has not had a substantive update on Monday for ${Math.floor(diffDays)} days.`);
      amberActions.push("Post a meaningful progress update on Monday board (placeholder 'no updates' or 'waiting' notes do not count).");
    } else if (diffDays > (staleDaysLimit + 2)) {
      amberReasons.push(`Project is severely stale: no substantive update on Monday for ${Math.floor(diffDays)} days.`);
      amberActions.push("Urgent: Post a comprehensive status update on the Monday board.");
    }
  } else {
    if (p.updates && p.updates.length > 0) {
      amberReasons.push("Project updates posted are non-substantive (e.g. 'no updates', 'waiting') and do not count as active progress.");
      amberActions.push("Post a concrete progress update with details on current milestones.");
    } else {
      amberReasons.push("Project has no Monday board updates recorded.");
      amberActions.push("Write a kick-off update to initialize the communication feed.");
    }
  }

  // 2. Any subitem has not been updated in staleDaysLimit days
  if (subitemStaleCount > 0) {
    amberReasons.push(`${subitemStaleCount} subitem(s) have not been updated for ${staleDaysLimit}+ days.`);
    amberActions.push("Ask the subtask owner to post a quick subtask update.");
  }

  // 3. Project is waiting for client/team but has no clear follow-up
  const statusLower = p.status.toLowerCase();
  if ((statusLower.includes("waiting") || statusLower.includes("awaiting") || statusLower.includes("feedback")) && !p.rawColumnValues.reminder) {
    amberReasons.push(`Project is in '${p.status}' state but lacks a documented follow-up alert.`);
    amberActions.push("Add a reminder note/date to follow up with the client/team.");
  }

  // 4. Subitems are unclear, missing dates, missing owners, or still New Task
  const hasNewTaskSubitems = subitems.some(s => s.status === "New Task" || s.status === "Not Started");
  const hasUnassignedSubitems = subitems.some(s => !s.ownerName || !s.dueDate);
  if (subitems.length > 0 && (hasNewTaskSubitems || hasUnassignedSubitems)) {
    amberReasons.push("Subitems have unassigned owners, missing dates, or remain in 'New Task' state.");
    amberActions.push("Refine subtasks by assigning owners, dates, or updating statuses.");
  }

  if (amberReasons.length > 0) {
    return {
      riskLevel: "Amber",
      reasons: amberReasons,
      actions: Array.from(new Set(amberActions))
    };
  }

  // --- GREEN RISK RULES ---
  return {
    riskLevel: "Green",
    reasons: ["Project is healthy. No overdue targets, stale threads, or pending email breaches."],
    actions: ["Keep executing daily milestones according to plan."]
  };
}

