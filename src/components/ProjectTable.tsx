import React, { useState } from "react";
import { MappedProject } from "../types";
import { 
  AlertCircle, 
  Clock, 
  MessageSquare, 
  User, 
  ArrowUpDown, 
  Calendar,
  Eye,
  CheckCircle2
} from "lucide-react";

interface ProjectTableProps {
  projects: MappedProject[];
  selectedProjectId?: string | null;
  onSelectProject: (project: MappedProject) => void;
}

type SortKey = "name" | "status" | "manager" | "dueDate" | "internalDueDate" | "lastResponse";

export default function ProjectTable({ projects, selectedProjectId, onSelectProject }: ProjectTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setOrder("asc");
    }
  };

  // Safe wrapper for typescript compatibility or direct setter
  const setOrder = (order: "asc" | "desc") => {
    setSortOrder(order);
  };

  const getSortedProjects = () => {
    return [...projects].sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      switch (sortKey) {
        case "name":
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case "status":
          valA = a.status.toLowerCase();
          valB = b.status.toLowerCase();
          break;
        case "manager":
          valA = a.manager.name.toLowerCase();
          valB = b.manager.name.toLowerCase();
          break;
        case "dueDate":
          valA = a.dueDate || "9999-12-31";
          valB = b.dueDate || "9999-12-31";
          break;
        case "internalDueDate":
          valA = a.internalDueDate || "9999-12-31";
          valB = b.internalDueDate || "9999-12-31";
          break;
        case "lastResponse":
          valA = a.lastRespondedAt || "1970-01-01";
          valB = b.lastRespondedAt || "1970-01-01";
          break;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  };

  const getStatusStyle = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("done") || s.includes("completed") || s.includes("finish")) {
      return "bg-green-100 text-green-700 border-green-200";
    }
    if (s.includes("stuck") || s.includes("blocked") || s.includes("fail")) {
      return "bg-red-100 text-red-700 border-red-200";
    }
    if (s.includes("work") || s.includes("progress") || s.includes("active")) {
      return "bg-blue-100 text-blue-700 border-blue-200";
    }
    if (s.includes("ready") || s.includes("review")) {
      return "bg-gray-100 text-gray-700 border-gray-200";
    }
    return "bg-gray-50 text-gray-600 border-gray-200";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "--";
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

  const getTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const updateDate = new Date(dateStr);
    const today = new Date("2026-07-01"); // using current metadata date
    const diffMs = today.getTime() - updateDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return `${diffDays}d ago`;
  };

  const sortedProjects = getSortedProjects();

  return (
    <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="overflow-auto max-h-[550px]">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 shadow-2xs">
            <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-2.5 px-4 select-none cursor-pointer hover:text-slate-900 w-2/5" onClick={() => handleSort("name")}>
                <div className="flex items-center gap-1">
                  Project Name
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 select-none cursor-pointer hover:text-slate-900 w-[110px]" onClick={() => handleSort("manager")}>
                <div className="flex items-center gap-1">
                  Manager
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 select-none cursor-pointer hover:text-slate-900 w-[100px]" onClick={() => handleSort("status")}>
                <div className="flex items-center gap-1">
                  Status
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 select-none cursor-pointer hover:text-slate-900 w-[80px]" onClick={() => handleSort("lastResponse")}>
                <div className="flex items-center gap-1">
                  Last Resp.
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 select-none cursor-pointer hover:text-slate-900 w-[100px]" onClick={() => handleSort("internalDueDate")}>
                <div className="flex items-center gap-1">
                  Internal Due
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 select-none cursor-pointer hover:text-slate-900 w-[110px]" onClick={() => handleSort("dueDate")}>
                <div className="flex items-center gap-1">
                  Client Deadline
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-right w-[80px] text-slate-500">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {sortedProjects.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                  No projects match selected filter.
                </td>
              </tr>
            ) : (
              sortedProjects.map((project) => {
                const isOverdue = project.isOverdue;
                const isInternalOverdue = project.isInternalOverdue;
                const isUnresponded = project.isUnresponded2Days;
                const isSelected = project.id === selectedProjectId;
 
                // Color-coding backgrounds based on state
                let rowBg = "bg-white";
                if (isSelected) {
                  rowBg = "bg-blue-50/70 border-l-2 border-l-[#6161FF]";
                } else if (isOverdue) {
                  rowBg = "bg-red-50/30";
                } else if (isUnresponded) {
                  rowBg = "bg-amber-50/30";
                }
 
                return (
                  <tr 
                    key={project.id}
                    id={`project-row-${project.id}`}
                    onClick={() => onSelectProject(project)}
                    className={`${rowBg} hover:bg-slate-50 cursor-pointer transition-colors`}
                  >
                    {/* Project Name */}
                    <td className="py-2.5 px-4 font-semibold text-slate-900 truncate">
                      <div className="flex flex-col truncate">
                        <div className="flex items-center gap-1.5 truncate">
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#6161FF] shrink-0" />}
                          <span className="truncate">{project.name}</span>
                        </div>
                        {project.groupTitle && (
                          <span className="text-[9px] text-slate-500 font-medium mt-0.5 tracking-tight truncate flex items-center gap-1">
                            <span className="bg-slate-100 px-1 py-0.2 rounded font-mono text-slate-700 font-semibold">{project.groupId}</span>
                            <span className="text-slate-300">•</span>
                            <span className="truncate">{project.groupTitle}</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Manager Name */}
                    <td className="py-2.5 px-3 whitespace-nowrap truncate">
                      <div className="flex items-center gap-1.5 truncate">
                        {project.manager.avatar ? (
                          <img 
                            src={project.manager.avatar} 
                            alt={project.manager.name} 
                            className="w-5 h-5 rounded-full object-cover shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                            <User className="w-2.5 h-2.5" />
                          </div>
                        )}
                        <span className="truncate">{project.manager.name}</span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusStyle(project.status)}`}>
                        {project.status}
                      </span>
                    </td>

                    {/* Last Responded */}
                    <td className="py-2.5 px-3 whitespace-nowrap truncate font-medium">
                      <span className={isUnresponded ? "text-amber-700 font-bold" : "text-slate-500"}>
                        {getTimeAgo(project.lastRespondedAt)}
                      </span>
                    </td>

                    {/* Internal Due Date */}
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-medium">
                      {formatDate(project.internalDueDate)}
                    </td>

                    {/* Client Due Date with formatting highlight if overdue */}
                    <td className="py-2.5 px-3 whitespace-nowrap font-medium">
                      <span className={isOverdue ? "text-rose-600 font-bold underline decoration-2" : "text-slate-800"}>
                        {formatDate(project.dueDate)}
                      </span>
                    </td>

                    {/* Flag Labels */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1 items-center">
                        {project.hasActiveSlaBreach && (
                          <span className="text-[9px] bg-rose-100 text-rose-800 px-1 py-0.5 rounded font-black uppercase tracking-tight animate-pulse border border-rose-200" title={`${project.slaBreachEmailsCount} client emails overdue > 4h`}>
                            🚨 SLA
                          </span>
                        )}
                        {isOverdue && (
                          <span className="text-[9px] bg-red-100 text-red-800 px-1 py-0.5 rounded font-bold uppercase tracking-tight border border-red-200">
                            Overdue
                          </span>
                        )}
                        {!isOverdue && isUnresponded && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-bold uppercase tracking-tight border border-amber-200">
                            No Resp
                          </span>
                        )}
                        {!isOverdue && !isUnresponded && isInternalOverdue && (
                          <span className="text-[9px] bg-amber-50 text-amber-700 px-1 py-0.5 rounded font-bold uppercase tracking-tight border border-amber-200">
                            Internal
                          </span>
                        )}
                        {!project.hasActiveSlaBreach && !isOverdue && !isUnresponded && !isInternalOverdue && (
                          <span className="text-[10px] text-slate-400">--</span>
                        )}
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
  );
}
