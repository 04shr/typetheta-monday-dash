import React from "react";
import { MappedProject } from "../types";
import { 
  User, 
  Calendar, 
  AlertTriangle, 
  Mail, 
  Clock, 
  MessageSquare,
  ChevronRight
} from "lucide-react";
import { isSlaBreached, getSlaTimeRemaining } from "../utils/slaHelper";

interface ProjectCardsProps {
  projects: MappedProject[];
  selectedProjectId?: string;
  onSelectProject: (project: MappedProject) => void;
}

export default function ProjectCards({ 
  projects, 
  selectedProjectId, 
  onSelectProject 
}: ProjectCardsProps) {
  
  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("working")) return "bg-amber-100 text-amber-900 border-amber-300";
    if (s.includes("stuck") || s.includes("block")) return "bg-rose-100 text-rose-900 border-rose-300";
    if (s.includes("done") || s.includes("complete")) return "bg-emerald-100 text-emerald-900 border-emerald-300";
    return "bg-slate-100 text-slate-800 border-slate-300";
  };

  const getStatusDotColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("working")) return "bg-amber-500 animate-pulse";
    if (s.includes("stuck") || s.includes("block")) return "bg-rose-600 animate-pulse";
    if (s.includes("done") || s.includes("complete")) return "bg-emerald-500";
    return "bg-slate-400";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
      {projects.length === 0 ? (
        <div className="col-span-full bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-500 text-sm italic shadow-xs">
          No projects match the current perspective and criteria.
        </div>
      ) : (
        projects.map((project) => {
          const isSelected = selectedProjectId === project.id;
          const isOverdue = project.isOverdue;
          const isInternalOverdue = project.isInternalOverdue;
          const isUnresponded = project.isUnresponded2Days;
          
          // Compute active SLA pending or breached
          const slaEmails = project.emails || [];
          const activeSlaBreachCount = slaEmails.filter(e => isSlaBreached(e)).length;
          const pendingSlaEmailsCount = slaEmails.filter(e => !e.isResponded).length;

          return (
            <div
              key={project.id}
              onClick={() => onSelectProject(project)}
              className={`group bg-white border rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-1 flex flex-col justify-between ${
                isSelected 
                  ? "border-[#6161FF] ring-4 ring-[#6161FF]/15 bg-indigo-50/10" 
                  : "border-slate-200 hover:border-indigo-300"
              }`}
            >
              {/* Card Header & Body */}
              <div className="p-6 space-y-4">
                {/* Group Tag & Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-600 font-extrabold uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 font-mono truncate max-w-[65%]">
                    {project.groupTitle || project.groupId || "Group Topic"}
                  </span>

                  {/* Status Badge */}
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border shrink-0 shadow-2xs ${getStatusColor(project.status)}`}>
                    <span className={`w-2 h-2 rounded-full ${getStatusDotColor(project.status)}`} />
                    {project.status}
                  </span>
                </div>

                {/* Title */}
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 group-hover:text-[#6161FF] transition-colors leading-snug">
                    {project.name}
                  </h3>
                </div>

                {/* Manager / Owner Block Box */}
                <div className="flex items-center gap-3 bg-slate-50/80 border border-slate-200/80 p-3 rounded-xl">
                  {project.manager.avatar ? (
                    <img
                      src={project.manager.avatar}
                      alt={project.manager.name}
                      className="w-9 h-9 rounded-full border-2 border-white shadow-2xs object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-[#6161FF] font-black text-xs flex items-center justify-center border border-indigo-200 uppercase shrink-0 shadow-2xs">
                      {project.manager.name ? project.manager.name.charAt(0) : "PM"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project Manager</p>
                    <p className="text-xs font-black text-slate-800 truncate">{project.manager.name || "Unassigned"}</p>
                  </div>
                  <span className="text-[10px] bg-indigo-50 text-[#6161FF] font-extrabold px-2 py-0.5 rounded border border-indigo-100">
                    PM Owner
                  </span>
                </div>

                {/* Dates Sub-Grid Box */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] font-mono uppercase tracking-wider font-bold">Client Deadline</span>
                    <span className={`font-extrabold flex items-center gap-1.5 mt-1 text-xs ${isOverdue ? "text-rose-600 font-black" : "text-slate-800"}`}>
                      <Calendar className="w-3.5 h-3.5 text-current shrink-0" />
                      {project.dueDate || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-mono uppercase tracking-wider font-bold">Internal Target</span>
                    <span className={`font-extrabold flex items-center gap-1.5 mt-1 text-xs ${isInternalOverdue ? "text-amber-700 font-black" : "text-slate-800"}`}>
                      <Clock className="w-3.5 h-3.5 text-current shrink-0" />
                      {project.internalDueDate || "N/A"}
                    </span>
                  </div>
                </div>

                {/* Risk Reasons Box if Risk Level is not Green */}
                {project.riskLevel !== "Green" && project.riskReasons && project.riskReasons.length > 0 && (
                  <div className="bg-rose-50/70 border border-rose-200/80 p-3 rounded-xl text-xs text-rose-900 space-y-1">
                    <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-rose-800 uppercase tracking-wider">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Flagged Issue:</span>
                    </div>
                    <p className="text-[11px] font-medium leading-relaxed">
                      {project.riskReasons.join(" • ")}
                    </p>
                  </div>
                )}

                {/* SLA alert indicators / active status */}
                {pendingSlaEmailsCount > 0 && (
                  <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                    activeSlaBreachCount > 0 
                      ? "bg-rose-50 border-rose-200 text-rose-800" 
                      : "bg-indigo-50/70 border-indigo-200 text-indigo-900"
                  }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="w-4 h-4 text-current shrink-0" />
                      <span className="truncate">
                        {pendingSlaEmailsCount} pending client {pendingSlaEmailsCount === 1 ? "email" : "emails"}
                      </span>
                    </div>
                    {activeSlaBreachCount > 0 ? (
                      <span className="text-[10px] bg-rose-600 text-white font-black px-2 py-0.5 rounded animate-pulse shrink-0 uppercase tracking-wider shadow-2xs">
                        BREACHED
                      </span>
                    ) : (
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-black px-2 py-0.5 rounded border border-amber-200 shrink-0">
                        PENDING
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Card Footer / Quick Flags */}
              <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between text-xs">
                <div className="flex flex-wrap gap-1.5">
                  {project.hasActiveSlaBreach && (
                    <span className="bg-rose-100 text-rose-800 text-[9px] font-black px-2 py-0.5 rounded border border-rose-200 uppercase">
                      🚨 SLA Breach
                    </span>
                  )}
                  {isOverdue && (
                    <span className="bg-red-100 text-red-800 text-[9px] font-bold px-2 py-0.5 rounded uppercase border border-red-200">
                      Overdue
                    </span>
                  )}
                  {isInternalOverdue && (
                    <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-2 py-0.5 rounded uppercase border border-amber-200">
                      Internal at-risk
                    </span>
                  )}
                  {isUnresponded && (
                    <span className="bg-orange-100 text-orange-800 text-[9px] font-bold px-2 py-0.5 rounded uppercase border border-orange-200">
                      No updates
                    </span>
                  )}
                  {!project.hasActiveSlaBreach && !isOverdue && !isInternalOverdue && !isUnresponded && (
                    <span className="text-emerald-700 font-bold flex items-center gap-1.5 text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      All targets green
                    </span>
                  )}
                </div>

                <span className="text-[#6161FF] group-hover:text-indigo-700 font-extrabold flex items-center gap-1 text-xs transition-colors shrink-0">
                  Inspect Project
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
