import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "motion/react";
import TypeThetaLogo from "./TypeThetaLogo";
import { PortalUser } from "./PortalAuthModal";
import { MappedProject, ProjectEmail, SlaConfig, ColumnMapping } from "../types";
import { 
  calculateProjectRisk, 
  getElapsedWorkingHours, 
  isSlaBreached,
  getLatestMeaningfulUpdateDate,
  isMeaningfulUpdateBody
} from "../utils/slaHelper";
import { 
  detectPmPromisesFromProjects, 
  PmPromise 
} from "../utils/promiseHelper";
import { 
  AlertTriangle, 
  Clock, 
  Calendar, 
  Users, 
  FileWarning, 
  CheckCircle,
  Mail,
  ListTodo,
  BookOpen,
  Flag,
  Search,
  Filter,
  ChevronRight,
  Info,
  SlidersHorizontal,
  LogOut,
  LogIn,
  Handshake,
  Sparkles,
  Send,
  MessageSquare,
  Check,
  Zap,
  ArrowUpRight,
  Copy,
  UserCheck,
  ShieldAlert,
  Flame,
  CheckCircle2,
  RefreshCw,
  X,
  PenSquare,
  ShieldCheck,
  KeyRound,
  Shield,
  Share2,
  Eye,
  LayoutGrid,
  List
} from "lucide-react";

interface TypeThetaDashboardProps {
  projects: MappedProject[];
  onSelectProject: (p: MappedProject, initialTab?: "overview" | "updates" | "emails" | "subitems" | "sync") => void;
  todayStr?: string;
  riskConfig?: SlaConfig;
  activeMenu: string;
  onSelectMenu: (menu: string) => void;
  projectEmails?: { [projectId: string]: ProjectEmail[] };
  mapping?: ColumnMapping;
  onShowConfig?: () => void;
  isDemoMode?: boolean;
  currentUser?: PortalUser | null;
  onOpenInviteModal?: () => void;
  onOpenAuthModal?: () => void;
  onLogout?: () => void;
  selectedManager?: string | null;
  onSelectManager?: (manager: string | null) => void;
  lastSyncedAt?: Date;
  onRefreshLiveBoard?: () => void;
  isSyncing?: boolean;
  onOpen2FaModal?: () => void;
}

function getCategoryForGroupTitle(rawTitle: string): string {
  const title = (rawTitle || "").trim().toUpperCase();
  if (!title) return "OTHER";
  if (title.includes("ARCHIVE") || title.includes("EXCLUDE")) return "ARCHIVED";
  if (title.includes("ONE") || title.includes("OFF")) return "ONE OFF PROJECT";
  if (title.includes("MONTHLY")) return "MONTHLY CONTRACT";
  if (title.includes("YEARLY")) return "YEARLY CONTRACT";
  if (title.includes("LEAD")) return "NEW LEAD";
  if (title.includes("HOLD") || title.includes("DELAY") || title.includes("STUCK")) return "ON HOLD/DELAYED";
  if (title.includes("PROPOSAL")) return "PROPOSAL PHASE";
  if (title.includes("INVOICE")) return "INVOICES OVERDUE";
  if (title.includes("DONE") || title.includes("COMPLETE") || title.includes("FINISHED")) return "COMPLETED";
  if (title.includes("PROGRESS") || title.includes("ONGOING")) return "IN PROGRESS";
  return title;
}

