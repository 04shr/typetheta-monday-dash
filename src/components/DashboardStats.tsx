import React from "react";
import { MappedProject } from "../types";
import { 
  AlertCircle, 
  Clock, 
  Activity, 
  Calendar,
  AlertTriangle,
  Users,
  Mail
} from "lucide-react";

interface DashboardStatsProps {
  projects: MappedProject[];
  onSelectFilter: (filter: string) => void;
  activeFilter: string;
}

export default function DashboardStats({ projects, onSelectFilter, activeFilter }: DashboardStatsProps) {
  const total = projects.length;
  
  const completed = projects.filter((p) => {
    const s = p.status.toLowerCase();
    return s === "done" || s === "completed";
  }).length;

  const stuck = projects.filter((p) => {
    const s = p.status.toLowerCase();
    return s === "stuck" || s === "blocked";
  }).length;

  const overdue = projects.filter((p) => p.isOverdue).length;
  const internalOverdue = projects.filter((p) => p.isInternalOverdue).length;
  const unresponded = projects.filter((p) => p.isUnresponded2Days).length;
  const slaBreached = projects.filter((p) => p.hasActiveSlaBreach).length;

  // Active unique managers count
  const uniqueManagers = new Set(projects.map(p => p.manager.name).filter(Boolean)).size;

  const stats = [
    {
      id: "all",
      name: "Total Projects",
      value: total,
      subtext: `${completed} completed`,
      icon: Activity,
      borderColor: "border-gray-200",
      activeStyle: "bg-[#6161FF] text-white border-[#6161FF]",
      normalStyle: "bg-white hover:bg-gray-50 text-gray-900 border-gray-200",
      valueColor: "text-gray-900",
      activeValueColor: "text-white"
    },
    {
      id: "overdue",
      name: "Missed Deadlines",
      value: overdue,
      subtext: "Immediate action required",
      icon: AlertCircle,
      borderColor: "border-gray-200 border-l-4 border-l-red-500",
      activeStyle: "bg-red-600 text-white border-red-600",
      normalStyle: "bg-white hover:bg-red-50/30 text-gray-900 border-gray-200 border-l-4 border-l-red-500",
      valueColor: "text-red-600",
      activeValueColor: "text-white"
    },
    {
      id: "internal_overdue",
      name: "Internal Overdue",
      value: internalOverdue,
      subtext: "Stale internal target",
      icon: Calendar,
      borderColor: "border-gray-200 border-l-4 border-l-amber-500",
      activeStyle: "bg-amber-500 text-white border-amber-500",
      normalStyle: "bg-white hover:bg-amber-50/30 text-gray-900 border-gray-200 border-l-4 border-l-amber-500",
      valueColor: "text-amber-600",
      activeValueColor: "text-white"
    },
    {
      id: "unresponded",
      name: "No Response > 48h",
      value: unresponded,
      subtext: "Stale communication",
      icon: Clock,
      borderColor: "border-gray-200 border-l-4 border-l-indigo-500",
      activeStyle: "bg-indigo-600 text-white border-indigo-600",
      normalStyle: "bg-white hover:bg-indigo-50/30 text-gray-900 border-gray-200 border-l-4 border-l-indigo-500",
      valueColor: "text-indigo-600",
      activeValueColor: "text-white"
    },
    {
      id: "sla_breach",
      name: "SLA Breaches",
      value: slaBreached,
      subtext: "Email pending > 4 hours",
      icon: Mail,
      borderColor: "border-gray-200 border-l-4 border-l-rose-600",
      activeStyle: "bg-rose-700 text-white border-rose-700",
      normalStyle: "bg-white hover:bg-rose-50/30 text-gray-900 border-gray-200 border-l-4 border-l-rose-600",
      valueColor: "text-rose-600 font-extrabold",
      activeValueColor: "text-white"
    },
    {
      id: "stuck",
      name: "Stuck Projects",
      value: stuck,
      subtext: "Need immediate help",
      icon: AlertTriangle,
      borderColor: "border-gray-200 border-l-4 border-l-rose-500",
      activeStyle: "bg-rose-600 text-white border-rose-600",
      normalStyle: "bg-white hover:bg-rose-50/30 text-gray-900 border-gray-200 border-l-4 border-l-rose-500",
      valueColor: "text-rose-600",
      activeValueColor: "text-white"
    }
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {stats.map((stat) => {
          const isActive = activeFilter === stat.id;
          return (
            <button
              key={stat.id}
              id={`stat-card-${stat.id}`}
              onClick={() => onSelectFilter(stat.id)}
              className={`text-left p-4 rounded border shadow-xs transition-all duration-150 cursor-pointer flex flex-col justify-between ${
                isActive ? stat.activeStyle : stat.normalStyle
              }`}
            >
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${isActive ? "text-white/80" : "text-gray-500"}`}>
                  {stat.name}
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className={`text-2xl font-bold tracking-tight ${isActive ? stat.activeValueColor : stat.valueColor}`}>
                    {stat.value < 10 ? `0${stat.value}` : stat.value}
                  </span>
                </div>
              </div>
              <p className={`text-[11px] mt-2 ${isActive ? "text-white/70" : "text-gray-400"}`}>
                {stat.subtext}
              </p>
            </button>
          );
        })}
      </div>

      {/* Subtle Progress Bar Info */}
      <div className="bg-white border border-gray-200 p-3 rounded shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3 flex-1">
          <span className="font-semibold text-gray-700 uppercase tracking-wider text-[10px]">Board Completion:</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-md">
            <div 
              className="bg-[#6161FF] h-2 rounded-full transition-all duration-500"
              style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
            />
          </div>
          <span className="font-bold text-gray-900">{total > 0 ? Math.round((completed / total) * 100) : 0}% Done</span>
        </div>
        <div className="flex gap-4 text-[11px] text-gray-500 border-t md:border-t-0 md:border-l border-gray-100 pt-2 md:pt-0 md:pl-4">
          <span>Active Managers: <strong className="text-gray-900">{uniqueManagers}</strong></span>
          <span>Pending Actions: <strong className="text-red-500">{overdue + internalOverdue + unresponded}</strong></span>
        </div>
      </div>
    </div>
  );
}
