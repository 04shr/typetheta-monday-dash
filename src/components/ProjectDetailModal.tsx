import React, { useState } from "react";
import { MappedProject, MondayUpdate, ProjectEmail, ColumnMapping } from "../types";
import { PortalUser } from "./PortalAuthModal";
import { 
  X, 
  MessageSquare, 
  Send, 
  AlertCircle, 
  Clock, 
  User, 
  Calendar, 
  Layers,
  Mail,
  Bell,
  Check,
  Reply,
  AlertTriangle,
  Plus,
  Sparkles,
  Cpu,
  RefreshCw,
  Eye,
  Lock
} from "lucide-react";
import { isSlaBreached, getSlaTimeRemaining } from "../utils/slaHelper";
import ReactMarkdown from "react-markdown";
import { safeFetchJson } from "../utils/apiHelper";
import { stripHtml } from "../utils/textUtils";

interface ProjectDetailModalProps {
  project: MappedProject;
  onClose: () => void;
  onAddComment: (projectId: string, commentText: string) => Promise<void>;
  isDemoMode: boolean;
  onReplyToEmail: (projectId: string, emailId: string, replyText: string) => void;
  onSendSlaReminder: (projectId: string, emailId: string) => void;
  onSimulateIncomingEmail: (projectId: string, sender: string, subject: string, hoursAgo: number) => void;
  riskConfig?: {
    slaHoursLimit?: number;
    workingHoursStart?: number;
    workingHoursEnd?: number;
    staleDaysLimit?: number;
    clientDeadlineAlertDays?: number;
  };
  projectSlaTier: string;
  onChangeProjectSlaTier: (projectId: string, tier: string) => void;
  slaTierHours: { [tier: string]: number };
  onUpdateMondayCell: (projectId: string, columnId: string, columnType: "status" | "date", newValue: string) => Promise<void>;
  mapping: ColumnMapping;
  currentUser?: PortalUser | null;
  isReadOnly?: boolean;
}