export default function TypeThetaDashboard({
  projects,
  onSelectProject,
  todayStr = "2026-07-24",
  riskConfig,
  activeMenu,
  onSelectMenu,
  projectEmails = {},
  mapping,
  onShowConfig,
  isDemoMode = true,
  currentUser,
  onOpenInviteModal,
  onOpenAuthModal,
  onLogout,
  selectedManager,
  onSelectManager,
  lastSyncedAt = new Date(),
  onRefreshLiveBoard,
  isSyncing = false,
  onOpen2FaModal,
}: TypeThetaDashboardProps) {
  // Local state for filtering
  const [selectedGroupTab, setSelectedGroupTab] = useState<string>("ALL");
  const [actionOwnerFilter, setActionOwnerFilter] = useState<string>("ALL");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [riskLevelTab, setRiskLevelTab] = useState<"RED" | "AMBER" | "GREEN" | "ALL">("RED");
  
  // PM Foolproof Priority Focus Filter ("ALL" | "RISK" | "DEADLINE" | "STALE" | "PROMISE")
  const [pmPriorityFocusTab, setPmPriorityFocusTab] = useState<"ALL" | "RISK" | "DEADLINE" | "STALE" | "PROMISE">("ALL");

  // Section Display Layout Mode ("grid" | "table") - defaulting to spacious grid boxes!
  const [sectionViewMode, setSectionViewMode] = useState<"grid" | "table">("grid");

  // In-memory status update overrides for quick updates
  const [manuallyUpdatedProjectIds, setManuallyUpdatedProjectIds] = useState<{ [id: string]: { lastRespondedAt: string; note: string } }>({});
  const [quickUpdateModalProject, setQuickUpdateModalProject] = useState<MappedProject | null>(null);
  const [quickUpdateText, setQuickUpdateText] = useState<string>("");
  const [quickUpdateSuccessMsg, setQuickUpdateSuccessMsg] = useState<string>("");

  // Local state for promise tracker & draft modal
  const [promiseStatusFilter, setPromiseStatusFilter] = useState<"ALL" | "OVERDUE" | "PENDING_TODAY" | "FULFILLED">("ALL");
  const [promiseSearchQuery, setPromiseSearchQuery] = useState<string>("");
  const [selectedPromiseForDraft, setSelectedPromiseForDraft] = useState<PmPromise | null>(null);
  const [draftReplyText, setDraftReplyText] = useState<string>("");
  const [fulfilledPromiseIds, setFulfilledPromiseIds] = useState<Set<string>>(new Set());
  
  // Local state for Daily PM Briefing Modal
  const [isBriefingModalOpen, setIsBriefingModalOpen] = useState<boolean>(false);
  const [copiedBriefing, setCopiedBriefing] = useState<boolean>(false);

  // Recently synced state for fading animation & soft green highlight
  const [isRecentlySynced, setIsRecentlySynced] = useState<boolean>(false);
  const prevSyncedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const currentMs = lastSyncedAt ? lastSyncedAt.getTime() : 0;
    if (prevSyncedAtRef.current !== null && currentMs !== prevSyncedAtRef.current) {
      setIsRecentlySynced(true);
      const timer = setTimeout(() => {
        setIsRecentlySynced(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
    prevSyncedAtRef.current = currentMs;
  }, [lastSyncedAt]);

  // Synchronize internal manager filter with props or local selection
  const activeManagerFilter = selectedManager || (actionOwnerFilter !== "ALL" ? actionOwnerFilter : null);

  const handleManagerSelect = (mgr: string | null) => {
    if (onSelectManager) {
      onSelectManager(mgr);
    }
    setActionOwnerFilter(mgr || "ALL");
  };

  // 1. Analyze projects with risk scores & manual update overrides
  const rawAnalyzedProjects = useMemo(() => {
    return projects.map(p => {
      const override = manuallyUpdatedProjectIds[p.id];
      const projectWithOverride = override ? {
        ...p,
        lastRespondedAt: override.lastRespondedAt,
        updates: [
          {
            id: `quick-upd-${Date.now()}`,
            body: override.note,
            text_body: override.note,
            created_at: override.lastRespondedAt,
            creator: {
              id: "pm-1",
              name: currentUser?.name || p.manager.name || "PM",
              photo_thumb: null
            }
          },
          ...(p.updates || [])
        ]
      } : p;

      const risk = calculateProjectRisk(projectWithOverride, todayStr, {
        ...riskConfig,
        slaHoursLimit: (p as any).slaLimitHours ?? riskConfig?.slaHoursLimit
      });
      return {
        ...projectWithOverride,
        riskLevel: risk.riskLevel,
        riskReasons: risk.reasons,
        riskActions: risk.actions
      };
    });
  }, [projects, todayStr, riskConfig, manuallyUpdatedProjectIds, currentUser]);

  // Apply Global Manager Filter if selected
  const analyzedProjects = useMemo(() => {
    if (!activeManagerFilter) return rawAnalyzedProjects;
    return rawAnalyzedProjects.filter(p => p.manager.name === activeManagerFilter);
  }, [rawAnalyzedProjects, activeManagerFilter]);

  // Unique list of managers across all projects
  const uniqueManagersList = useMemo(() => {
    const list: Array<{ name: string; totalProjects: number; redCount: number }> = [];
    const map = new Map<string, { total: number; red: number }>();

    rawAnalyzedProjects.forEach(p => {
      const name = p.manager.name || "Unassigned";
      const existing = map.get(name) || { total: 0, red: 0 };
      map.set(name, {
        total: existing.total + 1,
        red: existing.red + (p.riskLevel === "Red" ? 1 : 0)
      });
    });

    map.forEach((val, key) => {
      list.push({ name: key, totalProjects: val.total, redCount: val.red });
    });

    return list.sort((a, b) => b.totalProjects - a.totalProjects);
  }, [rawAnalyzedProjects]);

  // AI Detect PM Promises & Commitments
  const detectedPromises = useMemo(() => {
    const allDetected = detectPmPromisesFromProjects(rawAnalyzedProjects, todayStr);
    
    // Override local fulfilled status
    let list = allDetected.map(p => ({
      ...p,
      status: fulfilledPromiseIds.has(p.id) ? ("FULFILLED" as const) : p.status
    }));

    if (activeManagerFilter) {
      list = list.filter(p => p.managerName === activeManagerFilter);
    }

    if (promiseStatusFilter !== "ALL") {
      list = list.filter(p => {
        if (promiseStatusFilter === "OVERDUE") return p.status === "OVERDUE";
        if (promiseStatusFilter === "PENDING_TODAY") return p.status === "PENDING_TODAY";
        if (promiseStatusFilter === "FULFILLED") return p.status === "FULFILLED";
        return true;
      });
    }

    if (promiseSearchQuery) {
      const q = promiseSearchQuery.toLowerCase();
      list = list.filter(p => 
        p.projectName.toLowerCase().includes(q) || 
        p.managerName.toLowerCase().includes(q) ||
        p.promiseSummary.toLowerCase().includes(q)
      );
    }

    return list;
  }, [rawAnalyzedProjects, todayStr, activeManagerFilter, promiseStatusFilter, promiseSearchQuery, fulfilledPromiseIds]);

  // Group counts for group tabs
  const groupCounts = useMemo(() => {
    const counts: { [group: string]: number } = {};

    analyzedProjects.forEach(p => {
      const category = getCategoryForGroupTitle(p.groupTitle || "");
      if (category === "ARCHIVED") return;
      counts[category] = (counts[category] || 0) + 1;
    });

    return counts;
  }, [analyzedProjects]);

  // Filter projects by group tab & search
  const filteredProjectsByTab = useMemo(() => {
    let result = analyzedProjects;
    if (selectedGroupTab !== "ALL") {
      result = result.filter(p => {
        const cat = getCategoryForGroupTitle(p.groupTitle || "");
        return cat === selectedGroupTab;
      });
    }

    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.manager.name.toLowerCase().includes(q));
    }

    return result;
  }, [analyzedProjects, selectedGroupTab, searchFilter]);

  // PM Priority Operational Memos:
  // 1. At Risk Projects
  const atRiskProjectsList = useMemo(() => {
    return filteredProjectsByTab.filter(p => p.riskLevel === "Red");
  }, [filteredProjectsByTab]);

  // 2. Approaching or Missed Deadlines (<7 days or overdue)
  const closeToDeadlineProjectsList = useMemo(() => {
    const today = new Date();
    return filteredProjectsByTab.filter(p => {
      if (p.isOverdue || p.isInternalOverdue) return true;
      if (p.dueDate) {
        const clientDate = new Date(p.dueDate);
        const diffMs = clientDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }
      return false;
    });
  }, [filteredProjectsByTab]);

  // 3. Stale Projects (No meaningful update on Monday board in last 2 days)
  const staleProjects2DaysList = useMemo(() => {
    const today = new Date();
    return filteredProjectsByTab.filter(p => {
      const latestMeaningfulDateStr = getLatestMeaningfulUpdateDate(p);
      if (!latestMeaningfulDateStr) return true; // No meaningful update ever or only non-updates like "no updates"/"waiting"
      const lastDate = new Date(latestMeaningfulDateStr);
      const diffMs = today.getTime() - lastDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays >= 2;
    });
  }, [filteredProjectsByTab]);

  // 4. Unfulfilled PM Promises & Commitments
  const unfulfilledPromisesList = useMemo(() => {
    return detectedPromises.filter(p => p.status !== "FULFILLED");
  }, [detectedPromises]);

  // Flatten unreplied emails for Email SLA view
  const unrepliedEmailsList = useMemo(() => {
    const list: Array<{
      email: ProjectEmail;
      project: MappedProject;
      elapsedHours: number;
      slaClockText: string;
      reason: string;
    }> = [];

    filteredProjectsByTab.forEach(p => {
      if (activeManagerFilter && p.manager.name !== activeManagerFilter) return;

      (p.emails || []).forEach(e => {
        if (!e.isResponded) {
          const elapsed = getElapsedWorkingHours(e.receivedAt);
          const mins = Math.round(elapsed * 60);
          let clockText = `${mins}m`;
          if (mins >= 60) {
            const hrs = Math.floor(mins / 60);
            const remMins = mins % 60;
            clockText = remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
          }

          let reason = "Client question or confirmation needed";
          if (e.subject.toLowerCase().includes("invoice") || e.subject.toLowerCase().includes("pricing")) {
            reason = "Commercial or delivery request";
          } else if (e.subject.toLowerCase().includes("outstanding") || e.subject.toLowerCase().includes("status")) {
            reason = "Client asked for an update or reply";
          } else if (e.subject.toLowerCase().includes("presentation") || e.subject.toLowerCase().includes("work")) {
            reason = "Project work request";
          }

          list.push({
            email: e,
            project: p,
            elapsedHours: elapsed,
            slaClockText: clockText,
            reason
          });
        }
      });
    });

    return list.sort((a, b) => b.elapsedHours - a.elapsedHours);
  }, [filteredProjectsByTab, activeManagerFilter]);

  // Projects filtered specifically for Risk Queue table
  const projectsForRiskQueue = useMemo(() => {
    if (pmPriorityFocusTab === "RISK") return atRiskProjectsList;
    if (pmPriorityFocusTab === "DEADLINE") return closeToDeadlineProjectsList;
    if (pmPriorityFocusTab === "STALE") return staleProjects2DaysList;
    if (pmPriorityFocusTab === "PROMISE") {
      const promiseProjectIds = new Set(unfulfilledPromisesList.map(p => p.projectId));
      return filteredProjectsByTab.filter(p => promiseProjectIds.has(p.id));
    }

    if (riskLevelTab === "RED") return filteredProjectsByTab.filter(p => p.riskLevel === "Red");
    if (riskLevelTab === "AMBER") return filteredProjectsByTab.filter(p => p.riskLevel === "Amber");
    if (riskLevelTab === "GREEN") return filteredProjectsByTab.filter(p => p.riskLevel === "Green");
    return filteredProjectsByTab;
  }, [filteredProjectsByTab, pmPriorityFocusTab, riskLevelTab, atRiskProjectsList, closeToDeadlineProjectsList, staleProjects2DaysList, unfulfilledPromisesList]);

  // Action board items
  const actionBoardItems = useMemo(() => {
    const actions: Array<{
      id: string;
      project: MappedProject;
      owner: string;
      priority: "HIGH" | "URGENT" | "MEDIUM";
      problem: string;
      actionRequired: string;
      dueTodayBy: string;
      status: string;
    }> = [];

    filteredProjectsByTab.forEach(p => {
      if (p.riskLevel === "Red") {
        actions.push({
          id: `act-${p.id}-1`,
          project: p,
          owner: p.manager.name || "Unassigned",
          priority: "URGENT",
          problem: p.riskReasons[0] || "Overdue delivery date or breached email SLA",
          actionRequired: p.riskActions[0] || "Update status in Monday & send client progress email",
          dueTodayBy: "17:00",
          status: "PENDING"
        });
      } else if (p.hasActiveSlaBreach) {
        actions.push({
          id: `act-${p.id}-2`,
          project: p,
          owner: p.manager.name || "Unassigned",
          priority: "HIGH",
          problem: "Unresponded client email past 4-hour SLA",
          actionRequired: "Reply to client inquiry or log phone update",
          dueTodayBy: "15:00",
          status: "IN PROGRESS"
        });
      }
    });

    return actions;
  }, [filteredProjectsByTab]);

  // Compute counts for PM Morning Command briefing
  const redCount = useMemo(() => filteredProjectsByTab.filter(p => p.riskLevel === "Red").length, [filteredProjectsByTab]);
  const missingDeadlineCount = useMemo(() => filteredProjectsByTab.filter(p => p.isOverdue || p.isInternalOverdue).length, [filteredProjectsByTab]);
  const overduePromisesCount = useMemo(() => detectedPromises.filter(p => p.isOverdue && p.status !== "FULFILLED").length, [detectedPromises]);

  // Handle open draft modal
  const handleOpenDraftModal = (promise: PmPromise) => {
    setSelectedPromiseForDraft(promise);
    setDraftReplyText(
      `Hi ${promise.clientEmail ? promise.clientEmail.split("@")[0] : "there"},\n\n` +
      `I am following up directly regarding our commitment on ${promise.projectName}.\n` +
      `Regarding: "${promise.promiseSummary}" - we have prepared the requested updates and are ready to review.\n\n` +
      `Please let me know if you would like to hop on a quick 5-minute call or if I should send the documents over right now.\n\n` +
      `Best regards,\n${promise.managerName}\nTypeTheta Delivery Team`
    );
  };

  // Generate Daily PM Standup Briefing Text
  const dailyBriefingText = useMemo(() => {
    const pmName = activeManagerFilter || "All Project Managers";
    return (
      `# 📋 TypeTheta Daily PM Standup & Risk Briefing\n` +
      `**Target PM**: ${pmName}\n` +
      `**Date**: ${todayStr} | **SLA Status**: Active 4-Hour Response Clock\n\n` +
      `--- \n\n` +
      `### 🚨 1. High Risk & Overdue Projects (${redCount} Projects)\n` +
      analyzedProjects.filter(p => p.riskLevel === "Red").slice(0, 5).map(p => 
        `- **${p.name}** (PM: ${p.manager.name})\n` +
        `  - *Risk Cause*: ${p.riskReasons.join(" • ")}\n` +
        `  - *Required Action*: ${p.riskActions[0] || "Update Monday board & email client"}\n`
      ).join("") +
      `\n### ✉️ 2. Unresponded Client Emails (${unrepliedEmailsList.length} Pending)\n` +
      unrepliedEmailsList.slice(0, 4).map(item => 
        `- **${item.project.name}** | From: \`${item.email.sender}\` (Clock: ${item.slaClockText})\n` +
        `  - *Subject*: "${item.email.subject}"\n`
      ).join("") +
      `\n### 🤝 3. Overdue Commitments & Promises (${overduePromisesCount} Flagged)\n` +
      detectedPromises.filter(p => p.isOverdue && p.status !== "FULFILLED").slice(0, 4).map(p => 
        `- **${p.projectName}** (PM: ${p.managerName})\n` +
        `  - *Commitment*: "${p.promiseSummary}"\n` +
        `  - *Target Time*: ${p.promisedDate}\n`
      ).join("") +
      `\n---\n*Generated automatically by TypeTheta Operations Engine.*`
    );
  }, [activeManagerFilter, todayStr, redCount, analyzedProjects, unrepliedEmailsList, overduePromisesCount, detectedPromises]);

  // Render view header title
  const renderViewHeaderTitle = () => {
    switch (activeMenu) {
      case "action_board":
        return "Today's Action Board";
      case "promise_tracker":
        return "Promise & Commitment Tracker";
      case "risk_queue":
      case "risk":
        return "Risk Queue & Red Flags";
      case "internal_flags":
        return "Internal Target Flags";
      case "email_sla":
      case "sla":
        return "Unreplied Emails & Email SLA";
      case "followup_queue":
        return "Client Follow-Up Queue";
      case "managers":
      case "manager":
        return "Managers Workload & Accountability";
      case "missing_data":
        return "Missing Board Data Audit";
      case "wiki":
        return "TypeTheta Operations Wiki & Rules";
      case "founder":
      default:
        return "Team Command Hub";
    }
  };

  return (
    <div className="flex flex-col gap-6 text-gray-900 font-sans" id="typetheta-dashboard-root">
      
      {/* TOP HEADER & BRANDING BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <TypeThetaLogo height={34} />
          <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-gray-950 font-sans">
                {renderViewHeaderTitle()}
              </h1>
              <span className="text-[10px] bg-amber-50 text-amber-900 px-2.5 py-0.5 rounded-full font-extrabold border border-amber-200/80">
                TypeTheta Live OS
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 font-medium flex items-center gap-2 flex-wrap">
              <span>Live Monday API & Email SLA stream •</span>
              <span
                className={`inline-flex items-center gap-1.5 font-mono font-bold px-2.5 py-0.5 rounded-md border transition-all duration-700 ease-in-out ${
                  isRecentlySynced
                    ? "bg-emerald-100 text-emerald-950 border-emerald-300 shadow-sm scale-[1.02]"
                    : "bg-emerald-50 text-emerald-900 border-emerald-200/90"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full transition-colors duration-500 ${
                    isRecentlySynced ? "bg-emerald-500 animate-ping" : "bg-emerald-500 animate-pulse"
                  }`}
                ></span>
                <span className="font-sans font-bold">Real-Time Sync</span>
                <motion.span
                  key={lastSyncedAt ? lastSyncedAt.getTime() : "synced"}
                  initial={{ opacity: 0.2, y: -2, color: "#10b981" }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    color: isRecentlySynced ? "#047857" : "#047857",
                  }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className={`text-[10px] font-mono ml-0.5 transition-colors duration-500 ${
                    isRecentlySynced ? "text-emerald-700 font-black" : "text-emerald-700/90 font-medium"
                  }`}
                >
                  (Last Synced: {lastSyncedAt ? lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : new Date().toLocaleTimeString()})
                </motion.span>
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          {/* Manual Live Refresh Button */}
          {onRefreshLiveBoard && (
            <button
              onClick={onRefreshLiveBoard}
              disabled={isSyncing}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Force immediate real-time sync with Monday API"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing..." : "Sync Live Now"}</span>
            </button>
          )}

          {/* Manual API Key Connection Settings Button */}
          {onShowConfig && (
            <button
              onClick={onShowConfig}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-extrabold px-3 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border border-slate-700"
              title="Manually connect Monday Board via API Key and Board ID"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Connect Board</span>
            </button>
          )}

          {/* Invite Observer Share Link Button */}
          {onOpenInviteModal && (
            <button
              onClick={onOpenInviteModal}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-3 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              title="Copy or share Observer invite link for read-only view"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Invite Link</span>
            </button>
          )}

          {/* Daily Standup Generator Button */}
          <button
            onClick={() => setIsBriefingModalOpen(true)}
            className="text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border border-amber-400/50"
            title="Generate instant daily PM standup summary"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-950" />
            <span>PM Standup</span>
          </button>

          {/* 2FA Security Button */}
          {currentUser && onOpen2FaModal && (
            <button
              onClick={onOpen2FaModal}
              className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold px-3 py-2 rounded-xl border border-purple-200 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Manage Two-Factor Authentication (2FA / MFA)"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
              <span>2FA Security</span>
            </button>
          )}

          {/* User Profile / Portal Login */}
          {currentUser ? (
            <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-xl text-white shadow-xs">
              <div className={`w-5 h-5 rounded-full ${currentUser.avatarBg || 'bg-purple-600'} text-white font-extrabold text-[10px] flex items-center justify-center shrink-0`}>
                {currentUser.name.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-slate-100 text-xs leading-tight">{currentUser.name}</span>
                <span className={`text-[9px] font-bold ${currentUser.role === 'Observer' ? 'text-amber-400' : 'text-indigo-300'}`}>
                  {currentUser.role === 'Observer' ? 'Observer (Read Only)' : 'Project Manager'}
                </span>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="ml-1 text-[11px] bg-rose-950/80 hover:bg-rose-900 text-rose-200 font-bold px-2 py-1 rounded-lg border border-rose-800 transition-all flex items-center gap-1 cursor-pointer"
                  title="Log out from portal"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : (
            onOpenAuthModal && (
              <button
                onClick={onOpenAuthModal}
                className="text-xs bg-[#6161FF] hover:bg-[#5050e6] text-white font-bold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Portal Log In</span>
              </button>
            )
          )}

          {onShowConfig && (
            <button
              onClick={onShowConfig}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-gray-300"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Settings
            </button>
          )}
        </div>
      </div>

      {/* FILTER BY PROJECT MANAGERS - GLOBAL PM SELECTOR BAR */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-md text-white flex flex-col gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-extrabold tracking-wider text-slate-200 uppercase">
              Filter Dashboard By Project Manager
            </span>
          </div>
          {activeManagerFilter && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-300 font-medium">
                Filtering by: <strong className="text-white font-bold">{activeManagerFilter}</strong>
              </span>
              <button
                onClick={() => handleManagerSelect(null)}
                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-2.5 py-1 rounded-lg border border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Show All PMs
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => handleManagerSelect(null)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              !activeManagerFilter
                ? "bg-[#e59a35] text-slate-950 shadow-md font-black"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700"
            }`}
          >
            <span>⚡ All Managers</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${!activeManagerFilter ? "bg-slate-950 text-amber-300 font-bold" : "bg-slate-900 text-slate-400"}`}>
              {rawAnalyzedProjects.length}
            </span>
          </button>

          {uniqueManagersList.map(mgr => {
            const isSelected = activeManagerFilter === mgr.name;
            return (
              <button
                key={mgr.name}
                onClick={() => handleManagerSelect(mgr.name)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  isSelected
                    ? "bg-[#e59a35] text-slate-950 shadow-md font-black"
                    : "bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/80"
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-slate-700 text-white text-[9px] flex items-center justify-center font-extrabold ${isSelected ? "bg-slate-950 text-amber-300" : ""}`}>
                  {mgr.name.charAt(0)}
                </div>
                <span>{mgr.name}</span>
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${isSelected ? "bg-slate-950 text-amber-300 font-bold" : "bg-slate-900 text-slate-300"}`}>
                    {mgr.totalProjects}
                  </span>
                  {mgr.redCount > 0 && (
                    <span className="text-[9px] bg-rose-600 text-white font-extrabold px-1.5 py-0.2 rounded-full animate-pulse">
                      {mgr.redCount} red
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CORE PM LIFE SIMPLIFIER: PM MORNING COMMAND BRIEFING */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-150 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-extrabold text-gray-950 tracking-tight">
                PM Morning Action Center
              </h2>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Instant operational focus for PMs: At-risk projects, overdue deadlines, and pending email SLAs.
            </p>
          </div>
          <span className="text-xs bg-slate-100 text-slate-700 font-bold px-3 py-1 rounded-full border border-slate-200 self-start sm:self-auto font-mono">
            {analyzedProjects.length} projects analyzed
          </span>
        </div>

        {/* 4 Main Action Briefing Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* Card 1: Projects At Risk */}
          <div 
            onClick={() => {
              setPmPriorityFocusTab("RISK");
              onSelectMenu("risk_queue");
            }}
            className={`bg-gradient-to-br from-rose-50/90 via-white to-rose-50/30 border p-6 rounded-2xl shadow-xs transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between min-h-[140px] ${
              pmPriorityFocusTab === "RISK" ? "border-rose-500 ring-4 ring-rose-500/15 bg-rose-50" : "border-rose-200/90 hover:border-rose-300"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-rose-800 uppercase tracking-wider block">1. At Risk Projects</span>
              <div className="p-2 bg-rose-100 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-4xl font-black text-rose-700 font-mono tracking-tight">{atRiskProjectsList.length}</span>
              <span className="text-xs font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full">Needs review today</span>
            </div>
            <p className="text-xs text-rose-900/80 font-medium mt-2 leading-snug">
              High risk flags, SLA breaches, or missed critical targets
            </p>
          </div>

          {/* Card 2: Close to Deadlines */}
          <div 
            onClick={() => {
              setPmPriorityFocusTab("DEADLINE");
              onSelectMenu("risk_queue");
            }}
            className={`bg-gradient-to-br from-amber-50/90 via-white to-amber-50/30 border p-6 rounded-2xl shadow-xs transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between min-h-[140px] ${
              pmPriorityFocusTab === "DEADLINE" ? "border-amber-500 ring-4 ring-amber-500/15 bg-amber-50" : "border-amber-200/90 hover:border-amber-300"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-amber-900 uppercase tracking-wider block">2. Close To Deadlines</span>
              <div className="p-2 bg-amber-100 rounded-xl">
                <Calendar className="w-5 h-5 text-amber-700" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-4xl font-black text-amber-800 font-mono tracking-tight">{closeToDeadlineProjectsList.length}</span>
              <span className="text-xs font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">Target &lt;= 7 days</span>
            </div>
            <p className="text-xs text-amber-900/80 font-medium mt-2 leading-snug">
              Client deadline within 7 days or overdue delivery date
            </p>
          </div>

          {/* Card 3: Stale Projects (No update in 2 days) */}
          <div 
            onClick={() => {
              setPmPriorityFocusTab("STALE");
              onSelectMenu("risk_queue");
            }}
            className={`bg-gradient-to-br from-indigo-50/90 via-white to-indigo-50/30 border p-6 rounded-2xl shadow-xs transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between min-h-[140px] ${
              pmPriorityFocusTab === "STALE" ? "border-indigo-500 ring-4 ring-indigo-500/15 bg-indigo-50" : "border-indigo-200/90 hover:border-indigo-300"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-indigo-900 uppercase tracking-wider block">3. Stale (No Update &gt;2 Days)</span>
              <div className="p-2 bg-indigo-100 rounded-xl">
                <Clock className="w-5 h-5 text-indigo-700" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-4xl font-black text-indigo-700 font-mono tracking-tight">{staleProjects2DaysList.length}</span>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full">Pending update</span>
            </div>
            <p className="text-xs text-indigo-900/80 font-medium mt-2 leading-snug">
              No Monday status update posted in the last 2 days
            </p>
          </div>

          {/* Card 4: Unfulfilled PM Promises */}
          <div 
            onClick={() => {
              setPmPriorityFocusTab("PROMISE");
              onSelectMenu("risk_queue");
            }}
            className={`bg-gradient-to-br from-purple-50/90 via-white to-purple-50/30 border p-6 rounded-2xl shadow-xs transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between min-h-[140px] ${
              pmPriorityFocusTab === "PROMISE" ? "border-purple-500 ring-4 ring-purple-500/15 bg-purple-50" : "border-purple-200/90 hover:border-purple-300"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-purple-900 uppercase tracking-wider block">4. Unfulfilled PM Promises</span>
              <div className="p-2 bg-purple-100 rounded-xl">
                <Handshake className="w-5 h-5 text-purple-700" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-4xl font-black text-purple-800 font-mono tracking-tight">{unfulfilledPromisesList.length}</span>
              <span className="text-xs font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-full">PM commitments</span>
            </div>
            <p className="text-xs text-purple-900/80 font-medium mt-2 leading-snug">
              Client email or update promised follow-up not yet fulfilled
            </p>
          </div>

        </div>
      </div>

      {/* Group Filter Tabs (Horizontal Pill Cards) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => {
            setSelectedGroupTab("ALL");
          }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all shrink-0 cursor-pointer ${
            selectedGroupTab === "ALL"
              ? "bg-slate-900 text-white border-slate-950 shadow-sm ring-2 ring-slate-900/20"
              : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200"
          }`}
        >
          <span className="uppercase text-[10px] tracking-wider">⚡ ALL GROUPS</span>
          <span className={`text-[11px] font-mono font-black px-1.5 py-0.2 rounded ${
            selectedGroupTab === "ALL" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-800"
          }`}>
            {analyzedProjects.length}
          </span>
        </button>

        {Object.entries(groupCounts).map(([groupName, count]) => {
          const isSelected = selectedGroupTab === groupName;
          return (
            <button
              key={groupName}
              onClick={() => {
                const nextTab = isSelected ? "ALL" : groupName;
                setSelectedGroupTab(nextTab);
                if (nextTab !== "ALL") {
                  setRiskLevelTab("ALL");
                }
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? "bg-slate-900 text-white border-slate-950 shadow-sm ring-2 ring-slate-900/20"
                  : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200"
              }`}
            >
              <span className="uppercase text-[10px] tracking-wider">{groupName}</span>
              <span className={`text-[11px] font-mono font-black px-1.5 py-0.2 rounded ${
                isSelected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-800"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* MAIN VIEW CONTENT SWITCHER */}

      {/* VIEW A: Founder Morning Command Hub / Risk Queue */}
      {(activeMenu === "founder" || activeMenu === "risk_queue" || activeMenu === "risk") && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-950 flex items-center gap-2">
                Red Risks Queue & Monitor
              </h2>
              <p className="text-xs text-gray-500 font-medium">Projects flagged for missed deadlines, stale Monday updates, or active SLA breaches.</p>
            </div>

            <div className="flex items-center gap-3">
              {/* Layout Mode Toggle Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                <button
                  onClick={() => setSectionViewMode("grid")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    sectionViewMode === "grid" ? "bg-white text-slate-900 shadow-2xs border border-slate-200" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-current" />
                  Grid Boxes
                </button>
                <button
                  onClick={() => setSectionViewMode("table")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    sectionViewMode === "table" ? "bg-white text-slate-900 shadow-2xs border border-slate-200" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <List className="w-3.5 h-3.5 text-current" />
                  Table
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {[
                  { id: "ALL", label: "⚡ All Priority Flags", count: atRiskProjectsList.length + closeToDeadlineProjectsList.length + staleProjects2DaysList.length + unfulfilledPromisesList.length, color: "text-slate-700 bg-slate-50 border-slate-200" },
                  { id: "RISK", label: "🔴 Red Risks", count: atRiskProjectsList.length, color: "text-rose-700 bg-rose-50 border-rose-200" },
                  { id: "DEADLINE", label: "⏳ Deadlines", count: closeToDeadlineProjectsList.length, color: "text-amber-700 bg-amber-50 border-amber-200" },
                  { id: "STALE", label: "💤 Stale (>2 Days)", count: staleProjects2DaysList.length, color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
                  { id: "PROMISE", label: "🤝 PM Promises", count: unfulfilledPromisesList.length, color: "text-purple-700 bg-purple-50 border-purple-200" },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setPmPriorityFocusTab(tab.id as any);
                      if (tab.id === "ALL") setRiskLevelTab("ALL");
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border ${
                      pmPriorityFocusTab === tab.id
                        ? "bg-slate-900 text-white border-slate-950 shadow-xs"
                        : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[10px] font-mono font-extrabold px-1.5 py-0.2 rounded border ${
                      pmPriorityFocusTab === tab.id ? "bg-white/20 text-white border-white/10" : tab.color
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {sectionViewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {projectsForRiskQueue.length === 0 ? (
                <div className="col-span-full bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-500 text-xs italic shadow-xs">
                  No projects currently found matching the selected PM priority focus filter.
                </div>
              ) : (
                projectsForRiskQueue.map((p) => {
                  const managerName = p.manager.name || "Unassigned";

                  return (
                    <div 
                      key={p.id}
                      className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 group"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block font-mono bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200 w-max">
                            {p.groupTitle || "ONE OFF PROJECT"}
                          </span>
                          <h3 
                            className="text-base font-extrabold text-slate-900 mt-2 line-clamp-2 cursor-pointer group-hover:text-[#6161FF] transition-colors"
                            onClick={() => onSelectProject(p)}
                          >
                            {p.name}
                          </h3>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shrink-0 shadow-2xs ${
                          p.riskLevel === "Red"
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : p.riskLevel === "Amber"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        }`}>
                          {p.riskLevel} Risk
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl text-xs">
                        <div>
                          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">PM Owner</span>
                          <span className="font-extrabold text-slate-800 mt-0.5 block truncate">{managerName}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Client Target</span>
                          <span className="font-extrabold text-slate-800 mt-0.5 block font-mono">{p.dueDate || "Not Set"}</span>
                        </div>
                      </div>

                      <div className="bg-rose-50/70 border border-rose-200/80 p-3.5 rounded-xl text-xs text-rose-950 space-y-1">
                        <strong className="font-extrabold block text-rose-800 uppercase tracking-wider text-[10px]">Identified Issues:</strong>
                        <p className="font-medium leading-relaxed">{p.riskReasons.join(" • ") || "Project is healthy and on track."}</p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <button
                          onClick={() => {
                            setQuickUpdateModalProject(p);
                            setQuickUpdateText("");
                            setQuickUpdateSuccessMsg("");
                          }}
                          className="text-xs bg-[#6161FF] hover:bg-[#5050e6] text-white font-extrabold px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                        >
                          <PenSquare className="w-3.5 h-3.5 text-white" />
                          <span>Post Quick Update</span>
                        </button>
                        <button
                          onClick={() => onSelectProject(p)}
                          className="text-xs font-extrabold text-slate-500 hover:text-[#6161FF] hover:underline cursor-pointer inline-flex items-center gap-1"
                        >
                          View Details &rarr;
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="py-3.5 px-4 w-1/5">PROJECT / GROUP</th>
                      <th className="py-3.5 px-3 w-20">STATUS</th>
                      <th className="py-3.5 px-3 w-1/5">PM OWNER</th>
                      <th className="py-3.5 px-4 w-2/5">IDENTIFIED ISSUE & REASON</th>
                      <th className="py-3.5 px-3 text-right w-36">QUICK PM ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {projectsForRiskQueue.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-gray-500 font-medium">
                          No projects currently found matching the selected PM priority focus filter.
                        </td>
                      </tr>
                    ) : (
                      projectsForRiskQueue.map((p) => {
                        const managerName = p.manager.name || "Unassigned";

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-4 px-4 align-top">
                              <span className="font-bold text-gray-950 block text-xs hover:text-[#6161FF] cursor-pointer" onClick={() => onSelectProject(p)}>
                                {p.name}
                              </span>
                              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mt-1">
                                {p.groupTitle || "ONE OFF PROJECT"}
                              </span>
                            </td>

                            <td className="py-4 px-3 align-top">
                              <span className={`inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider ${
                                p.riskLevel === "Red"
                                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                                  : p.riskLevel === "Amber"
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              }`}>
                                {p.riskLevel}
                              </span>
                            </td>

                            <td className="py-4 px-3 align-top text-gray-800 font-medium">
                              {managerName}
                            </td>

                            <td className="py-4 px-4 align-top text-gray-700 leading-relaxed text-[11px]">
                              <div className="flex flex-col gap-1.5">
                                <div>
                                  <strong className="text-gray-950 font-bold">Identified Issues: </strong>
                                  <span>{p.riskReasons.join(" • ") || "Project is healthy and on track."}</span>
                                </div>
                                <div className="text-gray-500 text-[10.5px]">
                                  <strong className="text-gray-700">Client Target: </strong>
                                  <span className="font-mono">{p.dueDate || "Not Set"}</span> | Internal: <span className="font-mono">{p.internalDueDate || "Not Set"}</span>
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-3 align-top text-right">
                              <div className="flex flex-col gap-1.5 items-end">
                                <button
                                  onClick={() => {
                                    setQuickUpdateModalProject(p);
                                    setQuickUpdateText("");
                                    setQuickUpdateSuccessMsg("");
                                  }}
                                  className="text-[10.5px] bg-[#6161FF] hover:bg-[#5050e6] text-white font-extrabold px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-1 shrink-0 whitespace-nowrap"
                                  title="Post status update directly to refresh project timestamp"
                                >
                                  <PenSquare className="w-3 h-3 text-white" />
                                  <span>Post Quick Update</span>
                                </button>
                                <button
                                  onClick={() => onSelectProject(p)}
                                  className="text-[10.5px] font-bold text-gray-500 hover:text-[#6161FF] hover:underline cursor-pointer inline-flex items-center gap-0.5"
                                >
                                  View Details &rarr;
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW B: Promise Tracker (AI Commitment Engine) */}
      {activeMenu === "promise_tracker" && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Handshake className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-bold text-gray-950">
                  AI Promise & Commitment Tracker
                </h2>
                <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-200">
                  AI Auto Detected
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                AI parses project messages and client emails to identify promises PMs made to clients, preventing broken trust.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Layout Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                <button
                  onClick={() => setSectionViewMode("grid")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    sectionViewMode === "grid" ? "bg-white text-slate-900 shadow-2xs border border-slate-200" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-current" />
                  Grid Boxes
                </button>
                <button
                  onClick={() => setSectionViewMode("table")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    sectionViewMode === "table" ? "bg-white text-slate-900 shadow-2xs border border-slate-200" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <List className="w-3.5 h-3.5 text-current" />
                  Table
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search promises..."
                  value={promiseSearchQuery}
                  onChange={(e) => setPromiseSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#6161FF]"
                />
              </div>
            </div>
          </div>

          {/* Filter Status Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: "ALL", label: "All Promises", count: detectedPromises.length },
              { id: "OVERDUE", label: "🔴 Overdue Promises", count: detectedPromises.filter(p => p.status === "OVERDUE").length },
              { id: "PENDING_TODAY", label: "🟡 Due Today", count: detectedPromises.filter(p => p.status === "PENDING_TODAY").length },
              { id: "FULFILLED", label: "🟢 Kept / Fulfilled", count: detectedPromises.filter(p => p.status === "FULFILLED").length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setPromiseStatusFilter(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  promiseStatusFilter === tab.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                <span>{tab.label}</span>
                <span className="ml-1.5 font-mono text-[10px] opacity-80">({tab.count})</span>
              </button>
            ))}
          </div>

          {sectionViewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {detectedPromises.length === 0 ? (
                <div className="col-span-full bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-500 text-xs italic shadow-xs">
                  No AI promises detected matching the current criteria.
                </div>
              ) : (
                detectedPromises.map((p) => {
                  const isFulfilled = p.status === "FULFILLED";

                  return (
                    <div 
                      key={p.id} 
                      className={`bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 ${
                        isFulfilled ? "opacity-60 bg-slate-50/50" : ""
                      }`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block font-mono">
                            PM Owner: <strong className="text-slate-800">{p.managerName}</strong>
                          </span>
                          <h3 
                            className="text-base font-extrabold text-slate-900 mt-1 cursor-pointer hover:text-[#6161FF] transition-colors truncate"
                            onClick={() => {
                              const projectObj = projects.find(item => item.id === p.projectId);
                              if (projectObj) onSelectProject(projectObj);
                            }}
                          >
                            {p.projectName}
                          </h3>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shrink-0 shadow-2xs ${
                          p.status === "OVERDUE"
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : p.status === "PENDING_TODAY"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        }`}>
                          {p.status === "OVERDUE" ? "Overdue" : p.status === "PENDING_TODAY" ? "Due Today" : "Fulfilled"}
                        </span>
                      </div>

                      <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl space-y-2">
                        <p className="font-extrabold text-slate-900 text-xs leading-relaxed">
                          "{p.promiseSummary}"
                        </p>
                        <p className="text-xs text-slate-600 italic bg-white p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
                          Excerpt: {p.sourceExcerpt}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                        <span className="font-mono font-extrabold text-slate-700 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                          Promised: {p.promisedDate}
                        </span>
                        <div className="flex items-center gap-2">
                          {!isFulfilled && (
                            <button
                              onClick={() => handleOpenDraftModal(p)}
                              className="text-xs bg-indigo-50 hover:bg-indigo-100 text-[#6161FF] font-extrabold px-3 py-1.5 rounded-xl border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                              title="Generate 1-click AI reply"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[#6161FF]" />
                              <span>AI Reply</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setFulfilledPromiseIds(prev => {
                                const next = new Set(prev);
                                if (next.has(p.id)) next.delete(p.id);
                                else next.add(p.id);
                                return next;
                              });
                            }}
                            className={`text-xs font-extrabold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                              isFulfilled
                                ? "bg-gray-100 text-gray-600 border-gray-200"
                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {isFulfilled ? "Reopen" : "Fulfill"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="py-3.5 px-4 w-1/4">PROJECT & PM</th>
                      <th className="py-3.5 px-3 w-28">COMMITMENT STATUS</th>
                      <th className="py-3.5 px-4 w-2/5">DETECTED PROMISE SUMMARY</th>
                      <th className="py-3.5 px-3 w-32">PROMISED TIME</th>
                      <th className="py-3.5 px-3 text-right w-36">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {detectedPromises.map((p) => {
                      const isFulfilled = p.status === "FULFILLED";

                      return (
                        <tr key={p.id} className={`hover:bg-gray-50/80 transition-colors ${isFulfilled ? "opacity-60 bg-gray-50/40" : ""}`}>
                          <td className="py-4 px-4 align-top">
                            <span className="font-bold text-gray-950 block text-xs hover:text-[#6161FF] cursor-pointer" onClick={() => {
                              const projectObj = projects.find(item => item.id === p.projectId);
                              if (projectObj) onSelectProject(projectObj);
                            }}>
                              {p.projectName}
                            </span>
                            <span className="text-[10px] text-gray-500 font-semibold block mt-0.5">
                              PM Owner: <strong className="text-gray-800">{p.managerName}</strong>
                            </span>
                          </td>

                          <td className="py-4 px-3 align-top">
                            <span className={`inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider ${
                              p.status === "OVERDUE"
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : p.status === "PENDING_TODAY"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            }`}>
                              {p.status === "OVERDUE" ? "Overdue" : p.status === "PENDING_TODAY" ? "Due Today" : "Fulfilled"}
                            </span>
                          </td>

                          <td className="py-4 px-4 align-top leading-relaxed">
                            <p className="font-semibold text-gray-900 text-xs">
                              "{p.promiseSummary}"
                            </p>
                            <p className="text-[10.5px] text-gray-500 italic mt-1 bg-gray-50 p-2 rounded border border-gray-200/60">
                              Excerpt: {p.sourceExcerpt}
                            </p>
                          </td>

                          <td className="py-4 px-3 align-top font-mono font-bold text-gray-800 text-[11px]">
                            {p.promisedDate}
                          </td>

                          <td className="py-4 px-3 align-top text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isFulfilled && (
                                <button
                                  onClick={() => handleOpenDraftModal(p)}
                                  className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-[#6161FF] font-extrabold px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                                  title="Generate 1-click AI reply"
                                >
                                  <Sparkles className="w-3 h-3 text-[#6161FF]" />
                                  <span>AI Reply</span>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setFulfilledPromiseIds(prev => {
                                    const next = new Set(prev);
                                    if (next.has(p.id)) next.delete(p.id);
                                    else next.add(p.id);
                                    return next;
                                  });
                                }}
                                className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                                  isFulfilled
                                    ? "bg-gray-100 text-gray-600 border-gray-200"
                                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                                }`}
                              >
                                {isFulfilled ? "Reopen" : "Fulfill"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW C: Email SLA View */}
      {(activeMenu === "email_sla" || activeMenu === "sla") && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-950">
                  Unreplied Emails & SLA Desk
                </h2>
                <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono">
                  SLA Target: {riskConfig?.slaHoursLimit ?? 4}h
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-0.5">Client emails pending response evaluated against strict working hour limits.</p>
            </div>

            <div className="flex items-center gap-3">
              {/* Layout Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                <button
                  onClick={() => setSectionViewMode("grid")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    sectionViewMode === "grid" ? "bg-white text-slate-900 shadow-2xs border border-slate-200" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-current" />
                  Grid Boxes
                </button>
                <button
                  onClick={() => setSectionViewMode("table")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    sectionViewMode === "table" ? "bg-white text-slate-900 shadow-2xs border border-slate-200" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <List className="w-3.5 h-3.5 text-current" />
                  Table
                </button>
              </div>

              <span className="bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold px-3 py-1 rounded-full font-mono">
                {unrepliedEmailsList.length} unreplied emails
              </span>
            </div>
          </div>

          {sectionViewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {unrepliedEmailsList.length === 0 ? (
                <div className="col-span-full bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-500 text-xs italic shadow-xs">
                  No unreplied client emails pending SLA response.
                </div>
              ) : (
                unrepliedEmailsList.map((item, idx) => (
                  <div key={item.email.id || idx} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block font-mono">
                          Sender: <strong className="text-slate-800">{item.email.sender}</strong>
                        </span>
                        <h3 
                          className="text-base font-extrabold text-slate-900 mt-1 cursor-pointer hover:text-[#6161FF] transition-colors"
                          onClick={() => onSelectProject(item.project, "emails")}
                        >
                          {item.email.subject}
                        </h3>
                      </div>
                      <span className="bg-rose-100 text-rose-900 px-3 py-1 rounded-full text-xs font-black font-mono border border-rose-200 shrink-0 shadow-2xs">
                        ⏱ {item.slaClockText}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">PM Owner</span>
                        <span className="font-extrabold text-slate-800 mt-0.5 block truncate">{item.project.manager.name}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Received</span>
                        <span className="font-extrabold text-slate-800 mt-0.5 block font-mono">
                          {new Date(item.email.receivedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>

                    <div className="bg-amber-50/80 border border-amber-200/80 p-3.5 rounded-xl text-xs text-amber-950 font-medium leading-relaxed">
                      {item.reason}
                    </div>

                    <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                      <button
                        onClick={() => onSelectProject(item.project, "emails")}
                        className="text-xs bg-[#6161FF] hover:bg-[#5050e6] text-white font-extrabold px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                      >
                        <span>Open & Respond to Email &rarr;</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="py-3.5 px-4 w-1/4">PROJECT / SUBJECT</th>
                      <th className="py-3.5 px-3 w-1/5">CLIENT SENDER</th>
                      <th className="py-3.5 px-3 w-1/5">PM OWNER</th>
                      <th className="py-3.5 px-3 w-32">SLA CLOCK</th>
                      <th className="py-3.5 px-4 w-1/4">SUMMARY</th>
                      <th className="py-3.5 px-3 text-right w-24">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {unrepliedEmailsList.map((item, idx) => (
                      <tr key={item.email.id || idx} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-4 px-4 align-top">
                          <span className="font-bold text-gray-950 block text-xs hover:text-[#6161FF] cursor-pointer" onClick={() => onSelectProject(item.project, "emails")}>
                            {item.email.subject}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400 block mt-0.5">
                            Received: {new Date(item.email.receivedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>

                        <td className="py-4 px-3 align-top font-semibold text-gray-900">
                          {item.email.sender}
                        </td>

                        <td className="py-4 px-3 align-top font-medium text-gray-800">
                          {item.project.manager.name}
                        </td>

                        <td className="py-4 px-3 align-top font-mono font-bold text-rose-700">
                          <span className="bg-rose-100 text-rose-900 px-2 py-0.5 rounded text-xs border border-rose-200">
                            ⏱ {item.slaClockText}
                          </span>
                        </td>

                        <td className="py-4 px-4 align-top text-gray-600 font-medium">
                          {item.reason}
                        </td>

                        <td className="py-4 px-3 align-top text-right">
                          <button
                            onClick={() => onSelectProject(item.project, "emails")}
                            className="text-[11px] font-bold text-[#6161FF] hover:underline cursor-pointer inline-flex items-center gap-0.5"
                          >
                            Open email &rarr;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW D: Today's Action Board */}
      {activeMenu === "action_board" && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-950">
                Today's Action Board
              </h2>
              <p className="text-xs text-gray-500 font-medium">Action items requiring immediate PM intervention before end of day.</p>
            </div>

            <div className="flex items-center gap-3">
              {/* Layout Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                <button
                  onClick={() => setSectionViewMode("grid")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    sectionViewMode === "grid" ? "bg-white text-slate-900 shadow-2xs border border-slate-200" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-current" />
                  Grid Boxes
                </button>
                <button
                  onClick={() => setSectionViewMode("table")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    sectionViewMode === "table" ? "bg-white text-slate-900 shadow-2xs border border-slate-200" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <List className="w-3.5 h-3.5 text-current" />
                  Table
                </button>
              </div>

              <span className="bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold px-3 py-1 rounded-full font-mono">
                {actionBoardItems.length} actions required
              </span>
            </div>
          </div>

          {sectionViewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {actionBoardItems.length === 0 ? (
                <div className="col-span-full bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-500 text-xs italic shadow-xs">
                  No action items requiring immediate PM intervention.
                </div>
              ) : (
                actionBoardItems.map((act) => (
                  <div key={act.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block font-mono">
                          PM Owner: <strong className="text-slate-800">{act.owner}</strong>
                        </span>
                        <h3 
                          className="text-base font-extrabold text-slate-900 mt-1 cursor-pointer hover:text-[#6161FF] transition-colors"
                          onClick={() => onSelectProject(act.project)}
                        >
                          {act.project.name}
                        </h3>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shrink-0 shadow-2xs ${
                        act.priority === "URGENT" ? "bg-rose-100 text-rose-800 border border-rose-200" : "bg-amber-100 text-amber-800 border border-amber-200"
                      }`}>
                        {act.priority}
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl space-y-2">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Identified Problem:</span>
                      <p className="text-xs font-medium text-slate-700 leading-relaxed">{act.problem}</p>
                    </div>

                    <div className="bg-indigo-50/70 border border-indigo-200/80 p-4 rounded-xl space-y-1">
                      <span className="text-[10px] font-extrabold text-[#6161FF] uppercase tracking-wider block">Action Required Today:</span>
                      <p className="text-xs font-extrabold text-slate-900 leading-relaxed">{act.actionRequired}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="font-mono font-extrabold text-slate-700 text-xs bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                        Target Time: {act.dueTodayBy}
                      </span>
                      <button
                        onClick={() => onSelectProject(act.project)}
                        className="text-xs font-extrabold text-[#6161FF] hover:underline cursor-pointer inline-flex items-center gap-1"
                      >
                        Open Project &rarr;
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="py-3.5 px-4 w-1/5">PROJECT / CLIENT</th>
                      <th className="py-3.5 px-3 w-28">PM OWNER</th>
                      <th className="py-3.5 px-3 w-24">PRIORITY</th>
                      <th className="py-3.5 px-4 w-1/4">IDENTIFIED PROBLEM</th>
                      <th className="py-3.5 px-4 w-1/4">ACTION REQUIRED</th>
                      <th className="py-3.5 px-3 w-28">TARGET TIME</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {actionBoardItems.map((act) => (
                      <tr key={act.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-4 px-4 font-bold text-gray-950 cursor-pointer hover:text-[#6161FF]" onClick={() => onSelectProject(act.project)}>
                          {act.project.name}
                        </td>
                        <td className="py-4 px-3 font-semibold text-gray-700">{act.owner}</td>
                        <td className="py-4 px-3">
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded uppercase ${
                            act.priority === "URGENT" ? "bg-rose-100 text-rose-800 border border-rose-200" : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}>
                            {act.priority}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-700 font-medium">{act.problem}</td>
                        <td className="py-4 px-4 font-bold text-gray-900">{act.actionRequired}</td>
                        <td className="py-4 px-3 font-mono font-bold text-gray-800">{act.dueTodayBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW E: Internal Flags */}
      {activeMenu === "internal_flags" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-950">
                Internal Target Flags & Subitems
              </h2>
              <p className="text-xs text-gray-500 font-medium">Internal target date slips, stuck subtasks, and missing ownership details.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredProjectsByTab.filter(p => p.riskLevel !== "Green").map(p => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4">
                <div className="flex justify-between items-start gap-3">
                  <h4 className="font-extrabold text-base text-gray-950">{p.name}</h4>
                  <span className="bg-rose-100 text-rose-800 font-extrabold text-xs px-3 py-1 rounded-full uppercase border border-rose-200 shadow-2xs">
                    Internal Flag
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">PM Owner</span>
                    <span className="font-extrabold text-slate-800 mt-0.5 block truncate">{p.manager.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Internal Target</span>
                    <span className="font-extrabold text-slate-800 mt-0.5 block font-mono">{p.internalDueDate || "Not Set"}</span>
                  </div>
                </div>
                <div className="bg-rose-50/70 border border-rose-200/80 p-3.5 rounded-xl text-xs text-rose-950 font-mono">
                  {p.riskReasons.join(" • ")}
                </div>
                <button onClick={() => onSelectProject(p)} className="text-xs font-extrabold text-[#6161FF] hover:underline self-end">
                  Open Project Drawer &rarr;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW F: Follow-Up Queue */}
      {activeMenu === "followup_queue" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-950">
                Client Follow-Up Queue
              </h2>
              <p className="text-xs text-gray-500 font-medium">Projects in proposal phase, on hold, or waiting for client approval.</p>
            </div>

            {/* Layout Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                onClick={() => setSectionViewMode("grid")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  sectionViewMode === "grid" ? "bg-white text-slate-900 shadow-2xs border border-slate-200" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 text-current" />
                Grid Boxes
              </button>
              <button
                onClick={() => setSectionViewMode("table")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  sectionViewMode === "table" ? "bg-white text-slate-900 shadow-2xs border border-slate-200" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <List className="w-3.5 h-3.5 text-current" />
                Table
              </button>
            </div>
          </div>

          {sectionViewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {filteredProjectsByTab.map(p => (
                <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block font-mono">
                        PM Owner: <strong className="text-slate-800">{p.manager.name}</strong>
                      </span>
                      <h3 className="text-base font-extrabold text-slate-900 mt-1 truncate">{p.name}</h3>
                    </div>
                    <span className="bg-slate-100 text-slate-800 border border-slate-200 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shrink-0 shadow-2xs">
                      {p.groupTitle || "Proposal Phase"}
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl text-xs space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Recommended Action:</span>
                    <p className="font-medium text-slate-800 leading-relaxed">Send polite bump email to client regarding proposal review and next milestones.</p>
                  </div>

                  <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                    <button 
                      onClick={() => onSelectProject(p, "updates")} 
                      className="text-xs bg-[#6161FF] hover:bg-[#5050e6] text-white font-extrabold px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-2xs"
                    >
                      Draft Follow-Up Update
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="py-3.5 px-4">PROJECT</th>
                      <th className="py-3.5 px-3">PM OWNER</th>
                      <th className="py-3.5 px-3">STAGE / GROUP</th>
                      <th className="py-3.5 px-4">RECOMMENDED FOLLOW-UP ACTION</th>
                      <th className="py-3.5 px-3 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {filteredProjectsByTab.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/80">
                        <td className="py-4 px-4 font-bold text-gray-950">{p.name}</td>
                        <td className="py-4 px-3 font-medium text-gray-800">{p.manager.name}</td>
                        <td className="py-4 px-3 font-semibold text-gray-600 uppercase text-[10px]">{p.groupTitle || "Proposal Phase"}</td>
                        <td className="py-4 px-4 text-gray-700">Send polite bump email to client regarding proposal review.</td>
                        <td className="py-4 px-3 text-right">
                          <button onClick={() => onSelectProject(p, "updates")} className="text-[#6161FF] font-extrabold hover:underline">Draft Update</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW G: Managers Workload & Scorecard */}
      {(activeMenu === "managers" || activeMenu === "manager") && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-950">
                Managers Workload & Accountability Scorecards
              </h2>
              <p className="text-xs text-gray-500 font-medium">Project Manager performance metrics, active project counts, and risk distributions.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {uniqueManagersList.map(mgr => {
              const mgrProjects = rawAnalyzedProjects.filter(p => p.manager.name === mgr.name);
              const redCount = mgrProjects.filter(p => p.riskLevel === "Red").length;
              const amberCount = mgrProjects.filter(p => p.riskLevel === "Amber").length;
              const score = Math.max(0, 100 - (redCount * 25 + amberCount * 10));

              return (
                <div key={mgr.name} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col gap-5">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="font-extrabold text-lg text-slate-950">{mgr.name}</h3>
                      <span className="text-xs text-slate-400 font-bold uppercase">{mgrProjects.length} assigned projects</span>
                    </div>
                    <span className="text-xl font-black text-emerald-800 bg-emerald-100/80 px-3.5 py-1.5 rounded-2xl border border-emerald-200 shadow-2xs font-mono">
                      {score}/100
                    </span>
                  </div>

                  <div className="flex justify-between text-xs font-mono font-black bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <span className="text-rose-700 bg-rose-50 px-2.5 py-1 rounded border border-rose-200">Red: {redCount}</span>
                    <span className="text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200">Amber: {amberCount}</span>
                    <span className="text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">Green: {mgrProjects.length - (redCount + amberCount)}</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Assigned Projects:</span>
                    <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {mgrProjects.map(p => (
                        <div key={p.id} onClick={() => onSelectProject(p)} className="text-xs font-bold text-slate-800 hover:text-[#6161FF] cursor-pointer truncate p-2 hover:bg-slate-50 rounded-xl transition-colors flex items-center justify-between border border-transparent hover:border-slate-200">
                          <span className="truncate">• {p.name}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase ml-2 ${
                            p.riskLevel === "Red" ? "bg-rose-100 text-rose-800" : p.riskLevel === "Amber" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {p.riskLevel}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW H: Missing Data Audit */}
      {activeMenu === "missing_data" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-950">
                Missing Board Data Audit
              </h2>
              <p className="text-xs text-gray-500 font-medium">Projects missing critical fields in Monday.com (PM owner, client deadline, internal dates).</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="py-3.5 px-4">PROJECT</th>
                    <th className="py-3.5 px-3">PM MANAGER</th>
                    <th className="py-3.5 px-3">CLIENT DEADLINE</th>
                    <th className="py-3.5 px-3">INTERNAL TARGET</th>
                    <th className="py-3.5 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {filteredProjectsByTab.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50/80">
                      <td className="py-4 px-4 font-bold text-gray-950">{p.name}</td>
                      <td className="py-4 px-3">{p.manager.name || <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded">UNASSIGNED</span>}</td>
                      <td className="py-4 px-3 font-mono">{p.dueDate || <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">MISSING</span>}</td>
                      <td className="py-4 px-3 font-mono">{p.internalDueDate || <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">MISSING</span>}</td>
                      <td className="py-4 px-3 text-right">
                        <button onClick={() => onSelectProject(p, "sync")} className="text-[#6161FF] font-extrabold hover:underline">Fix in Monday &rarr;</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW I: Operations Wiki */}
      {activeMenu === "wiki" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-950">
                TypeTheta Operations Wiki & SLA Directives
              </h2>
              <p className="text-xs text-gray-500 font-medium">Standard operating rules, SLA guidelines, and Monday board compliance targets.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col gap-5 text-xs text-gray-800 leading-relaxed">
            <div>
              <h3 className="text-sm font-extrabold text-gray-950 mb-1">1. Email Response SLA Rule (4 Hours)</h3>
              <p>All incoming client or contact emails MUST receive a response or update within <strong>4 working hours</strong> (Monday to Friday, 08:00 to 20:00 UK time). Emails received outside working hours begin their SLA clock at 08:00 AM on the next working day.</p>
            </div>

            <div>
              <h3 className="text-sm font-extrabold text-gray-950 mb-1">2. Monday Board Update Frequency (3 Days)</h3>
              <p>Project Managers must post a meaningful progress update in the Monday updates feed at least once every <strong>3 calendar days</strong>. Items without updates past 3 days are automatically flagged in the Risk Queue as Stale.</p>
            </div>

            <div>
              <h3 className="text-sm font-extrabold text-gray-950 mb-1">3. AI Promise Detection & Fulfillments</h3>
              <p>Whenever a PM writes "I will send draft by 3 PM" or "Will revert tomorrow" in Monday updates or client emails, the TypeTheta AI engine logs this as a PM Promise. PMs must mark promises as fulfilled once completed.</p>
            </div>
          </div>
        </div>
      )}

      {/* AI DRAFT REPLY MODAL */}
      {selectedPromiseForDraft && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#6161FF]" />
                <h3 className="text-base font-extrabold text-gray-950">
                  AI Draft Reply to Fulfill Promise
                </h3>
              </div>
              <button
                onClick={() => setSelectedPromiseForDraft(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border text-xs text-gray-800">
              <strong className="text-gray-950 font-bold block">Target Commitment:</strong>
              <p className="mt-0.5 text-gray-700">"{selectedPromiseForDraft.promiseSummary}"</p>
              <span className="text-[10px] text-gray-500 font-semibold mt-1 block">
                Project: {selectedPromiseForDraft.projectName} | PM: {selectedPromiseForDraft.managerName}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-extrabold text-gray-900">Generated Email Response Text:</label>
              <textarea
                rows={7}
                value={draftReplyText}
                onChange={(e) => setDraftReplyText(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl text-xs font-sans text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6161FF]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setSelectedPromiseForDraft(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setFulfilledPromiseIds(prev => new Set(prev).add(selectedPromiseForDraft.id));
                  setSelectedPromiseForDraft(null);
                }}
                className="px-4 py-2 text-xs font-extrabold bg-[#6161FF] hover:bg-[#5050e6] text-white rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send & Mark Promise Fulfilled</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK PM STATUS UPDATE MODAL */}
      {quickUpdateModalProject && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <PenSquare className="w-5 h-5 text-[#6161FF]" />
                <h3 className="text-base font-extrabold text-gray-950">
                  Post Quick Status Update
                </h3>
              </div>
              <button
                onClick={() => {
                  setQuickUpdateModalProject(null);
                  setQuickUpdateText("");
                  setQuickUpdateSuccessMsg("");
                }}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-gray-800 flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#6161FF]">Target Project</span>
              <strong className="text-sm text-gray-950 font-bold">{quickUpdateModalProject.name}</strong>
              <div className="flex items-center gap-2 text-[11px] text-gray-600 mt-0.5">
                <span>PM Owner: <strong>{quickUpdateModalProject.manager.name}</strong></span>
                <span>•</span>
                <span>Group: <strong>{quickUpdateModalProject.groupTitle || "Project"}</strong></span>
              </div>
              <p className="text-[10.5px] text-slate-500 mt-1 italic leading-tight">
                Posting a status update logs a Monday update entry and refreshes the project's last update timestamp immediately.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-extrabold text-gray-900">Status Update Note / Message:</label>
              <textarea
                rows={4}
                placeholder="e.g. Phase 1 development completed. Preparing final build for client review tomorrow at 2 PM..."
                value={quickUpdateText}
                onChange={(e) => setQuickUpdateText(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl text-xs font-sans text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6161FF]"
              />
            </div>

            {quickUpdateText.trim().length > 0 && !isMeaningfulUpdateBody(quickUpdateText) && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium rounded-xl flex items-start gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Non-substantive update detected:</strong>
                  <p className="text-[11px] mt-0.5 leading-snug text-amber-800">
                    Entries like "no updates" or "waiting" do not contain meaningful progress and will <strong>NOT</strong> clear this project from the 2-day stale watchlist.
                  </p>
                </div>
              </div>
            )}

            {quickUpdateSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{quickUpdateSuccessMsg}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => {
                  setQuickUpdateModalProject(null);
                  setQuickUpdateText("");
                  setQuickUpdateSuccessMsg("");
                }}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!quickUpdateText.trim()) return;
                  const nowStr = new Date().toISOString();
                  setManuallyUpdatedProjectIds(prev => ({
                    ...prev,
                    [quickUpdateModalProject.id]: {
                      lastRespondedAt: nowStr,
                      note: quickUpdateText.trim()
                    }
                  }));
                  setQuickUpdateSuccessMsg("Status update posted successfully! Board timestamp refreshed.");
                  setTimeout(() => {
                    setQuickUpdateModalProject(null);
                    setQuickUpdateText("");
                    setQuickUpdateSuccessMsg("");
                  }, 800);
                }}
                disabled={!quickUpdateText.trim()}
                className="px-4 py-2 text-xs font-extrabold bg-[#6161FF] hover:bg-[#5050e6] disabled:opacity-50 text-white rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save & Refresh Timestamp</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {isBriefingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 flex flex-col gap-4 max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-extrabold text-gray-950">
                  Daily PM Standup Executive Briefing
                </h3>
              </div>
              <button
                onClick={() => setIsBriefingModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs leading-relaxed border border-slate-800 whitespace-pre-wrap select-all">
              {dailyBriefingText}
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-[11px] text-gray-500 font-medium">
                Copy text to share in Slack, Teams, or morning email update.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsBriefingModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(dailyBriefingText);
                    setCopiedBriefing(true);
                    setTimeout(() => setCopiedBriefing(false), 2000);
                  }}
                  className="px-4 py-2 text-xs font-extrabold bg-[#e59a35] hover:bg-amber-600 text-slate-950 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedBriefing ? "Copied to Clipboard!" : "Copy Briefing"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
