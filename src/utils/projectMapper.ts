import { MondayBoard, ColumnMapping, MappedProject } from "../types";
import { stripHtml } from "./textUtils";

export function mapMondayBoardToProjects(
  board: MondayBoard,
  mapping: ColumnMapping,
  todayStr: string = "2026-07-01"
): MappedProject[] {
  const items = board.items_page?.items || [];
  const today = new Date(todayStr);

  return items.map((item) => {
    // Extract column values
    const colValuesMap: { [key: string]: string } = {};
    const rawValuesMap: { [key: string]: string } = {};

    // In case item.column_values is empty or undefined, guard it
    const columnValues = item.column_values || [];

    columnValues.forEach((cv) => {
      colValuesMap[cv.id] = stripHtml(cv.text || "");
      rawValuesMap[cv.id] = cv.value || "";
    });

    const status = colValuesMap[mapping.statusColId] || "Not Started";
    const managerName = colValuesMap[mapping.managerColId] || "Unassigned";
    const dueDate = colValuesMap[mapping.dueDateColId] || null;
    const internalDueDate = colValuesMap[mapping.internalDueDateColId] || null;

    // Detect manager avatar or photo.
    // Monday people column can contain multiple people, we will just use the text.
    let avatar: string | null = null;
    if (managerName.toLowerCase().includes("sarah")) {
      avatar = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150";
    } else if (managerName.toLowerCase().includes("marcus")) {
      avatar = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150";
    } else if (managerName.toLowerCase().includes("ada")) {
      avatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150";
    } else if (managerName.toLowerCase().includes("linus")) {
      avatar = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150";
    } else if (managerName.toLowerCase().includes("alan")) {
      avatar = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150";
    }

    // Determine latest update and sanitize updates body
    const rawUpdates = item.updates || [];
    const updates = rawUpdates.map((u) => ({
      ...u,
      body: stripHtml(u.body || u.text_body || ""),
      text_body: stripHtml(u.text_body || u.body || "")
    }));

    let lastRespondedAt: string | null = null;
    if (updates.length > 0) {
      // Find latest update by date
      const sortedUpdates = [...updates].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      lastRespondedAt = sortedUpdates[0].created_at;
    }

    // Calculate flagging logic
    const isCompleted = ["done", "completed", "finished", "closed"].includes(status.toLowerCase());

    let isOverdue = false;
    if (dueDate && !isCompleted) {
      const dDate = new Date(dueDate);
      const dDateOnly = new Date(dDate.getUTCFullYear(), dDate.getUTCMonth(), dDate.getUTCDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      isOverdue = dDateOnly < todayOnly;
    }

    let isInternalOverdue = false;
    if (internalDueDate && !isCompleted) {
      const iDate = new Date(internalDueDate);
      const iDateOnly = new Date(iDate.getUTCFullYear(), iDate.getUTCMonth(), iDate.getUTCDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      isInternalOverdue = iDateOnly < todayOnly;
    }

    let isUnresponded2Days = false;
    if (!isCompleted) {
      if (!lastRespondedAt) {
        isUnresponded2Days = true; // No updates ever means unresponded!
      } else {
        const lastDate = new Date(lastRespondedAt);
        const diffMs = today.getTime() - lastDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays > 2) {
          isUnresponded2Days = true;
        }
      }
    }

    return {
      id: item.id,
      name: stripHtml(item.name || ""),
      status,
      groupId: item.group?.id,
      groupTitle: item.group?.title,
      manager: {
        name: managerName,
        avatar,
      },
      dueDate,
      internalDueDate,
      lastRespondedAt,
      isOverdue,
      isInternalOverdue,
      isUnresponded2Days,
      updates,
      rawColumnValues: colValuesMap,
      subitems: item.subitems || [],
    };
  });
}

// Function to auto-detect mappings from board columns
export function autoDetectColumnMapping(columns: Array<{ id: string; title: string; type: string }>): ColumnMapping {
  const mapping: ColumnMapping = {
    statusColId: "",
    managerColId: "",
    dueDateColId: "",
    internalDueDateColId: "",
    dueDateReminderColId: "",
  };

  columns.forEach((col) => {
    const title = col.title.toLowerCase();
    const type = col.type.toLowerCase();

    // Detect status column
    if (type === "status" || (title.includes("status") && !mapping.statusColId)) {
      mapping.statusColId = col.id;
    }
    // Detect manager / people column
    if (type === "people" || title.includes("manager") || title.includes("owner") || title.includes("lead")) {
      if (!mapping.managerColId) mapping.managerColId = col.id;
    }
    // Detect internal due date vs external due date
    if (type === "date" || title.includes("date") || title.includes("due") || title.includes("deadline")) {
      if (title.includes("internal") || title.includes("target") || title.includes("plan")) {
        if (!mapping.internalDueDateColId) mapping.internalDueDateColId = col.id;
      } else {
        if (!mapping.dueDateColId) mapping.dueDateColId = col.id;
      }
    }
    // Detect reminders/settings
    if (title.includes("reminder") || title.includes("setting") || title.includes("alert")) {
      if (!mapping.dueDateReminderColId) mapping.dueDateReminderColId = col.id;
    }
  });

  // Fallbacks if not auto-detected
  if (!mapping.statusColId && columns.length > 0) {
    const statusCol = columns.find((c) => c.type === "status" || c.id.toLowerCase().includes("status"));
    mapping.statusColId = statusCol ? statusCol.id : columns[0].id;
  }
  if (!mapping.managerColId && columns.length > 0) {
    const peopleCol = columns.find((c) => c.type === "people" || c.id.toLowerCase().includes("owner") || c.id.toLowerCase().includes("manager"));
    mapping.managerColId = peopleCol ? peopleCol.id : columns[0].id;
  }
  if (!mapping.dueDateColId && columns.length > 0) {
    const dateCols = columns.filter((c) => c.type === "date" || c.id.toLowerCase().includes("due") || c.id.toLowerCase().includes("date"));
    if (dateCols.length > 0) {
      mapping.dueDateColId = dateCols[0].id;
      if (dateCols.length > 1 && !mapping.internalDueDateColId) {
        mapping.internalDueDateColId = dateCols[1].id;
      }
    }
  }

  return mapping;
}