export default function ProjectDetailModal({ 
  project, 
  onClose, 
  onAddComment, 
  isDemoMode,
  onReplyToEmail,
  onSendSlaReminder,
  onSimulateIncomingEmail,
  riskConfig,
  projectSlaTier,
  onChangeProjectSlaTier,
  slaTierHours,
  onUpdateMondayCell,
  mapping,
  currentUser,
  isReadOnly = false
}: ProjectDetailModalProps) {
  const isObserver = isReadOnly || currentUser?.role === "Observer";
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SLA Email local states
  const [replyInputs, setReplyInputs] = useState<{ [emailId: string]: string }>({});
  const [showSimulateForm, setShowSimulateForm] = useState(false);
  const [simSender, setSimSender] = useState("");
  const [simSubject, setSimSubject] = useState("");
  const [simHours, setSimHours] = useState("5");

  // AI-Powered and Write-back States
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryText, setAiSummaryText] = useState<string | null>(null);
  const [aiDraftLoading, setAiDraftLoading] = useState<{ [emailId: string]: boolean }>({});
  
  const [isWritingBackStatus, setIsWritingBackStatus] = useState(false);
  const [isWritingBackInternalDate, setIsWritingBackInternalDate] = useState(false);
  const [isWritingBackClientDate, setIsWritingBackClientDate] = useState(false);
  
  const [statusVal, setStatusVal] = useState(project.status);
  const [internalDateVal, setInternalDateVal] = useState(project.internalDueDate || "");
  const [clientDateVal, setClientDateVal] = useState(project.dueDate || "");

  const handleGenerateAiSummary = async () => {
    setAiSummaryLoading(true);
    setAiSummaryText(null);
    try {
      const data = await safeFetchJson<{ summary: string }>("/api/gemini/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project })
      });
      setAiSummaryText(data.summary);
    } catch (err: any) {
      setAiSummaryText(`⚠️ **AI Summary Generation Failed:** ${err.message}`);
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const handleGenerateAiDraft = async (email: ProjectEmail) => {
    setAiDraftLoading(prev => ({ ...prev, [email.id]: true }));
    try {
      const data = await safeFetchJson<{ draft: string }>("/api/gemini/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: email.sender,
          subject: email.subject,
          projectName: project.name,
          projectStatus: project.status
        })
      });
      setReplyInputs(prev => ({ ...prev, [email.id]: data.draft }));
    } catch (err: any) {
      alert(`AI Draft Error: ${err.message}`);
    } finally {
      setAiDraftLoading(prev => ({ ...prev, [email.id]: false }));
    }
  };

  const handleStatusWriteback = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsWritingBackStatus(true);
    try {
      await onUpdateMondayCell(project.id, mapping.statusColId, "status", statusVal);
    } catch (err: any) {
      alert(`Status write-back failed: ${err.message}`);
    } finally {
      setIsWritingBackStatus(false);
    }
  };

  const handleInternalDateWriteback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapping.internalDueDateColId) {
      alert("Internal target date column is not mapped in Connection panel!");
      return;
    }
    setIsWritingBackInternalDate(true);
    try {
      await onUpdateMondayCell(project.id, mapping.internalDueDateColId, "date", internalDateVal);
    } catch (err: any) {
      alert(`Internal target date write-back failed: ${err.message}`);
    } finally {
      setIsWritingBackInternalDate(false);
    }
  };

  const handleClientDateWriteback = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsWritingBackClientDate(true);
    try {
      await onUpdateMondayCell(project.id, mapping.dueDateColId, "date", clientDateVal);
    } catch (err: any) {
      alert(`Client deadline write-back failed: ${err.message}`);
    } finally {
      setIsWritingBackClientDate(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onAddComment(project.id, commentText);
      setCommentText("");
    } catch (err: any) {
      setError(err.message || "Failed to submit comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusStyle = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("done") || s.includes("completed")) {
      return "bg-green-100 text-green-700 border-green-200";
    }
    if (s.includes("stuck") || s.includes("blocked")) {
      return "bg-red-100 text-red-700 border-red-200";
    }
    if (s.includes("work") || s.includes("progress")) {
      return "bg-blue-100 text-blue-700 border-blue-200";
    }
    return "bg-gray-150 text-gray-700 border-gray-250";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Not Set";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC"
      });
    } catch {
      return dateStr;
    }
  };

  const formatTimestamp = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded shadow-xs flex flex-col h-full max-h-[650px] overflow-hidden sticky top-[90px]">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex justify-between items-start shrink-0">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusStyle(project.status)}`}>
              {project.status}
            </span>
            {isDemoMode && (
              <span className="bg-indigo-50 text-indigo-600 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide border border-indigo-100">
                Demo
              </span>
            )}
          </div>
          <h2 className="text-sm font-bold text-gray-900 truncate leading-snug" title={project.name}>
            {project.name}
          </h2>
        </div>
        <button 
          id="close-sidebar-btn"
          onClick={onClose}
          className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0 ml-2"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body container with scroll */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        
        {/* Observer Notice Banner */}
        {isObserver && (
          <div className="bg-amber-50 border border-amber-200 text-amber-950 p-3 rounded-xl flex items-center justify-between text-xs font-semibold shadow-xs">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Observer View Only — Edit permissions and Monday.com writebacks are disabled for Observers.</span>
            </div>
            <span className="text-[10px] bg-amber-200 text-amber-900 font-extrabold px-2 py-0.5 rounded uppercase shrink-0">
              Read-Only
            </span>
          </div>
        )}

        {/* Manager Block */}
        <div className="bg-gray-50 border border-gray-200 p-2.5 rounded flex items-center gap-3">
          {project.manager.avatar ? (
            <img 
              src={project.manager.avatar} 
              alt={project.manager.name}
              className="w-8 h-8 rounded-full object-cover border border-gray-200"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
              <User className="w-4 h-4" />
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-gray-800 leading-none truncate">{project.manager.name}</span>
            <span className="text-[10px] text-gray-400 mt-1">Project Lead / Contact</span>
          </div>
        </div>

        {/* AI Project Digest (Gemini Integration) */}
        <div className="border border-indigo-150 bg-indigo-50/25 rounded p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#6161FF]" />
              AI Assistant Insights
            </h4>
            <button
              onClick={handleGenerateAiSummary}
              disabled={aiSummaryLoading}
              className="px-2 py-0.5 bg-[#6161FF] hover:bg-[#5050e6] text-white text-[9px] font-bold rounded flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-55"
            >
              {aiSummaryLoading ? (
                <>
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Cpu className="w-3 h-3" />
                  Generate Digest
                </>
              )}
            </button>
          </div>

          {aiSummaryText && (
            <div className="bg-white/95 border border-indigo-100 rounded p-2.5 text-[10px] leading-relaxed text-gray-800 max-h-[180px] overflow-y-auto shadow-3xs prose prose-slate">
              <ReactMarkdown>{aiSummaryText}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Quick Flags if any */}
        {(project.isOverdue || project.isInternalOverdue || project.isUnresponded2Days) && (
          <div className="bg-red-50/50 border border-red-100 rounded p-3">
            <h4 className="text-[10px] font-bold text-red-800 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              Critical Action Alerts
            </h4>
            <div className="text-[11px] text-red-700 space-y-1.5">
              {project.isOverdue && (
                <p>⚠️ <strong>Missed Client Deadline:</strong> Passed due date ({formatDate(project.dueDate)}).</p>
              )}
              {project.isInternalOverdue && (
                <p>⚠️ <strong>Missed Internal target:</strong> Passed target of {formatDate(project.internalDueDate)}.</p>
              )}
              {project.isUnresponded2Days && (
                <p>⚠️ <strong>No Update:</strong> No activity or comments in the last 48 hours.</p>
              )}
            </div>
          </div>
        )}

        {/* Deadlines Section */}
        <div className="border border-gray-200 rounded p-3 space-y-2 text-xs">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Timeline & Milestones</p>
          
          <div className="flex justify-between items-center py-1">
            <span className="text-gray-500 font-medium">Internal Target:</span>
            <span className={`font-bold ${project.isInternalOverdue ? "text-amber-600" : "text-gray-700"}`}>
              {formatDate(project.internalDueDate)}
            </span>
          </div>
          <div className="flex justify-between items-center py-1 border-t border-gray-100">
            <span className="text-gray-500 font-medium">Client Deadline:</span>
            <span className={`font-bold ${project.isOverdue ? "text-red-600" : "text-gray-700"}`}>
              {formatDate(project.dueDate)}
            </span>
          </div>
        </div>

        {/* Direct Monday.com Write-backs */}
        <div className="border border-[#E2E2FF] bg-[#FAF9FF] rounded p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-indigo-850 uppercase tracking-wide flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              Direct Monday.com Write-backs
            </p>
            {isObserver && (
              <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                <Lock className="w-3 h-3" />
                PM Edit Privileges Required
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {/* Status writeback */}
            <form onSubmit={handleStatusWriteback} className="flex gap-1.5 items-center justify-between text-xs">
              <span className="text-gray-500 font-medium w-1/4">Status:</span>
              <select
                value={statusVal}
                disabled={isObserver}
                onChange={(e) => setStatusVal(e.target.value)}
                className="flex-1 text-[11px] p-1 border border-gray-200 bg-white rounded text-gray-700 focus:outline-none focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="Working on it">Working on it</option>
                <option value="Stuck">Stuck</option>
                <option value="Done">Done</option>
                <option value="Not Started">Not Started</option>
              </select>
              <button
                type="submit"
                disabled={isObserver || isWritingBackStatus}
                className="px-2 py-1 bg-[#6161FF] hover:bg-[#5050e6] text-white rounded text-[9px] font-bold transition-colors shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isWritingBackStatus ? "Saving..." : "Update"}
              </button>
            </form>

            {/* Internal target writeback */}
            {mapping.internalDueDateColId && (
              <form onSubmit={handleInternalDateWriteback} className="flex gap-1.5 items-center justify-between text-xs">
                <span className="text-gray-500 font-medium w-1/4">Internal:</span>
                <input
                  type="date"
                  value={internalDateVal}
                  disabled={isObserver}
                  onChange={(e) => setInternalDateVal(e.target.value)}
                  className="flex-1 text-[11px] p-1 border border-gray-200 bg-white rounded text-gray-700 font-mono focus:outline-none focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
                />
                <button
                  type="submit"
                  disabled={isObserver || isWritingBackInternalDate}
                  className="px-2 py-1 bg-[#6161FF] hover:bg-[#5050e6] text-white rounded text-[9px] font-bold transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {isWritingBackInternalDate ? "Saving..." : "Update"}
                </button>
              </form>
            )}

            {/* Client deadline writeback */}
            <form onSubmit={handleClientDateWriteback} className="flex gap-1.5 items-center justify-between text-xs">
              <span className="text-gray-500 font-medium w-1/4">Client:</span>
              <input
                type="date"
                value={clientDateVal}
                disabled={isObserver}
                onChange={(e) => setClientDateVal(e.target.value)}
                className="flex-1 text-[11px] p-1 border border-gray-200 bg-white rounded text-gray-700 font-mono focus:outline-none focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
              />
              <button
                type="submit"
                disabled={isObserver || isWritingBackClientDate}
                className="px-2 py-1 bg-[#6161FF] hover:bg-[#5050e6] text-white rounded text-[9px] font-bold transition-colors shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isWritingBackClientDate ? "Saving..." : "Update"}
              </button>
            </form>
          </div>
        </div>

        {/* Client Email SLA Desk Section */}
        <div className="border border-gray-200 rounded p-3 space-y-3 bg-[#FBFBFF]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#6161FF]" />
              <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Email SLA Desk</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9px] font-bold text-gray-400">SLA:</span>
              <select
                value={projectSlaTier}
                onChange={(e) => onChangeProjectSlaTier(project.id, e.target.value)}
                className="text-[10px] bg-white border border-gray-200 rounded font-bold px-1.5 py-0.5 text-[#6161FF] cursor-pointer focus:outline-none"
              >
                <option value="Platinum">Platinum ({slaTierHours.Platinum}h)</option>
                <option value="Gold">Gold ({slaTierHours.Gold}h)</option>
                <option value="Silver">Silver ({slaTierHours.Silver}h)</option>
                <option value="Bronze">Bronze ({slaTierHours.Bronze}h)</option>
              </select>
            </div>
          </div>

          <p className="text-[10px] text-gray-400">
            Real-time monitoring of client emails. Unresponded items exceeding Gold/Silver limits trigger warnings.
          </p>

          {/* Quick Simulation trigger */}
          <div className="border-t border-dashed border-gray-150 pt-2.5">
            {!showSimulateForm ? (
              <button
                onClick={() => setShowSimulateForm(true)}
                className="text-[10px] font-bold text-[#6161FF] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                🧪 Simulate Incoming Client Email
              </button>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded p-2.5 space-y-2">
                <p className="text-[10px] font-bold text-gray-600">Simulate Stakeholder Email</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Sender Name"
                    value={simSender}
                    onChange={(e) => setSimSender(e.target.value)}
                    className="text-[10px] p-1 border border-gray-250 rounded bg-white w-full"
                  />
                  <input
                    type="text"
                    placeholder="Subject Line"
                    value={simSubject}
                    onChange={(e) => setSimSubject(e.target.value)}
                    className="text-[10px] p-1 border border-gray-250 rounded bg-white w-full"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-gray-400">Time:</span>
                    <select
                      value={simHours}
                      onChange={(e) => setSimHours(e.target.value)}
                      className="text-[9px] border border-gray-200 rounded bg-white px-1"
                    >
                      <option value="1">1 hour ago (SLA Safe)</option>
                      <option value="3">3 hours ago (SLA Critical)</option>
                      <option value="5">5 hours ago (Breaches SLA!)</option>
                      <option value="10">10 hours ago (Breached SLA!)</option>
                    </select>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setShowSimulateForm(false)}
                      className="text-[9px] px-2 py-0.5 border border-gray-200 rounded hover:bg-gray-100 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const sender = simSender.trim() || "Client Stakeholder";
                        const subject = simSubject.trim() || "Feedback on latest production push";
                        onSimulateIncomingEmail(project.id, sender, subject, parseFloat(simHours));
                        setSimSender("");
                        setSimSubject("");
                        setShowSimulateForm(false);
                      }}
                      className="text-[9px] bg-indigo-600 text-white px-2 py-0.5 rounded font-bold hover:bg-indigo-700"
                    >
                      Trigger
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Email entries */}
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {(!project.emails || project.emails.length === 0) ? (
              <div className="text-center text-gray-400 text-[10px] py-4 italic">
                No email tracking data for this project.
              </div>
            ) : (
              project.emails.map((email) => {
                const actualLimit = slaTierHours[projectSlaTier] ?? (project as any).slaLimitHours ?? riskConfig?.slaHoursLimit ?? 4;
                const breached = isSlaBreached(
                  email,
                  actualLimit,
                  riskConfig?.workingHoursStart,
                  riskConfig?.workingHoursEnd
                );
                const remaining = getSlaTimeRemaining(
                  email,
                  actualLimit,
                  riskConfig?.workingHoursStart,
                  riskConfig?.workingHoursEnd
                );
                const elapsedHours = ((Date.now() - new Date(email.receivedAt).getTime()) / (1000 * 60 * 60)).toFixed(1);

                return (
                  <div 
                    key={email.id} 
                    className={`border rounded p-2.5 space-y-2 transition-all ${
                      email.isResponded 
                        ? "bg-emerald-50/20 border-emerald-100" 
                        : breached 
                          ? "bg-red-50/30 border-red-200 shadow-3xs" 
                          : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-gray-700 truncate">{email.sender}</p>
                        <p className="text-[10px] text-gray-500 font-medium truncate mt-0.5">Subject: {email.subject}</p>
                        <p className="text-[9px] text-gray-400 font-mono mt-1">Received: {elapsedHours} hours ago</p>
                      </div>

                      {/* Badge status */}
                      <div className="shrink-0">
                        {email.isResponded ? (
                          <span className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-700 border border-emerald-150 text-[9px] font-bold px-1.5 py-0.2 rounded font-sans uppercase">
                            <Check className="w-2.5 h-2.5" />
                            Resolved SLA
                          </span>
                        ) : breached ? (
                          <span className="inline-flex items-center gap-0.5 bg-red-100 text-red-700 border border-red-200 text-[9px] font-black px-1.5 py-0.2 rounded font-sans uppercase animate-pulse">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            SLA BREACHED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold px-1.5 py-0.2 rounded font-sans uppercase">
                            <Clock className="w-2.5 h-2.5" />
                            Expires: {remaining.hours}h {remaining.minutes}m
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Email actions if not responded */}
                    {!email.isResponded && (
                      <div className="border-t border-gray-100 pt-2 space-y-2">
                        {/* Notify PM Reminder Trigger */}
                        <div className="flex items-center justify-between text-[9px]">
                          <span className="text-gray-400 font-mono">
                            Reminders: <strong>{email.reminderSentCount}</strong> sent
                          </span>
                          <button
                            onClick={() => onSendSlaReminder(project.id, email.id)}
                            className="text-red-600 hover:text-red-700 font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <Bell className="w-3 h-3" />
                            {email.reminderSentCount > 0 ? "Send Reminder Again" : "Send PM Reminder"}
                          </button>
                        </div>

                        {/* Inline Reply Form with Gemini AI Draft button */}
                        <div className="flex gap-1.5 flex-col">
                          <div className="relative flex items-center w-full">
                            <input
                              type="text"
                              placeholder="Type response & resolve SLA..."
                              value={replyInputs[email.id] || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setReplyInputs(prev => ({ ...prev, [email.id]: val }));
                              }}
                              className="w-full text-[10px] pl-2 pr-16 py-1 border border-gray-250 rounded focus:outline-none focus:border-indigo-500 bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleGenerateAiDraft(email)}
                              disabled={aiDraftLoading[email.id]}
                              className="absolute right-1 text-[#6161FF] hover:text-[#5050e6] font-bold text-[9px] flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                              title="Generate AI reply draft using Gemini"
                            >
                              {aiDraftLoading[email.id] ? (
                                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                              ) : (
                                <>
                                  <Sparkles className="w-2.5 h-2.5" />
                                  AI Draft
                                </>
                              )}
                            </button>
                          </div>
                          <button
                            onClick={() => {
                              const text = replyInputs[email.id]?.trim();
                              if (!text) return;
                              onReplyToEmail(project.id, email.id, text);
                              setReplyInputs(prev => ({ ...prev, [email.id]: "" }));
                            }}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] py-1 rounded font-bold uppercase flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Reply className="w-3 h-3" />
                            Post Reply & Resolve SLA
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Updates / Activity Feed */}
        <div className="flex-1 flex flex-col border border-gray-200 rounded overflow-hidden min-h-[180px]">
          <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Activity Feed</span>
            </div>
            <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-bold">
              {project.updates.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-white max-h-[160px]">
            {project.updates.length === 0 ? (
              <div className="py-6 text-center text-gray-400 text-[11px] italic">
                No activity yet. Use the composer below to post.
              </div>
            ) : (
              project.updates.map((update) => (
                <div key={update.id} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {update.creator.photo_thumb ? (
                        <img 
                          src={update.creator.photo_thumb} 
                          alt={update.creator.name}
                          className="w-4 h-4 rounded-full object-cover border border-gray-200"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                          <User className="w-2 h-2" />
                        </div>
                      )}
                      <span className="text-[10px] font-bold text-gray-700">{update.creator.name}</span>
                    </div>
                    <span className="text-[9px] text-gray-400 font-medium">
                      {formatTimestamp(update.created_at)}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 pl-5 whitespace-pre-wrap leading-tight">
                    {stripHtml(update.body)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Monday Raw columns list */}
        <div className="border border-gray-200 rounded p-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight flex items-center gap-1.5 mb-1.5">
            <Layers className="w-3 h-3 text-gray-400" />
            Monday Raw Data
          </p>
          <div className="space-y-1 text-[11px]">
            {Object.entries(project.rawColumnValues).slice(0, 4).map(([colId, textVal]) => (
              <div key={colId} className="flex justify-between py-0.5 border-b border-gray-50 last:border-0">
                <span className="text-gray-400 truncate max-w-[110px]">{colId}</span>
                <span className="text-gray-700 font-bold truncate max-w-[120px]" title={stripHtml(textVal || "")}>
                  {stripHtml(textVal || "") || <span className="italic font-normal text-gray-300">--</span>}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Footer comment form */}
      <div className="bg-gray-50 border-t border-gray-200 p-3">
        <form onSubmit={handleSubmitComment} className="flex flex-col gap-2">
          <textarea
            placeholder={
              isObserver 
                ? "Observer View Only: Sign in as Project Manager to post live updates to Monday.com..." 
                : "Post a response or update to Monday.com..."
            }
            disabled={isObserver}
            rows={2}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="w-full text-xs p-2 border border-gray-200 rounded bg-white focus:outline-none focus:border-[#6161FF] resize-none text-gray-700 placeholder-gray-400 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
          />
          <div className="flex justify-between items-center">
            {isObserver ? (
              <span className="text-[10px] text-amber-700 font-medium flex items-center gap-1">
                <Lock className="w-3 h-3" /> Read-only mode
              </span>
            ) : error ? (
              <span className="text-[9px] font-semibold text-red-500 truncate max-w-[150px]">{error}</span>
            ) : (
              <span className="text-[9px] text-gray-450">Syncs instantly to live board</span>
            )}
            <button
              type="submit"
              disabled={isObserver || isSubmitting || !commentText.trim()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#6161FF] hover:bg-[#5050e6] text-white text-[10px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                "Posting..."
              ) : (
                <>
                  <Send className="w-2.5 h-2.5" />
                  Post Update
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
