import React, { useState, useEffect } from "react";
import { ColumnMapping, MondayColumn, SlaConfig } from "../types";
import { 
  Key, 
  Layers, 
  HelpCircle, 
  Settings, 
  RefreshCw, 
  Info, 
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle2,
  BookmarkCheck
} from "lucide-react";

interface ConfigPanelProps {
  apiKey: string;
  boardId: string;
  columns: MondayColumn[];
  mapping: ColumnMapping;
  isDemoMode: boolean;
  isLoading: boolean;
  error: string | null;
  onConnect: (apiKey: string, boardId: string, keepFixed?: boolean) => Promise<void>;
  onUpdateMapping: (mapping: ColumnMapping) => void;
  onResetToDemo: () => void;
  allowedGroups: string[];
  onUpdateAllowedGroups: (groups: string[]) => void;
  slaConfig: SlaConfig;
  onUpdateSlaConfig: (config: SlaConfig) => void;
  hasPermanentConfig?: boolean;
  serverBoardId?: string;
  isFixedConfig?: boolean;
  onClearFixedConfig?: () => Promise<void>;
  slaTierHours: { [tier: string]: number };
  onUpdateSlaTierHours: (hours: { [tier: string]: number }) => void;
}

export default function ConfigPanel({
  apiKey,
  boardId,
  columns,
  mapping,
  isDemoMode,
  isLoading,
  error,
  onConnect,
  onUpdateMapping,
  onResetToDemo,
  allowedGroups,
  onUpdateAllowedGroups,
  slaConfig,
  onUpdateSlaConfig,
  hasPermanentConfig = false,
  serverBoardId = "",
  isFixedConfig = false,
  onClearFixedConfig,
  slaTierHours,
  onUpdateSlaTierHours,
}: ConfigPanelProps) {
  const [inputApiKey, setInputApiKey] = useState(() => apiKey || localStorage.getItem("monday_custom_api_key") || "");
  const [inputBoardId, setInputBoardId] = useState(() => boardId || localStorage.getItem("monday_board_id") || "1590190694");
  const [keepFixed, setKeepFixed] = useState<boolean>(true);
  const [isEditingUnlocked, setIsEditingUnlocked] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (apiKey) setInputApiKey(apiKey);
    if (boardId) setInputBoardId(boardId);
  }, [apiKey, boardId]);

  useEffect(() => {
    if (error || isDemoMode || !apiKey) {
      setIsEditingUnlocked(true);
    }
  }, [error, isDemoMode, apiKey]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect(inputApiKey.trim(), inputBoardId.trim(), keepFixed);
  };

  const handleSelectMapping = (field: keyof ColumnMapping, value: string) => {
    onUpdateMapping({
      ...mapping,
      [field]: value,
    });
  };

  return (
    <div className="bg-white rounded border border-gray-200 p-4 shadow-xs mb-6 flex flex-col gap-4">
      
      {/* Header & Status Indicator */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-gray-100 pb-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-4.5 h-4.5 text-[#6161FF]" />
            Monday.com API Connection Configuration
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Synchronize live items, managers, activity logs, and target columns using Monday.com credentials.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDemoMode ? (
            <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-250 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Demo Data Mode
            </span>
          ) : (
            <span className="bg-green-50 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded border border-green-250 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live Workspace Active
            </span>
          )}
          {!isDemoMode && (
            <button
              onClick={onResetToDemo}
              className="px-2 py-0.5 rounded border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-[10px] font-bold text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
            >
              Back to Demo
            </button>
          )}
        </div>
      </div>

      {/* Forms Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Left Side: API Key & Board ID Credentials */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-[#6161FF]" />
              API Token & Board ID Connection
            </h3>
            <div className="flex items-center gap-2">
              {(isFixedConfig || hasPermanentConfig) && (
                <button
                  type="button"
                  onClick={() => setIsEditingUnlocked(!isEditingUnlocked)}
                  className="text-[10px] text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {isEditingUnlocked ? <Lock className="w-3 h-3 text-indigo-600" /> : <Unlock className="w-3 h-3 text-indigo-600" />}
                  {isEditingUnlocked ? "Lock Inputs" : "Unlock to Edit"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowInstructions(!showInstructions)}
                className="text-[10px] text-[#6161FF] hover:text-[#5050e6] font-bold flex items-center gap-1 cursor-pointer"
              >
                <HelpCircle className="w-3 h-3" />
                {showInstructions ? "Hide Guide" : "Where to find?"}
              </button>
            </div>
          </div>

          {/* Permanent Fixed Status Notification Banner */}
          {(isFixedConfig || hasPermanentConfig) && !isEditingUnlocked && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-900 rounded-lg p-3 text-[11px] leading-relaxed flex items-start justify-between gap-2 shadow-2xs">
              <div className="flex items-start gap-2">
                <BookmarkCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-emerald-950 font-bold block text-xs">
                    📌 Credentials Fixed & Saved Permanently
                  </strong>
                  <p className="text-[10px] text-emerald-800 mt-0.5">
                    Your Monday.com API Token and Board ID (ID: <code className="font-mono bg-white/80 px-1 py-0.2 rounded border border-emerald-200 font-bold text-emerald-950">{inputBoardId || boardId || serverBoardId || "Saved"}</code>) are permanently locked and saved across all sessions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Help Instructions Box */}
          {showInstructions && (
            <div className="bg-gray-50 border border-gray-200 rounded p-3 text-[10px] text-gray-600 leading-relaxed space-y-2">
              <div>
                <strong className="text-gray-800">1. Generate your Personal API Token:</strong>
                <p className="mt-0.5">
                  Go to Monday.com, click your Avatar at bottom left &gt; select <strong className="text-gray-700">Administration</strong> &gt; click <strong className="text-slate-700">API</strong> tab &gt; click <strong className="text-slate-700">Generate Personal API Token</strong>.
                </p>
              </div>
              <div className="border-t border-gray-150 pt-1.5">
                <strong className="text-gray-800">2. Find your Board ID:</strong>
                <p className="mt-0.5">
                  In your web browser address bar on Monday, copy the final numbers: e.g. <code className="bg-gray-250 px-1 py-0.2 rounded font-mono">...boards/123456789</code>.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <div>
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-tight mb-1 flex items-center justify-between">
                <span>Personal API Token</span>
                {isFixedConfig && !isEditingUnlocked && (
                  <span className="text-[9px] text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Saved & Fixed
                  </span>
                )}
              </label>
              <input
                type="password"
                disabled={!isEditingUnlocked && (isFixedConfig || hasPermanentConfig)}
                placeholder={hasPermanentConfig || isFixedConfig ? "•••••••••••••••••••••••• (Fixed & Saved)" : "Paste your Monday.com API Token here..."}
                value={inputApiKey}
                onChange={(e) => setInputApiKey(e.target.value)}
                className={`w-full text-xs p-2 border rounded font-mono transition-colors ${
                  !isEditingUnlocked && (isFixedConfig || hasPermanentConfig)
                    ? "bg-slate-100 border-slate-300 text-slate-500 cursor-not-allowed"
                    : "bg-white border-gray-300 text-gray-900 focus:outline-none focus:border-[#6161FF]"
                }`}
                required={!hasPermanentConfig && !isFixedConfig}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-tight mb-1 flex items-center justify-between">
                <span>Board ID</span>
                {isFixedConfig && !isEditingUnlocked && (
                  <span className="text-[9px] text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Saved & Fixed
                  </span>
                )}
              </label>
              <input
                type="text"
                disabled={!isEditingUnlocked && (isFixedConfig || hasPermanentConfig)}
                placeholder={hasPermanentConfig || isFixedConfig ? `${inputBoardId || boardId || serverBoardId || "Fixed"}` : "Enter Monday.com Board ID..."}
                value={inputBoardId}
                onChange={(e) => setInputBoardId(e.target.value)}
                className={`w-full text-xs p-2 border rounded font-mono transition-colors ${
                  !isEditingUnlocked && (isFixedConfig || hasPermanentConfig)
                    ? "bg-slate-100 border-slate-300 text-slate-500 cursor-not-allowed"
                    : "bg-white border-gray-300 text-gray-900 focus:outline-none focus:border-[#6161FF]"
                }`}
                required={!hasPermanentConfig && !isFixedConfig}
              />
            </div>

            {/* Option to keep API & Board ID fixed all the time */}
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-md p-2.5 flex items-center gap-2 mt-0.5">
              <input
                type="checkbox"
                id="keep_fixed_checkbox"
                checked={keepFixed}
                onChange={(e) => setKeepFixed(e.target.checked)}
                className="w-4 h-4 rounded text-[#6161FF] focus:ring-[#6161FF] cursor-pointer"
              />
              <label htmlFor="keep_fixed_checkbox" className="text-xs font-bold text-indigo-950 cursor-pointer flex-1 select-none">
                🔒 Keep API Key & Board ID fixed and saved all the time
                <span className="block text-[10px] font-normal text-indigo-700 mt-0.5">
                  Automatically auto-connects to this Monday.com board on every page reload without asking again.
                </span>
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isLoading || (!hasPermanentConfig && !isFixedConfig && (!inputApiKey || !inputBoardId))}
              className="flex-1 py-2 bg-[#6161FF] hover:bg-[#5050e6] text-white rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Connecting & Syncing...
                </>
              ) : (
                <>
                  <BookmarkCheck className="w-4 h-4" />
                  {keepFixed ? "Save, Lock & Connect Live Board" : "Connect & Fetch Active Board"}
                </>
              )}
            </button>

            {isFixedConfig && onClearFixedConfig && (
              <button
                type="button"
                onClick={onClearFixedConfig}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-xs font-bold transition-colors cursor-pointer"
                title="Clear saved fixed credentials"
              >
                Unfix / Clear
              </button>
            )}
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-800 flex flex-col gap-2 shadow-2xs">
              <div className="flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold text-rose-950">Monday.com Connection Error:</strong>
                  <p className="mt-0.5 text-rose-900 leading-relaxed font-sans">{error}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rose-200/60 mt-0.5">
                <button
                  type="button"
                  onClick={() => setIsEditingUnlocked(true)}
                  className="text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-bold px-2.5 py-1 rounded transition-colors cursor-pointer"
                >
                  Unlock & Update Credentials
                </button>
                <button
                  type="button"
                  onClick={onResetToDemo}
                  className="text-[10px] bg-white border border-rose-300 hover:bg-rose-100/50 text-rose-800 font-bold px-2.5 py-1 rounded transition-colors cursor-pointer"
                >
                  Switch to Interactive Demo Mode
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Right Side: Column Mappings Setup */}
        <div className="bg-gray-50/50 rounded p-3.5 border border-gray-200 flex flex-col gap-3">
          <h3 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#6161FF]" />
            Column Schema Mapper
          </h3>

          {columns.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-gray-400">
              <Info className="w-6 h-6 text-gray-300 mb-1" />
              <p className="text-[10px] max-w-xs leading-normal leading-relaxed">
                Provide valid API token and Board ID to query live schemas and bind columns.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-3">
              <div className="bg-green-50 border border-green-100 rounded p-2 text-[10px] text-green-800 leading-normal">
                🎉 Schema loaded. Set your column bindings below to map status, managers, and deadlines:
              </div>

              <div className="grid grid-cols-2 gap-3">
                
                {/* Status Column Mapping */}
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Status Column</label>
                  <select
                    value={mapping.statusColId}
                    onChange={(e) => handleSelectMapping("statusColId", e.target.value)}
                    className="text-xs p-1.5 bg-white border border-gray-200 rounded text-gray-700 focus:outline-none focus:border-[#6161FF]"
                  >
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.title} ({col.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Manager Column Mapping */}
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Manager (People)</label>
                  <select
                    value={mapping.managerColId}
                    onChange={(e) => handleSelectMapping("managerColId", e.target.value)}
                    className="text-xs p-1.5 bg-white border border-gray-200 rounded text-gray-700 focus:outline-none focus:border-[#6161FF]"
                  >
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.title} ({col.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Due Date Column Mapping */}
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">External Deadline</label>
                  <select
                    value={mapping.dueDateColId}
                    onChange={(e) => handleSelectMapping("dueDateColId", e.target.value)}
                    className="text-xs p-1.5 bg-white border border-gray-200 rounded text-gray-700 focus:outline-none focus:border-[#6161FF]"
                  >
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.title} ({col.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Internal Due Date Column Mapping */}
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">Internal Target</label>
                  <select
                    value={mapping.internalDueDateColId}
                    onChange={(e) => handleSelectMapping("internalDueDateColId", e.target.value)}
                    className="text-xs p-1.5 bg-white border border-gray-200 rounded text-gray-700 focus:outline-none focus:border-[#6161FF]"
                  >
                    <option value="">-- None --</option>
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.title} ({col.type})
                      </option>
                    ))}
                  </select>
                </div>

              </div>
            </div>
          )}
        </div>

      </div>

      {/* Dynamic SLA & Board Filter Controls - Pinned & Fixed Section */}
      <div className="border-t-2 border-[#6161FF] pt-4 mt-2 bg-slate-50/70 p-4 rounded-xl shadow-xs sticky bottom-0 z-10 backdrop-blur-md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5 text-[#6161FF]" />
            SLA Compliance & Board Filter Rules (Dynamic Conditions)
          </h3>
          <span className="text-[10px] bg-[#6161FF] text-white px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-2xs">
            <span>📌</span> Fixed SLA Rules Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* SLA Hours Target & Working Window */}
          <div className="bg-white p-3.5 rounded-lg border border-gray-200 flex flex-col gap-3 shadow-2xs">
            <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
              <span>⏱️</span> CLIENT EMAIL SLA BOUNDS
            </h4>
            
            <div className="flex flex-col gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 font-semibold mb-1">
                  SLA Response Limit (Hours)
                </label>
                <input
                  type="number"
                  min={1}
                  max={72}
                  value={slaConfig.slaHoursLimit}
                  onChange={(e) => onUpdateSlaConfig({ ...slaConfig, slaHoursLimit: parseInt(e.target.value) || 2 })}
                  className="w-full text-xs p-1.5 border border-gray-300 rounded focus:outline-none focus:border-[#6161FF] text-gray-900 font-bold bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 font-semibold mb-1">
                    Work Hour Start (0-23)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={slaConfig.workingHoursStart}
                    onChange={(e) => onUpdateSlaConfig({ ...slaConfig, workingHoursStart: parseInt(e.target.value) ?? 9 })}
                    className="w-full text-xs p-1.5 border border-gray-300 rounded focus:outline-none focus:border-[#6161FF] text-gray-900 font-bold font-mono bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 font-semibold mb-1">
                    Work Hour End (0-23)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={slaConfig.workingHoursEnd}
                    onChange={(e) => onUpdateSlaConfig({ ...slaConfig, workingHoursEnd: parseInt(e.target.value) ?? 17 })}
                    className="w-full text-xs p-1.5 border border-gray-300 rounded focus:outline-none focus:border-[#6161FF] text-gray-900 font-bold font-mono bg-white"
                  />
                </div>
              </div>

              {/* Dynamic Multi-Tier SLA Targets */}
              <div className="border-t border-gray-200 pt-2.5 mt-1">
                <span className="block text-[10px] text-[#6161FF] font-extrabold uppercase tracking-tight mb-2">
                  MULTI-TIER SLA TARGETS (HOURS)
                </span>
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  <div>
                    <label className="block text-[8px] text-gray-400 font-semibold uppercase mb-0.5" title="Platinum">PLAT</label>
                    <input
                      type="number"
                      min={1}
                      max={72}
                      value={slaTierHours.Platinum ?? 1}
                      onChange={(e) => onUpdateSlaTierHours({ ...slaTierHours, Platinum: parseInt(e.target.value) || 1 })}
                      className="w-full text-center text-xs p-1 border border-gray-300 rounded font-mono font-bold text-gray-900 focus:outline-[#6161FF]"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] text-gray-400 font-semibold uppercase mb-0.5" title="Gold">GOLD</label>
                    <input
                      type="number"
                      min={1}
                      max={72}
                      value={slaTierHours.Gold ?? 1}
                      onChange={(e) => onUpdateSlaTierHours({ ...slaTierHours, Gold: parseInt(e.target.value) || 1 })}
                      className="w-full text-center text-xs p-1 border border-gray-300 rounded font-mono font-bold text-gray-900 focus:outline-[#6161FF]"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] text-gray-400 font-semibold uppercase mb-0.5" title="Silver">SILVER</label>
                    <input
                      type="number"
                      min={1}
                      max={72}
                      value={slaTierHours.Silver ?? 4}
                      onChange={(e) => onUpdateSlaTierHours({ ...slaTierHours, Silver: parseInt(e.target.value) || 4 })}
                      className="w-full text-center text-xs p-1 border border-gray-300 rounded font-mono font-bold text-gray-900 focus:outline-[#6161FF]"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] text-gray-400 font-semibold uppercase mb-0.5" title="Bronze">BRONZE</label>
                    <input
                      type="number"
                      min={1}
                      max={72}
                      value={slaTierHours.Bronze ?? 4}
                      onChange={(e) => onUpdateSlaTierHours({ ...slaTierHours, Bronze: parseInt(e.target.value) || 4 })}
                      className="w-full text-center text-xs p-1 border border-gray-300 rounded font-mono font-bold text-gray-900 focus:outline-[#6161FF]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Alert Threshold Offsets */}
          <div className="bg-white p-3.5 rounded-lg border border-gray-200 flex flex-col gap-3 shadow-2xs">
            <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
              <span>⚠️</span> STALENESS & WARNING THRESHOLDS
            </h4>
            
            <div className="flex flex-col gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 font-semibold mb-1">
                  Monday Board Update Staleness (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={slaConfig.staleDaysLimit}
                  onChange={(e) => onUpdateSlaConfig({ ...slaConfig, staleDaysLimit: parseInt(e.target.value) || 2 })}
                  className="w-full text-xs p-1.5 border border-gray-300 rounded focus:outline-none focus:border-[#6161FF] text-gray-900 font-bold bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 font-semibold mb-1">
                  Client Deadline Red Alert (Days Prior)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={slaConfig.clientDeadlineAlertDays}
                  onChange={(e) => onUpdateSlaConfig({ ...slaConfig, clientDeadlineAlertDays: parseInt(e.target.value) || 7 })}
                  className="w-full text-xs p-1.5 border border-gray-300 rounded focus:outline-none focus:border-[#6161FF] text-gray-900 font-bold bg-white"
                />
              </div>
            </div>
          </div>

          {/* Active Board Groups Structure */}
          <div className="bg-white p-3.5 rounded-lg border border-gray-200 flex flex-col gap-3 shadow-2xs">
            <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
              <span>📁</span> BOARD GROUP FILTERS (STRUCTURE)
            </h4>
            
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="block text-[10px] text-gray-500 font-semibold">
                Analyzed Groups (Comma separated)
              </label>
              <textarea
                rows={3}
                value={allowedGroups.join(", ")}
                onChange={(e) => {
                  const items = e.target.value
                    .split(",")
                    .map(item => item.trim())
                    .filter(Boolean);
                  onUpdateAllowedGroups(items);
                }}
                className="w-full flex-1 text-xs p-1.5 border border-gray-300 rounded focus:outline-none focus:border-[#6161FF] text-gray-800 font-sans leading-relaxed bg-white"
                placeholder="e.g. NEW LEAD, IN PROGRESS, ONE-OFF PROJECTS, YEARLY PROJECTS, ONGOING"
              />
              <p className="text-[9px] text-gray-500">
                Only projects in these Monday board groups will be mapped and analyzed.
              </p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
