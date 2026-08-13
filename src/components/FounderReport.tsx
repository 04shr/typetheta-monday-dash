import React, { useMemo } from "react";
import { MappedProject, MondaySubitem, ProjectEmail } from "../types";
import { 
  calculateProjectRisk, 
  getElapsedWorkingHours, 
  isSlaBreached,
  getMockUnmatchedEmails,
  UnmatchedEmail
} from "../utils/slaHelper";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Layers, 
  Users, 
  UserX,
  FileWarning, 
  Lock, 
  ExternalLink, 
  HelpCircle,
  HelpCircle as QuestionIcon,
  ShieldAlert,
  Flame,
  CheckCircle,
  Trash2,
  AlertCircle
} from "lucide-react";

interface FounderReportProps {
  projects: MappedProject[];
  onSelectProject: (p: MappedProject) => void;
  todayStr?: string;
  riskConfig?: {
    slaHoursLimit?: number;
    workingHoursStart?: number;
    workingHoursEnd?: number;
    staleDaysLimit?: number;
    clientDeadlineAlertDays?: number;
  };
}

export default function FounderReport({ 
  projects, 
  onSelectProject, 
  todayStr = "2026-07-01",
  riskConfig
}: FounderReportProps) {
  // 1. Analyze and enrich projects with their risk scores
  const analyzedProjects = useMemo(() => {
    return projects.map(p => {
      const risk = calculateProjectRisk(p, todayStr, {
        ...riskConfig,
        slaHoursLimit: (p as any).slaLimitHours ?? riskConfig?.slaHoursLimit
      });
      return {
        ...p,
        riskLevel: risk.riskLevel,
        riskReasons: risk.reasons,
        riskActions: risk.actions
      };
    });
  }, [projects, todayStr, riskConfig]);

  // 2. Fetch the unmatched emails
  const unmatchedEmails = useMemo(() => {
    return getMockUnmatchedEmails(projects);
  }, [projects]);

  // 3. Group analyzed projects by risk level
  const redProjects = useMemo(() => analyzedProjects.filter(p => p.riskLevel === "Red"), [analyzedProjects]);
  const amberProjects = useMemo(() => analyzedProjects.filter(p => p.riskLevel === "Amber"), [analyzedProjects]);
  const greenProjects = useMemo(() => analyzedProjects.filter(p => p.riskLevel === "Green"), [analyzedProjects]);

  // 4. Group risks by category for separate report lists
  const emailSlaRisks = useMemo(() => {
    return analyzedProjects.filter(p => p.riskReasons.some(r => r.toLowerCase().includes("sla") || r.toLowerCase().includes("email")));
  }, [analyzedProjects]);

  const deadlineRisks = useMemo(() => {
    return analyzedProjects.filter(p => p.riskReasons.some(r => r.toLowerCase().includes("deadline") || r.toLowerCase().includes("due date")));
  }, [analyzedProjects]);

  const subitemRisks = useMemo(() => {
    return analyzedProjects.filter(p => p.riskReasons.some(r => r.toLowerCase().includes("subitem")));
  }, [analyzedProjects]);

  const staleRisks = useMemo(() => {
    return analyzedProjects.filter(p => p.riskReasons.some(r => r.toLowerCase().includes("stale") || r.toLowerCase().includes("updated on monday")));
  }, [analyzedProjects]);

  const cleanupRisks = useMemo(() => {
    return analyzedProjects.filter(p => p.riskReasons.some(r => r.toLowerCase().includes("no assigned manager") || r.toLowerCase().includes("no client due date") || r.toLowerCase().includes("missing or blank")));
  }, [analyzedProjects]);

  // 5. Calculate Accountability Score by Owner
  // Starts at 100. Subtracts 25 for each Red project, 10 for Amber, 5 for stale subitems/emails. Caps at 0.
  const accountabilityScores = useMemo<Record<string, { score: number; redCount: number; amberCount: number; greenCount: number; totalCount: number }>>(() => {
    const scores: { [ownerName: string]: { score: number; redCount: number; amberCount: number; greenCount: number; totalCount: number } } = {};
    
    analyzedProjects.forEach(p => {
      const owner = p.manager.name || "Unassigned";
      if (!scores[owner]) {
        scores[owner] = { score: 100, redCount: 0, amberCount: 0, greenCount: 0, totalCount: 0 };
      }
      scores[owner].totalCount++;
      if (p.riskLevel === "Red") {
        scores[owner].redCount++;
        scores[owner].score -= 25;
      } else if (p.riskLevel === "Amber") {
        scores[owner].amberCount++;
        scores[owner].score -= 10;
      } else {
        scores[owner].greenCount++;
      }
      
      // Additional penalty for unresponded emails
      const pendingSlaEmailsCount = (p.emails || []).filter(e => isSlaBreached(
        e,
        (p as any).slaLimitHours ?? riskConfig?.slaHoursLimit,
        riskConfig?.workingHoursStart,
        riskConfig?.workingHoursEnd
      )).length;
      scores[owner].score -= pendingSlaEmailsCount * 5;
    });

    // Make sure score is between 0 and 100
    Object.keys(scores).forEach(owner => {
      scores[owner].score = Math.max(0, Math.min(100, scores[owner].score));
    });

    return scores;
  }, [analyzedProjects]);

  // 6. Generate Suggested Private Questions to Ask each owner based on risk details
  const privateQuestionsByOwner = useMemo<Record<string, string[]>>(() => {
    const questions: { [ownerName: string]: string[] } = {};
    
    analyzedProjects.forEach(p => {
      const owner = p.manager.name;
      if (!owner || owner === "Unassigned") return;
      if (!questions[owner]) {
        questions[owner] = [];
      }

      if (p.riskLevel === "Red") {
        if (p.isOverdue || p.isInternalOverdue) {
          questions[owner].push(`"The client deadline on '${p.name}' is overdue/approaching, and our internal due date has slipped. What's the exact recovery plan to get this in today?"`);
        }
        if (p.hasActiveSlaBreach) {
          questions[owner].push(`"Why are client emails on '${p.name}' going unresponded past our 4-working-hour SLA? Is there a bottleneck in getting them answers?"`);
        }
        const overdueSubtasks = (p.subitems || []).filter(s => s.dueDate && new Date(s.dueDate) < new Date(todayStr) && !["done", "completed"].includes(s.status.toLowerCase()));
        if (overdueSubtasks.length > 0) {
          questions[owner].push(`"There are ${overdueSubtasks.length} overdue subtasks under '${p.name}' (e.g. '${overdueSubtasks[0].name}'). What's holding these up, and do we need more support?"`);
        }
        const unassignedSubtasks = (p.subitems || []).filter(s => !s.ownerName || !s.dueDate);
        if (unassignedSubtasks.length > 0) {
          questions[owner].push(`"On '${p.name}', why do some active subitems lack owners or clear dates? Can we get these assigned and locked in by the end of today?"`);
        }
        if (!p.dueDate || p.status === "New Task") {
          questions[owner].push(`"We have serious board cleanup issues on '${p.name}'. We lack a client due date or it is still in 'New Task' state despite starting. What's the story here?"`);
        }
      } else if (p.riskLevel === "Amber") {
        if (p.riskReasons.some(r => r.includes("updated on Monday"))) {
          questions[owner].push(`"There haven't been any updates posted in Monday for '${p.name}' for several days. Can you make sure to drop a quick progress post so the board is active?"`);
        }
        if (p.riskReasons.some(r => r.includes("waiting"))) {
          questions[owner].push(`"We are waiting on feedback/client on '${p.name}', but there's no clear next follow-up alert date set. When are we chasing them next?"`);
        }
      }
    });

    // Provide default positive questions for owners with 100% green projects
    Object.keys(accountabilityScores).forEach(owner => {
      if (owner === "Unassigned") return;
      if (!questions[owner] || questions[owner].length === 0) {
        questions[owner] = [
          `"Everything looks fully healthy on your board, excellent work! What's your focus for next week's deliverables?"`,
          `"Your client communications are fully meeting the 4-hour SLA. Keep up the high standard!"`
        ];
      } else {
        // Clean up duplicates
        questions[owner] = Array.from(new Set(questions[owner])).slice(0, 3);
      }
    });

    return questions;
  }, [analyzedProjects, accountabilityScores, todayStr]);

  // 7. Founder blunt and practical summary commentary
  const founderBluntCommentary = useMemo(() => {
    const totalCount = analyzedProjects.length;
    const redCount = redProjects.length;
    const amberCount = amberProjects.length;
    const emailBreaches = projects.reduce((acc, p) => acc + (p.slaBreachEmailsCount || 0), 0);

    if (redCount > 0) {
      return `We have ${redCount} high-risk red projects and ${amberCount} amber warnings across our designated delivery board. The biggest leak is communication responsiveness: there are currently ${emailBreaches} client emails that have breached our strict 4-working-hour SLA. Marcus and Linus are currently dragging down our scores due to overdue infrastructure milestones and stale updates. We need to clear these bottlenecks today to prevent client dissatisfaction. Audit our subitems immediately and enforce daily update compliance.`;
    } else if (amberCount > 0) {
      return `The board is generally stable with 0 critical Red failures, but we have ${amberCount} Amber hygiene warnings that must be cleaned up. Subitems are sitting stale with unassigned owners or missing dates, and Monday updates are starting to slip past 3 days. Get the managers to spend 15 minutes updating their items today to keep client dashboards current.`;
    } else {
      return `All projects across our targeted groups are in a flawless Green state. SLA thresholds are met, and subtasks are fully staffed with active dates. Maintain this high-contrast operating discipline. No emergency adjustments are required today.`;
    }
  }, [analyzedProjects, redProjects, amberProjects, projects]);

  const renderProjectCard = (p: typeof analyzedProjects[0]) => {
    const linkUrl = `https://your-company.monday.com/boards/987654321/pulses/${p.id}`;
    
    // Subitem status text
    const activeSubitems = (p.subitems || []).filter(s => !["done", "completed"].includes(s.status.toLowerCase()));
    const subitemSummaryText = p.subitems && p.subitems.length > 0 
      ? `${p.subitems.length} subitem(s) total, ${activeSubitems.length} active (${activeSubitems.filter(s => s.dueDate && new Date(s.dueDate) < new Date(todayStr)).length} overdue)`
      : "No subitems defined";

    // SLA Status
    const unrespondedEmails = (p.emails || []).filter(e => !e.isResponded);
    const slaStatusText = unrespondedEmails.length > 0
      ? `${unrespondedEmails.length} unresponded email(s) (${unrespondedEmails.filter(e => isSlaBreached(
          e,
          (p as any).slaLimitHours ?? riskConfig?.slaHoursLimit,
          riskConfig?.workingHoursStart,
          riskConfig?.workingHoursEnd
        )).length} breached)`
      : "No pending client emails";

    return (
      <div 
        key={p.id} 
        id={`founder-flagged-${p.id}`}
        className="bg-white border border-gray-200 rounded-lg p-4 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden"
      >
        {/* Risk indicator color band */}
        <div className={`absolute top-0 left-0 right-0 h-1 ${
          p.riskLevel === "Red" ? "bg-red-500" : p.riskLevel === "Amber" ? "bg-amber-500" : "bg-emerald-500"
        }`} />

        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="text-xs font-bold text-gray-950 font-sans tracking-tight">{p.name}</h4>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                  p.riskLevel === "Red" ? "bg-red-50 text-red-600" : p.riskLevel === "Amber" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                }`}>
                  {p.riskLevel}
                </span>
                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-semibold">
                  {p.groupTitle}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">ID: {p.id} • Monday Board pulse</p>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onSelectProject(p)}
                className="text-[10px] text-[#6161FF] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
              >
                Inspect
              </button>
              <span className="text-gray-300">|</span>
              <a 
                href={linkUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-gray-400 hover:text-gray-900 font-bold flex items-center gap-0.5"
              >
                Monday link
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          {/* Key Attributes Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50/70 p-2.5 rounded border border-gray-150 text-[10px]">
            <div>
              <span className="text-gray-400 uppercase tracking-wider block text-[8px] font-bold">Owner/Team</span>
              <span className="font-semibold text-gray-800">{p.manager.name}</span>
            </div>
            <div>
              <span className="text-gray-400 uppercase tracking-wider block text-[8px] font-bold">Project Status</span>
              <span className="font-bold text-[#6161FF]">{p.status}</span>
            </div>
            <div>
              <span className="text-gray-400 uppercase tracking-wider block text-[8px] font-bold">Client Deadline</span>
              <span className={`font-semibold ${p.isOverdue ? "text-red-600 font-extrabold animate-pulse" : "text-gray-700"}`}>
                {p.dueDate || "Not Set"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 uppercase tracking-wider block text-[8px] font-bold">Internal Target</span>
              <span className={`font-semibold ${p.isInternalOverdue ? "text-red-600" : "text-gray-700"}`}>
                {p.internalDueDate || "Not Set"}
              </span>
            </div>
          </div>

          {/* Stales & Summaries Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px] text-gray-600">
            <div>
              <strong className="text-gray-900 block text-[9px] font-bold">Last Monday Update:</strong>
              <span className="font-mono text-gray-500">
                {p.lastRespondedAt ? new Date(p.lastRespondedAt).toLocaleString() : "Never (Stale)"}
              </span>
            </div>
            <div>
              <strong className="text-gray-900 block text-[9px] font-bold">Subitem Health Summary:</strong>
              <span className="text-gray-500">{subitemSummaryText}</span>
            </div>
            <div>
              <strong className="text-gray-900 block text-[9px] font-bold">Email SLA Status:</strong>
              <span className="text-gray-500">{slaStatusText}</span>
            </div>
          </div>

          {/* Flag reasons list */}
          <div className="mt-1 border-t border-gray-100 pt-2 flex flex-col gap-1.5">
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-red-500 block">Reasons Flagged:</span>
              <ul className="list-disc pl-3 text-[10px] text-gray-700 flex flex-col gap-0.5 mt-0.5 font-medium">
                {p.riskReasons.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </div>
            <div className="bg-amber-50/50 border border-amber-200/50 p-2 rounded text-[10px] text-amber-900">
              <span className="font-bold text-[9px] uppercase tracking-wider text-amber-700 block mb-0.5">Exact Recommended Action:</span>
              <ul className="list-disc pl-3 flex flex-col gap-0.5">
                {p.riskActions.map((a, idx) => (
                  <li key={idx} className="font-medium">{a}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6" id="founder-audit-desk">
      
      {/* 1. Header Banner & Lock alert */}
      <div className="bg-gray-900 text-white rounded-lg p-5 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Lock className="w-40 h-40" />
        </div>
        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-600 rounded text-white shadow-md flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                Team Command Hub Desk
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                Team operations & delivery performance report
              </p>
            </div>
          </div>
          <span className="bg-gray-800 text-[10px] text-gray-300 font-mono font-bold px-2 py-0.5 rounded border border-gray-700">
            Reference Clock: 2026-07-01 UTC
          </span>
        </div>

        {/* Team Summary Segment */}
        <div className="mt-4 border-t border-gray-800 pt-4 flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            Team Summary & Overview
          </span>
          <p className="text-xs text-gray-200 leading-relaxed font-sans italic">
            "{founderBluntCommentary}"
          </p>
        </div>
      </div>

      {/* 2. Accountability Scores by Owner */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-2xs">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-950 flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-[#6161FF]" />
          Accountability Score by Owner
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Object.entries(accountabilityScores).map(([owner, anyData]) => {
            const data = anyData as { score: number; redCount: number; amberCount: number; greenCount: number; totalCount: number };
            let scoreColor = "text-emerald-600 bg-emerald-50 border-emerald-100";
            let barColor = "bg-emerald-500";
            if (data.score < 60) {
              scoreColor = "text-red-600 bg-red-50 border-red-100 animate-pulse";
              barColor = "bg-red-500";
            } else if (data.score < 85) {
              scoreColor = "text-amber-600 bg-amber-50 border-amber-100";
              barColor = "bg-amber-500";
            }

            return (
              <div key={owner} className="border border-gray-150 p-3 rounded flex flex-col justify-between gap-2.5 text-center bg-gray-50/50">
                <div>
                  <span className="font-bold text-[11px] text-gray-800 block truncate" title={owner}>{owner}</span>
                  <span className="text-[9px] text-gray-400 font-semibold block uppercase tracking-tight">
                    {data.totalCount} active project(s)
                  </span>
                </div>
                
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-baseline px-1">
                    <span className="text-[9px] text-gray-400 font-bold uppercase">SLA Score</span>
                    <span className={`text-[11px] font-extrabold ${scoreColor.split(" ")[0]}`}>{data.score}/100</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${data.score}%` }} />
                  </div>
                </div>

                <div className="flex justify-around text-[9px] font-mono font-bold text-gray-500 border-t border-gray-150 pt-1.5 mt-0.5">
                  <span className="text-red-500" title="Red Projects">R:{data.redCount}</span>
                  <span className="text-amber-500" title="Amber Warnings">A:{data.amberCount}</span>
                  <span className="text-emerald-500" title="Green Projects">G:{data.greenCount}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Section Segments based on audit guidelines */}
      <div className="flex flex-col gap-4">
        
        {/* Red Risks To Review Today */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              Red Risks to Review Today ({redProjects.length})
            </h4>
            <span className="text-[9px] text-gray-400 italic font-medium">Critical executive interventions required</span>
          </div>
          {redProjects.length > 0 ? (
            <div className="flex flex-col gap-4">
              {redProjects.map(renderProjectCard)}
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-150 p-4 rounded text-center text-xs text-emerald-800 font-semibold">
              ✓ No critical Red risks. All active items meeting baseline operational thresholds.
            </div>
          )}
        </div>

        {/* Email SLA Risks */}
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600" />
              Email SLA Risks ({emailSlaRisks.length})
            </h4>
            <span className="text-[9px] text-gray-400 font-mono">Target: Reply within 4 working hours (Mon-Fri, 8am-8pm UK time)</span>
          </div>
          {emailSlaRisks.length > 0 ? (
            <div className="flex flex-col gap-4">
              {emailSlaRisks.map(renderProjectCard)}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 p-4 rounded text-center text-xs text-gray-500">
              No active email SLA breaches. Managers responding to client emails timely!
            </div>
          )}
        </div>

        {/* Deadline Risks */}
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-rose-500" />
              Deadline Risks ({deadlineRisks.length})
            </h4>
            <span className="text-[9px] text-gray-400 italic">Client deadlines today, overdue, or within 7 days</span>
          </div>
          {deadlineRisks.length > 0 ? (
            <div className="flex flex-col gap-4">
              {deadlineRisks.map(renderProjectCard)}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 p-4 rounded text-center text-xs text-gray-500">
              No immediate client deadline risks on track!
            </div>
          )}
        </div>

        {/* Subitem Risks */}
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6161FF] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#6161FF]" />
              Subitem Risks ({subitemRisks.length})
            </h4>
            <span className="text-[9px] text-gray-400 italic">Overdue active subtasks, unassigned owners, or un-scoped deadlines</span>
          </div>
          {subitemRisks.length > 0 ? (
            <div className="flex flex-col gap-4">
              {subitemRisks.map(renderProjectCard)}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 p-4 rounded text-center text-xs text-gray-500">
              All active subtasks are healthy, dated, and staffed!
            </div>
          )}
        </div>

        {/* Stale Projects / Subitems */}
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              Stale Projects & Subitems ({staleRisks.length})
            </h4>
            <span className="text-[9px] text-gray-400 italic">No board updates for 3-5 days</span>
          </div>
          {staleRisks.length > 0 ? (
            <div className="flex flex-col gap-4">
              {staleRisks.map(renderProjectCard)}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 p-4 rounded text-center text-xs text-gray-500">
              No stale projects. All active logs updated within 48 hours.
            </div>
          )}
        </div>

        {/* Board Cleanup Issues */}
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
              <FileWarning className="w-4 h-4 text-teal-700" />
              Board Cleanup Issues ({cleanupRisks.length})
            </h4>
            <span className="text-[9px] text-gray-400 italic">Serious missing, unassigned, or messy data fields</span>
          </div>
          {cleanupRisks.length > 0 ? (
            <div className="flex flex-col gap-4">
              {cleanupRisks.map(renderProjectCard)}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 p-4 rounded text-center text-xs text-gray-500">
              ✓ Board data hygiene fully clean. No blank statuses or unassigned managers.
            </div>
          )}
        </div>

        {/* Unmatched Client Emails - inbox simulation */}
        <div className="flex flex-col gap-3 mt-2" id="unmatched-emails-desk">
          <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-violet-700 flex items-center gap-1.5">
              <UserX className="w-4 h-4 text-violet-700" />
              Unmatched Client Emails ({unmatchedEmails.length})
            </h4>
            <span className="text-[9px] text-gray-400 font-semibold text-rose-500 animate-pulse">ACTION REQUIRED: Not logged in Monday!</span>
          </div>
          <div className="flex flex-col gap-3">
            {unmatchedEmails.map((email) => (
              <div key={email.id} className="bg-violet-50/50 border border-violet-150 p-4 rounded-lg text-xs">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-violet-100">
                  <div>
                    <span className="font-bold text-gray-900 block font-sans text-xs">{email.subject}</span>
                    <span className="text-[10px] text-gray-500 block">
                      Sender: <strong className="text-gray-700">{email.sender}</strong> ({email.emailAddress}) • 
                      Received: <span className="font-mono text-gray-400">{new Date(email.receivedAt).toLocaleString()}</span>
                    </span>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="bg-violet-100 text-violet-800 text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                      Unmatched Email
                    </span>
                    <span className="text-[9px] text-gray-400 mt-1 font-mono">
                      Elapsed SLA: <strong className="text-red-500">{Math.round(getElapsedWorkingHours(email.receivedAt) * 10) / 10} working hours</strong>
                    </span>
                  </div>
                </div>

                <div className="py-2 text-[11px] text-gray-600 leading-relaxed italic bg-white p-2.5 rounded border border-violet-100/50 mt-2">
                  "{email.body}"
                </div>

                {/* Routing suggestion */}
                <div className="mt-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-2.5 rounded border border-violet-100">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wide text-violet-700">Suggested Action Routing:</span>
                    <div className="flex items-center gap-1 bg-violet-100 text-violet-800 font-bold px-2 py-0.5 rounded text-[10px]">
                      Owner: {email.suggestedOwner}
                      {email.isFallback && <span className="text-[8px] bg-red-100 text-red-700 px-1 rounded ml-1 font-extrabold uppercase">Fallback (Anna)</span>}
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-500 italic">
                    Reason: {email.reason}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Accountability Audit - Suggested Private Questions */}
        <div className="bg-amber-50/20 border border-amber-200 rounded-lg p-5 mt-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-2 mb-3">
            <HelpCircle className="w-4 h-4 text-amber-700" />
            Suggested Private Questions I Should Ask Each Owner
          </h4>
          <div className="flex flex-col gap-4">
            {Object.entries(privateQuestionsByOwner).map(([owner, anyQList]) => {
              const qList = anyQList as string[];
              return (
                <div key={owner} className="border-l-2 border-l-amber-500 pl-4 py-1">
                  <span className="font-bold text-[11px] text-gray-950 block mb-1">{owner}</span>
                  <ul className="list-decimal pl-4 text-[10.5px] text-gray-700 flex flex-col gap-1 font-medium font-sans">
                    {qList.map((q, idx) => (
                      <li key={idx} className="italic leading-relaxed">{q}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Short Healthy Summary */}
        <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-4 mt-2 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 block mb-1">
              Short Healthy Summary & Green Status
            </h4>
            <p className="text-[11px] text-emerald-800 leading-relaxed font-sans font-medium">
              Projects under our designated audit scope are otherwise execution-healthy if they have no active Red or Amber warnings. Currently, <strong>{greenProjects.length} out of {analyzedProjects.length} projects</strong> are fully green, staffed with clear active dates, and have complete information entries. We recommend maintaining the client deadline monitoring and the 4-working-hour email response SLA system.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
