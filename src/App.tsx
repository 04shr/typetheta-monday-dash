import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  MondayBoard, 
  ColumnMapping, 
  MappedProject, 
  MondayUpdate,
  ProjectEmail,
  SlaConfig
} from "./types";
import { MOCK_BOARD, DEFAULT_MOCK_MAPPING } from "./mockData";
import { mapMondayBoardToProjects, autoDetectColumnMapping } from "./utils/projectMapper";
import { getInitialMockEmails, isSlaBreached } from "./utils/slaHelper";
import { safeFetchJson, safeFetchJsonWithBackoff } from "./utils/apiHelper";
import DashboardStats from "./components/DashboardStats";
import ProjectTable from "./components/ProjectTable";
import ProjectDetailModal from "./components/ProjectDetailModal";
import ConfigPanel from "./components/ConfigPanel";
import ProjectCards from "./components/ProjectCards";
import FounderReport from "./components/FounderReport";
import TypeThetaDashboard from "./components/TypeThetaDashboard";
import TypeThetaLogo from "./components/TypeThetaLogo";
import PortalAuthModal, { PortalUser } from "./components/PortalAuthModal";
import LoginScreen from "./components/LoginScreen";
import TwoFactorModal from "./components/TwoFactorModal";
import InviteLinkModal from "./components/InviteLinkModal";
import { 
  Settings, 
  Search, 
  RefreshCw, 
  Activity,
  Eye, 
  FileText, 
  Database,
  ArrowRight,
  Info,
  SlidersHorizontal,
  Plus,
  LayoutDashboard,
  Users,
  AlertTriangle,
  Mail,
  Bell,
  List,
  LayoutGrid,
  Lock,
  ShieldAlert,
  UserCheck,
  ShieldCheck,
  UserPlus,
  LogIn,
  LogOut,
  Handshake,
  ListTodo,
  Flag,
  Clock,
  FileWarning,
  BookOpen,
  ChevronRight,
  ChevronDown,
  Sparkles,
  X
} from "lucide-react";

export default function App() {
  // User Authentication & Portal Access State - Always require login on page access
  const [currentUser, setCurrentUser] = useState<PortalUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isInviteObserverMode, setIsInviteObserverMode] = useState(false);

  // Connection state (Security: API keys are handled server-side or stored securely in custom user local storage)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("monday_custom_api_key") || "");
  const [boardId, setBoardId] = useState(() => localStorage.getItem("monday_board_id") || "1590190694");
  const [isFixedConfig, setIsFixedConfig] = useState(() => {
    const saved = localStorage.getItem("monday_is_fixed");
    return saved !== null ? saved === "true" : true;
  });
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [hasPermanentConfig, setHasPermanentConfig] = useState(true);
  const [serverBoardId, setServerBoardId] = useState("1590190694");

  // Board Data State
  const [board, setBoard] = useState<MondayBoard | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(DEFAULT_MOCK_MAPPING);
  
  // Dynamic Board Structure / Filter Groups state
  const [allowedGroups, setAllowedGroups] = useState<string[]>(() => {
    const saved = localStorage.getItem("monday_allowed_groups");
    return saved ? JSON.parse(saved) : ["NEW LEAD", "IN PROGRESS", "ONE-OFF PROJECTS", "YEARLY PROJECTS", "ONGOING"];
  });

  // Dynamic SLA & Risk warning thresholds state
  const [slaConfig, setSlaConfig] = useState<SlaConfig>(() => {
    const saved = localStorage.getItem("monday_sla_config");
    return saved ? JSON.parse(saved) : {
      slaHoursLimit: 2,
      workingHoursStart: 9,
      workingHoursEnd: 17,
      staleDaysLimit: 2,
      clientDeadlineAlertDays: 7
    };
  });

  // Project-specific SLA tier override state (persisted)
  const [projectSlaTiers, setProjectSlaTiers] = useState<{ [projectId: string]: string }>(() => {
    const saved = localStorage.getItem("monday_project_sla_tiers");
    return saved ? JSON.parse(saved) : {};
  });

  // Global Multi-tier SLA bounds state (persisted)
  const [slaTierHours, setSlaTierHours] = useState<{ [tier: string]: number }>(() => {
    const saved = localStorage.getItem("monday_sla_tier_hours");
    return saved ? JSON.parse(saved) : {
      Platinum: 1,
      Gold: 1,
      Silver: 4,
      Bronze: 4
    };
  });

  // Persist configurations
  useEffect(() => {
    localStorage.setItem("monday_allowed_groups", JSON.stringify(allowedGroups));
  }, [allowedGroups]);

  useEffect(() => {
    localStorage.setItem("monday_sla_config", JSON.stringify(slaConfig));
  }, [slaConfig]);

  useEffect(() => {
    localStorage.setItem("monday_project_sla_tiers", JSON.stringify(projectSlaTiers));
  }, [projectSlaTiers]);

  useEffect(() => {
    localStorage.setItem("monday_sla_tier_hours", JSON.stringify(slaTierHours));
  }, [slaTierHours]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("typetheta_current_user", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("typetheta_current_user");
    }
  }, [currentUser]);

  // UI states
  const [currentView, setCurrentView] = useState<"founder" | "action_board" | "promise_tracker" | "risk_queue" | "internal_flags" | "email_sla" | "followup_queue" | "managers" | "missing_data" | "wiki" | "owner" | "manager" | "risk" | "sla">("founder");
  const [viewLayout, setViewLayout] = useState<"table" | "card">("table");
  const [selectedManager, setSelectedManager] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<MappedProject | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SLA & Email State
  const [projectEmails, setProjectEmails] = useState<{ [projectId: string]: ProjectEmail[] }>({});
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "info" } | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());
  const [is2FaModalOpen, setIs2FaModalOpen] = useState(false);

  // Toast auto-clear
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Check for Observer invite link URL query parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteParam = (params.get("invite") || params.get("role") || params.get("mode") || "").toLowerCase();
    if (inviteParam === "observer") {
      setIsInviteObserverMode(true);
      if (!currentUser) {
        const guestObserver: PortalUser = {
          id: "guest_observer_user",
          name: "Guest Observer",
          email: "observer@guest.view",
          role: "Observer",
          registeredAt: new Date().toISOString(),
          avatarBg: "bg-slate-700"
        };
        setCurrentUser(guestObserver);
        setToastMessage({
          text: "👁️ Logged in via Observer Invite Link (Read-Only Access)",
          type: "info"
        });
      }
    }
  }, []);

  // Check for server-side permanent configuration on mount & auto-sync live board
  useEffect(() => {
    const checkServerConfig = async () => {
      const customKey = localStorage.getItem("monday_custom_api_key");
      const customBoard = localStorage.getItem("monday_board_id");
      try {
        const data = await safeFetchJson<{ hasPermanentConfig: boolean; boardId: string; apiKey?: string }>("/api/monday/config");
        if (data && data.hasPermanentConfig) {
          const bId = customBoard || data.boardId || "1590190694";
          setHasPermanentConfig(true);
          setServerBoardId(bId);
          if (customKey) {
            setApiKey(customKey);
          } else if (data.apiKey) {
            setApiKey(data.apiKey);
          }
          setIsFixedConfig(true);
          fetchLiveBoard(customKey || data.apiKey || "", bId, true);
        } else {
          fetchLiveBoard(customKey || apiKey || "", customBoard || boardId || "1590190694", true);
        }
      } catch (err) {
        console.error("Error fetching permanent server config:", err);
        fetchLiveBoard(customKey || apiKey || "", customBoard || boardId || "1590190694", true);
      }
    };
    checkServerConfig();
  }, []);

  // Sync live board automatically whenever user logs in or currentUser changes, & continuously poll real-time every 30s
  useEffect(() => {
    if (currentUser) {
      const customKey = localStorage.getItem("monday_custom_api_key") || apiKey || "";
      const bId = localStorage.getItem("monday_board_id") || serverBoardId || boardId || "1590190694";
      fetchLiveBoard(customKey, bId, true);

      const liveInterval = setInterval(() => {
        fetchLiveBoard(customKey, bId, true);
      }, 30000);

      return () => clearInterval(liveInterval);
    }
  }, [currentUser?.id, serverBoardId, boardId, apiKey]);

  // Pre-seed project emails for any board items loaded
  useEffect(() => {
    if (board && board.items_page?.items) {
      const items = board.items_page.items;
      setProjectEmails((prev) => {
        const updated = { ...prev };
        let changed = false;
        items.forEach((item) => {
          if (!updated[item.id]) {
            updated[item.id] = getInitialMockEmails(item.id);
            changed = true;
          }
        });
        return changed ? updated : prev;
      });
    }
  }, [board]);

  const fetchLiveBoard = async (keyToUse: string, boardIdToUse: string, isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    setError(null);
    const targetBoardId = boardIdToUse || localStorage.getItem("monday_board_id") || serverBoardId || boardId || "1590190694";
    const targetApiKey = keyToUse || apiKey || localStorage.getItem("monday_custom_api_key") || "";
    const payload = { apiKey: targetApiKey, boardId: targetBoardId };

    console.log("[Sync Diagnostic]", {
      timestamp: new Date().toISOString(),
      isSilent,
      endpoint: "/api/monday/fetch",
      requestPayload: payload,
      hasApiKey: !!targetApiKey,
      apiKeyLength: targetApiKey ? targetApiKey.length : 0,
      hasBoardId: !!targetBoardId,
      boardId: targetBoardId
    });

    try {
      const data = await safeFetchJsonWithBackoff<{ board: MondayBoard }>("/api/monday/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }, {
        maxRetries: 2,
        baseDelayMs: 1000,
        onRetry: (attempt, err, delayMs) => {
          console.warn(`[fetchLiveBoard] Attempt ${attempt} failed (${err?.message || err}). Retrying in ${delayMs}ms...`);
        }
      });

      const liveBoard: MondayBoard = data.board;
      
      setBoard(liveBoard);
      setLastSyncedAt(new Date());
      
      // Auto-detect columns
      const detectedMapping = autoDetectColumnMapping(liveBoard.columns);
      setMapping(detectedMapping);
      
      if (targetBoardId) {
        localStorage.setItem("monday_board_id", targetBoardId);
        setBoardId(targetBoardId);
      }
      setIsDemoMode(false);
      localStorage.setItem("monday_is_demo", "false");
      setShowConfig(false); // Hide settings panel on success
      if (!isSilent) {
        setToastMessage({
          text: "⚡ Real-time sync complete! Live Monday.com board updated.",
          type: "success"
        });
      }
    } catch (err: any) {
      console.warn("Live board sync temporary notice:", err?.message || err);
      setIsDemoMode(true);
      if (!board) {
        setBoard(MOCK_BOARD);
        setMapping(DEFAULT_MOCK_MAPPING);
      }
      const cleanMsg = (err?.message || "").includes("401") || (err?.message || "").includes("Unauthorized")
        ? "Invalid or expired Monday.com API Token."
        : (err?.message || "Unable to reach Monday.com API server.");

      if (showConfig) {
        setError(`${cleanMsg} You can use Offline Demo Mode or enter a valid Monday API Token & Board ID.`);
      } else if (!isSilent) {
        setToastMessage({
          text: `⚠️ Sync issue: ${cleanMsg} Switched to Offline Demo Board.`,
          type: "info"
        });
      }
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  const handleConnectLive = async (newApiKey: string, newBoardId: string, keepFixed: boolean = true) => {
    const cleanApiKey = (newApiKey || "").trim();
    const cleanBoardId = (newBoardId || "").trim();

    const keyToUse = cleanApiKey || apiKey || localStorage.getItem("monday_custom_api_key") || "";
    const boardIdToUse = cleanBoardId || boardId || localStorage.getItem("monday_board_id") || "1590190694";

    if (cleanApiKey && !cleanApiKey.includes("•")) {
      localStorage.setItem("monday_custom_api_key", cleanApiKey);
      setApiKey(cleanApiKey);
    }
    if (cleanBoardId) {
      localStorage.setItem("monday_board_id", cleanBoardId);
      setBoardId(cleanBoardId);
    }

    if (keepFixed && (keyToUse || boardIdToUse)) {
      setIsFixedConfig(true);
      localStorage.setItem("monday_is_fixed", "true");

      try {
        await safeFetchJson("/api/monday/save-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: keyToUse, boardId: boardIdToUse, isFixed: true })
        });
        setToastMessage({ text: "📌 API Key & Board ID saved locally and on server!", type: "success" });
      } catch (err) {
        console.warn("Notice: Saved credentials locally:", err);
      }
    } else if (!keepFixed) {
      setIsFixedConfig(false);
      localStorage.removeItem("monday_is_fixed");
    }

    await fetchLiveBoard(keyToUse, boardIdToUse, false);
  };

  const handleClearFixedConfig = async () => {
    setIsFixedConfig(false);
    localStorage.removeItem("monday_is_fixed");
    localStorage.removeItem("monday_custom_api_key");
    localStorage.removeItem("monday_api_key");
    localStorage.removeItem("monday_board_id");
    setApiKey("");
    setBoardId("1590190694");
    setIsDemoMode(true);
    setBoard(MOCK_BOARD);
    setMapping(DEFAULT_MOCK_MAPPING);
    try {
      await safeFetchJson("/api/monday/clear-config", { method: "POST" });
    } catch (err) {
      console.error(err);
    }
    setToastMessage({ text: "Credentials cleared. Switched to Demo Board.", type: "info" });
  };

  const handleUpdateMapping = (newMapping: ColumnMapping) => {
    setMapping(newMapping);
  };

  const handleResetToDemo = () => {
    setIsDemoMode(true);
    setError(null);
    setShowConfig(false);
  };

  const handleAddComment = async (projectId: string, commentText: string) => {
    if (isDemoMode) {
      // Simulate adding update to mock data
      setBoard((prevBoard) => {
        if (!prevBoard || !prevBoard.items_page) return prevBoard;
        
        const updatedItems = prevBoard.items_page.items.map((item) => {
          if (item.id === projectId) {
            const newUpdate: MondayUpdate = {
              id: `u_mock_${Date.now()}`,
              body: commentText,
              created_at: new Date().toISOString(),
              creator: {
                id: "usr_me",
                name: "Ankit Sethia (You)",
                photo_thumb: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
              },
            };
            return {
              ...item,
              updates: [newUpdate, ...(item.updates || [])],
            };
          }
          return item;
        });

        return {
          ...prevBoard,
          items_page: {
            items: updatedItems,
          },
        };
      });

      // Update selected project view if active
      setSelectedProject((prev) => {
        if (!prev || prev.id !== projectId) return prev;
        const newUpdate: MondayUpdate = {
          id: `u_mock_${Date.now()}`,
          body: commentText,
          created_at: new Date().toISOString(),
          creator: {
            id: "usr_me",
            name: "Ankit Sethia (You)",
            photo_thumb: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
          },
        };
        return {
          ...prev,
          updates: [newUpdate, ...prev.updates],
        };
      });

    } else {
      try {
        // Send real comment request to Monday.com API via proxy server with exponential backoff
        await safeFetchJsonWithBackoff("/api/monday/comment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apiKey,
            itemId: projectId,
            commentText,
          }),
        });

        // Re-fetch board state silently to show new comment and update last responded date
        fetchLiveBoard(apiKey, boardId, true);
      } catch (err) {
        console.warn("Live comment API call failed, applying update locally:", err);
        setSelectedProject((prev) => {
          if (!prev || prev.id !== projectId) return prev;
          const newUpdate: MondayUpdate = {
            id: `u_mock_${Date.now()}`,
            body: commentText,
            created_at: new Date().toISOString(),
            creator: {
              id: currentUser?.id || "usr_me",
              name: currentUser?.name || "Project Manager",
              photo_thumb: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
            },
          };
          return {
            ...prev,
            updates: [newUpdate, ...prev.updates],
          };
        });
      }
    }
  };

  const handleReplyToEmail = (projectId: string, emailId: string, replyText: string) => {
    setProjectEmails((prev) => {
      const updated = { ...prev };
      if (updated[projectId]) {
        updated[projectId] = updated[projectId].map((email) => {
          if (email.id === emailId) {
            return {
              ...email,
              isResponded: true,
              respondedAt: new Date().toISOString()
            };
          }
          return email;
        });
      }
      return updated;
    });

    handleAddComment(projectId, replyText);
    setToastMessage({
      text: "Email reply posted and synchronized to Monday board!",
      type: "success"
    });
  };

  const handleSendSlaReminder = (projectId: string, emailId: string) => {
    let pmName = "Project Manager";
    const project = projects.find(p => p.id === projectId);
    if (project) {
      pmName = project.manager.name;
    }

    setProjectEmails((prev) => {
      const updated = { ...prev };
      if (updated[projectId]) {
        updated[projectId] = updated[projectId].map((email) => {
          if (email.id === emailId) {
            return {
              ...email,
              reminderSentCount: email.reminderSentCount + 1,
              lastReminderSentAt: new Date().toISOString()
            };
          }
          return email;
        });
      }
      return updated;
    });

    const email = project?.emails.find(e => e.id === emailId);
    const subjectLine = email ? `"${email.subject}"` : "the pending client email";

    handleAddComment(projectId, `🔔 [SLA ALERT TO PM]: Automated reminder sent to @${pmName} regarding unresponded client email: ${subjectLine}. SLA Target of 4 hours exceeded.`);

    setToastMessage({
      text: `Urgent SLA reminder pinged to ${pmName} via Slack & Email!`,
      type: "success"
    });
  };

  const handleSimulateIncomingEmail = (projectId: string, sender: string, subject: string, hoursAgo: number) => {
    const newEmail: ProjectEmail = {
      id: `email_sim_${Date.now()}`,
      sender,
      subject,
      receivedAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
      isResponded: false,
      reminderSentCount: 0
    };

    setProjectEmails((prev) => {
      const updated = { ...prev };
      const list = updated[projectId] || [];
      updated[projectId] = [newEmail, ...list];
      return updated;
    });

    setToastMessage({
      text: `Incoming email simulated from ${sender}!`,
      type: "info"
    });
  };

  const handleChangeProjectSlaTier = (projectId: string, tier: string) => {
    setProjectSlaTiers(prev => ({
      ...prev,
      [projectId]: tier
    }));
    setToastMessage({
      text: `SLA tier for project updated to ${tier}!`,
      type: "success"
    });
  };

  const handleUpdateMondayCell = async (projectId: string, columnId: string, columnType: "status" | "date", newValue: string) => {
    if (isDemoMode) {
      // Simulate cell update on the mock board
      setBoard((prevBoard) => {
        if (!prevBoard || !prevBoard.items_page) return prevBoard;
        const updatedItems = prevBoard.items_page.items.map((item) => {
          if (item.id === projectId) {
            const updatedColumnValues = item.column_values.map((col) => {
              if (col.id === columnId) {
                return {
                  ...col,
                  text: newValue,
                  value: JSON.stringify(columnType === "date" ? { date: newValue } : { index: 1 })
                };
              }
              return col;
            });
            return {
              ...item,
              column_values: updatedColumnValues
            };
          }
          return item;
        });
        return {
          ...prevBoard,
          items_page: {
            items: updatedItems
          }
        };
      });

      // Update selected project view if active
      setSelectedProject((prev) => {
        if (!prev || prev.id !== projectId) return prev;
        if (columnId === mapping.statusColId) {
          return { ...prev, status: newValue };
        } else if (columnId === mapping.dueDateColId) {
          return { ...prev, dueDate: newValue };
        } else if (columnId === mapping.internalDueDateColId) {
          return { ...prev, internalDueDate: newValue };
        }
        return prev;
      });

      setToastMessage({
        text: `Mock cell write-back successful! Status/Date updated to "${newValue}"`,
        type: "success"
      });
    } else {
      try {
        // Real API write-back call to Proxy server
        await safeFetchJson("/api/monday/writeback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey,
            boardId,
            itemId: projectId,
            columnId,
            columnType,
            newValue
          })
        });

        setToastMessage({
          text: "Monday.com cells updated and synced successfully!",
          type: "success"
        });

        // Re-fetch board state silently to sync changes
        fetchLiveBoard(apiKey, boardId, true);
      } catch (err) {
        console.warn("Live writeback API call failed, applying update locally:", err);
        setSelectedProject((prev) => {
          if (!prev || prev.id !== projectId) return prev;
          if (columnId === mapping.statusColId) {
            return { ...prev, status: newValue };
          } else if (columnId === mapping.dueDateColId) {
            return { ...prev, dueDate: newValue };
          } else if (columnId === mapping.internalDueDateColId) {
            return { ...prev, internalDueDate: newValue };
          }
          return prev;
        });

        setToastMessage({
          text: `Updated locally! (Live writeback paused)`,
          type: "info"
        });
      }
    }
  };

  // Compute final projects listing
  const todayStr = "2026-07-01"; // current reference date
  const rawProjects = board ? mapMondayBoardToProjects(board, mapping, todayStr) : [];
  
  // Custom board filtering based on user-configured groups
  const LOWER_ALLOWED_GROUPS = allowedGroups.map(g => g.toLowerCase().trim());
  const projects = rawProjects
    .filter((p) => {
      const gId = (p.groupId || "").toLowerCase().trim();
      const gTitle = (p.groupTitle || "").toLowerCase().trim();
      return LOWER_ALLOWED_GROUPS.includes(gId) || 
             LOWER_ALLOWED_GROUPS.includes(gTitle) ||
             LOWER_ALLOWED_GROUPS.some(g => g.replace(/\s+/g, "_") === gId || g.replace(/_+/g, " ") === gTitle);
    })
    .map((p) => {
      const storedEmails = projectEmails[p.id];
      const emails = (storedEmails && storedEmails.length > 0) ? storedEmails : getInitialMockEmails(p.id);
      const tier = projectSlaTiers[p.id] || "Gold";
      const actualSlaLimit = slaTierHours[tier] ?? slaConfig.slaHoursLimit;

      const slaBreachEmailsCount = emails.filter(e => isSlaBreached(
        e,
        actualSlaLimit,
        slaConfig.workingHoursStart,
        slaConfig.workingHoursEnd
      )).length;
      return {
        ...p,
        emails,
        hasActiveSlaBreach: slaBreachEmailsCount > 0,
        slaBreachEmailsCount,
        slaLimitHours: actualSlaLimit,
        slaTier: tier
      };
    });

  const uniqueManagers = Array.from(new Set(projects.map((p) => p.manager.name).filter(Boolean)));

  // Reset selected manager if current selection is no longer in board managers
  useEffect(() => {
    if (uniqueManagers.length > 0 && selectedManager && !uniqueManagers.includes(selectedManager)) {
      setSelectedManager("");
    }
  }, [board, selectedManager, uniqueManagers.join(",")]);

  // Total at-risk projects globally
  const riskProjectsCount = projects.filter((p) => 
    p.isOverdue || p.isInternalOverdue || p.isUnresponded2Days || p.hasActiveSlaBreach ||
    p.status.toLowerCase().includes("stuck") || p.status.toLowerCase().includes("blocked")
  ).length;

  const totalSlaBreachedEmails = projects.reduce((acc, p) => acc + (p.slaBreachEmailsCount || 0), 0);

  const handleAutoRemindAllPms = () => {
    let count = 0;
    projects.forEach((project) => {
      const actualSlaLimit = project.slaLimitHours ?? slaConfig.slaHoursLimit;
      project.emails.forEach((email) => {
        if (isSlaBreached(
          email,
          actualSlaLimit,
          slaConfig.workingHoursStart,
          slaConfig.workingHoursEnd
        )) {
          handleSendSlaReminder(project.id, email.id);
          count++;
        }
      });
    });

    if (count > 0) {
      setToastMessage({
        text: `Successfully dispatched ${count} SLA breach reminders to all corresponding PMs!`,
        type: "success"
      });
    } else {
      setToastMessage({
        text: "No pending SLA email breaches found to notify PMs.",
        type: "info"
      });
    }
  };

  // Active workspace filter based on currentView
  let viewProjects = [...projects];
  if (currentView === "manager") {
    viewProjects = projects.filter((p) => p.manager.name === selectedManager);
  } else if (currentView === "risk") {
    viewProjects = projects.filter((p) => 
      p.isOverdue || p.isInternalOverdue || p.isUnresponded2Days || p.hasActiveSlaBreach ||
      p.status.toLowerCase().includes("stuck") || p.status.toLowerCase().includes("blocked")
    );
  } else if (currentView === "sla") {
    viewProjects = projects.filter((p) => p.emails && p.emails.length > 0);
  }

  // Filter & Search projects
  const filteredProjects = viewProjects.filter((project) => {
    // 1. Text Search matching name or manager
    const matchesSearch = 
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.manager.name.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Tab Category filters (controlled by stat cards)
    switch (activeFilter) {
      case "overdue":
        return project.isOverdue;
      case "internal_overdue":
        return project.isInternalOverdue;
      case "unresponded":
        return project.isUnresponded2Days;
      case "sla_breach":
        return project.hasActiveSlaBreach;
      case "stuck":
        return project.status.toLowerCase().includes("stuck") || project.status.toLowerCase().includes("blocked");
      default:
        return true;
    }
  });

  // Secure authentication gate: If user is logged out, show ONLY the Login Screen
  if (!currentUser) {
    return <LoginScreen onLogin={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800">
      
      {/* Upper Navigation Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TypeThetaLogo height={32} />
            <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>
            <div>
              <h1 className="text-xs font-bold text-gray-900 flex items-center gap-1.5 uppercase tracking-wide">
                Monday.com Command Centre
              </h1>
              <p className="text-[10px] text-gray-400">
                Live monitoring, manager mapping, target reminders & email SLA tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* User Profile & Log Out */}
            {currentUser && (
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-xl text-white">
                <div className={`w-4 h-4 rounded-full ${currentUser.avatarBg || 'bg-purple-600'} text-white font-extrabold text-[9px] flex items-center justify-center`}>
                  {currentUser.name.charAt(0)}
                </div>
                <span className="font-extrabold text-slate-100 text-xs">{currentUser.name.split(" ")[0]}</span>
                <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1.5 py-0.2 rounded font-bold uppercase hidden sm:inline-block border border-amber-400/30">
                  {currentUser.role}
                </span>
                <button
                  onClick={() => {
                    setCurrentUser(null);
                    setToastMessage({ text: "Logged out from portal.", type: "info" });
                  }}
                  className="ml-1 px-2 py-0.5 text-[10px] font-bold text-rose-300 bg-rose-950/80 hover:bg-rose-900 rounded-lg border border-rose-800/80 transition-colors cursor-pointer flex items-center gap-1"
                  title="Log out from portal"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Log Out</span>
                </button>
              </div>
            )}

            <button
              id="toggle-config-btn"
              onClick={() => setShowConfig(!showConfig)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors border cursor-pointer ${
                showConfig 
                  ? "bg-gray-100 border-gray-300 text-gray-700" 
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Connection
            </button>

            <button
              id="refresh-board-btn"
              onClick={() => fetchLiveBoard("", boardId || serverBoardId || "1590190694")}
              disabled={isLoading}
              className="p-1.5 border border-gray-200 bg-white rounded text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              title="Force immediate real-time sync with Monday API"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Dynamic Toast Message Overlay */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg bg-gray-950 text-white text-xs font-semibold max-w-sm border border-gray-800"
          >
            {toastMessage.type === "success" ? (
              <span className="text-emerald-400 text-sm font-extrabold">✓</span>
            ) : (
              <span className="text-sky-400 text-sm font-extrabold">ℹ</span>
            )}
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Email SLA Breach Alert Banner */}
      {totalSlaBreachedEmails > 0 && (
        <div className="bg-rose-600 text-white border-b border-rose-700 px-4 py-2 text-xs">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 font-medium">
            <div className="flex items-center gap-2">
              <span className="bg-rose-800 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse shrink-0">
                SLA Breach
              </span>
              <span>
                There are <strong>{totalSlaBreachedEmails} client email(s)</strong> pending response for over <strong>{slaConfig.slaHoursLimit} hours</strong>.
              </span>
            </div>
            <button
              onClick={handleAutoRemindAllPms}
              className="bg-white text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm shrink-0 flex items-center gap-1 cursor-pointer font-sans"
            >
              <Bell className="w-3 h-3 text-rose-700" />
              Notify All Delinquent Managers
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace with Left Sidebar & Right Workspace Content */}
      <div className="max-w-7xl w-full mx-auto px-4 py-4 flex-1 flex flex-col md:flex-row gap-6">
          {/* Navigation Sidebar (Left Column - Uncompressed TypeTheta Theme) */}
        <aside className="w-full md:w-72 md:shrink-0 flex flex-col gap-4">
          <div className="bg-[#0b0f19] rounded-2xl border border-gray-800 p-5 shadow-2xl md:sticky md:top-[68px] flex flex-col justify-between min-h-[calc(100vh-100px)] text-white">
            
            <div className="flex flex-col gap-4">
              {/* Brand Logo & Tagline */}
              <div className="flex flex-col gap-2 pb-4 border-b border-gray-800/80">
                <TypeThetaLogo height={32} variant="dark" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-amber-400/90 tracking-widest uppercase">
                    Command Centre
                  </span>
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
                    Live SLA Sync
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 italic font-serif leading-snug mt-1">
                  "Small clear actions, done consistently, make the whole day lighter."
                </p>
              </div>
              
              {/* Navigation Menu with Icons & Live Badges */}
              <nav className="flex flex-col gap-1.5 mt-1 overflow-x-auto md:overflow-x-visible pb-1.5 md:pb-0 scrollbar-none">
                {[
                  { id: "action_board", label: "Today's Action Board", icon: ListTodo, color: "text-emerald-400", badge: "Action" },
                  { id: "promise_tracker", label: "Promise Tracker", icon: Handshake, color: "text-amber-400", badge: "4 Due" },
                  { id: "risk_queue", label: "Risk Queue", icon: AlertTriangle, color: "text-rose-400", badge: `${projects.filter(p => p.isOverdue || p.isInternalOverdue).length || 52} Red` },
                  { id: "internal_flags", label: "Internal Flags", icon: Flag, color: "text-orange-400", badge: "Subitems" },
                  { id: "email_sla", label: "Email SLA", icon: Mail, color: "text-indigo-400", badge: `${totalSlaBreachedEmails || 9} SLA` },
                  { id: "followup_queue", label: "Follow-Up Queue", icon: Clock, color: "text-cyan-400", badge: "Chased" },
                  { id: "managers", label: "Managers & Capacity", icon: Users, color: "text-purple-400", badge: `${uniqueManagers.length || 5} PMs` },
                  { id: "missing_data", label: "Missing Data Audit", icon: FileWarning, color: "text-yellow-400", badge: "Audit" },
                  { id: "wiki", label: "Operations Wiki", icon: BookOpen, color: "text-blue-400", badge: "Rules" },
                ].map(item => {
                  const IconComponent = item.icon;
                  const isActive = currentView === item.id || 
                    (item.id === "risk_queue" && (currentView === "founder" || currentView === "risk")) || 
                    (item.id === "email_sla" && currentView === "sla") || 
                    (item.id === "managers" && currentView === "manager");

                  return (
                    <div key={item.id} className="flex flex-col">
                      <button
                        onClick={() => {
                          setCurrentView(item.id as any);
                          setActiveFilter("all");
                          setSelectedProject(null);
                        }}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer group ${
                          isActive
                            ? "bg-slate-800/90 text-white font-bold border-l-4 border-l-[#e59a35] shadow-md"
                            : "text-gray-300 hover:bg-gray-800/60 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <IconComponent className={`w-4 h-4 shrink-0 ${item.color} group-hover:scale-110 transition-transform`} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        <span className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isActive 
                            ? "bg-[#e59a35] text-slate-950" 
                            : "bg-slate-800/80 text-gray-400 border border-gray-700/60"
                        }`}>
                          {item.badge}
                        </span>
                      </button>

                      {/* Active Submenu for Managers View */}
                      {item.id === "managers" && isActive && uniqueManagers.length > 0 && (
                        <div className="ml-5 pl-3 border-l border-purple-500/30 my-1.5 flex flex-col gap-1">
                          <div className="flex justify-between items-center py-1 px-1">
                            <span className="text-[9px] font-extrabold text-purple-300 uppercase tracking-wider">PM Manager Filter</span>
                            {selectedManager && (
                              <button 
                                onClick={() => setSelectedManager(null)}
                                className="text-[9px] text-amber-400 hover:underline font-bold"
                              >
                                Clear (All)
                              </button>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto pr-1 scrollbar-none">
                            <button
                              onClick={() => {
                                setSelectedManager(null);
                                setSelectedProject(null);
                              }}
                              className={`text-left text-[11px] px-2.5 py-1.5 rounded-lg transition-all flex items-center justify-between cursor-pointer ${
                                !selectedManager
                                  ? "bg-purple-600/30 text-purple-200 font-bold border border-purple-500/40"
                                  : "text-gray-400 hover:bg-gray-800/80 hover:text-gray-200"
                              }`}
                            >
                              <span>⚡ All Project Managers</span>
                              <span className="text-[9px] font-mono text-purple-300">{projects.length}</span>
                            </button>

                            {uniqueManagers.map((m) => {
                              const count = projects.filter((p) => p.manager.name === m).length;
                              const isSelected = selectedManager === m;
                              return (
                                <button
                                  key={m}
                                  onClick={() => {
                                    setSelectedManager(m);
                                    setSelectedProject(null);
                                  }}
                                  className={`text-left text-[11px] px-2.5 py-1.5 rounded-lg transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                    isSelected
                                      ? "bg-[#e59a35] text-gray-950 font-extrabold shadow-xs"
                                      : "text-gray-300 hover:bg-gray-800/80 hover:text-white"
                                  }`}
                                >
                                  <span className="truncate">{m}</span>
                                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                    isSelected ? "bg-slate-950 text-amber-300" : "bg-gray-800 text-gray-400"
                                  }`}>
                                    {count}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Footer */}
            <div className="pt-4 border-t border-gray-800/80 mt-6 flex flex-col gap-2.5 text-[10px] text-gray-400">
              {/* User Account & Login State Card */}
              <div className="bg-slate-900/90 border border-gray-800 p-2.5 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Portal Session</span>
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="text-[9.5px] text-[#e59a35] hover:underline font-bold cursor-pointer"
                  >
                    {currentUser ? "Account Settings" : "Sign In"}
                  </button>
                </div>
                {currentUser ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-full ${currentUser.avatarBg || 'bg-purple-600'} text-white font-bold text-xs flex items-center justify-center shrink-0 border border-white/20`}>
                        {currentUser.name.charAt(0)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-white truncate">{currentUser.name}</span>
                        <span className="text-[9px] text-gray-400 font-mono truncate">{currentUser.email}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setCurrentUser(null);
                        setToastMessage({ text: "Logged out from portal.", type: "info" });
                      }}
                      className="px-2 py-1 text-[9.5px] font-bold text-rose-300 hover:text-white hover:bg-rose-900/60 bg-rose-950/40 rounded border border-rose-800/60 transition-colors shrink-0 cursor-pointer"
                      title="Log out from portal"
                    >
                      Log Out
                    </button>
                  </div>
                ) : null}
              </div>

              <p className="leading-snug">Made with ❤️ for less chaos and more clarity</p>
            </div>

          </div>
        </aside>

        {/* Right workspace (Main Desk Content) */}
        <main className="flex-1 min-w-0">
          {(currentUser?.role === "Observer" || isInviteObserverMode) && (
            <div className="bg-slate-900 border-b border-amber-500/30 text-amber-300 px-4 py-2.5 text-xs font-bold flex items-center justify-between mb-4 rounded-xl shadow-xs">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-500/20 rounded-lg border border-amber-500/30">
                  <Eye className="w-4 h-4 text-amber-400" />
                </span>
                <span>
                  <strong>Observer View Only</strong> — You are viewing live Monday.com board metrics and Email SLA tracking in real time. Data edits and write-backs are restricted to Project Managers.
                </span>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="text-[10px] bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 px-2.5 py-1 rounded-lg uppercase tracking-wide font-extrabold shrink-0 cursor-pointer transition-colors"
              >
                Share Invite Link
              </button>
            </div>
          )}
          <AnimatePresence mode="wait">
            
            {/* Settings Panel Expansion */}
            {showConfig && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="mb-4"
              >
                <ConfigPanel
                  apiKey={apiKey}
                  boardId={boardId}
                  columns={board?.columns || []}
                  mapping={mapping}
                  isDemoMode={isDemoMode}
                  isLoading={isLoading}
                  error={error}
                  onConnect={handleConnectLive}
                  onUpdateMapping={handleUpdateMapping}
                  onResetToDemo={handleResetToDemo}
                  allowedGroups={allowedGroups}
                  onUpdateAllowedGroups={setAllowedGroups}
                  slaConfig={slaConfig}
                  onUpdateSlaConfig={setSlaConfig}
                  hasPermanentConfig={hasPermanentConfig}
                  serverBoardId={serverBoardId}
                  isFixedConfig={isFixedConfig}
                  onClearFixedConfig={handleClearFixedConfig}
                  slaTierHours={slaTierHours}
                  onUpdateSlaTierHours={setSlaTierHours}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start sm:items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <span className="font-semibold text-rose-950 block sm:inline">Monday.com Connection Notice: </span>
                  <span className="text-rose-900">{error}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button
                  onClick={() => setShowConfig(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded text-[10px] uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1"
                >
                  <Settings className="w-3 h-3" />
                  Connection Settings
                </button>
                <button
                  onClick={handleResetToDemo}
                  className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold py-1.5 px-3 rounded text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-2xs"
                >
                  Use Interactive Demo Mode
                </button>
                <button
                  onClick={() => setError(null)}
                  className="p-1 hover:bg-rose-100 rounded text-rose-700 transition-colors cursor-pointer"
                  title="Dismiss error notice"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Board Meta Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-950 tracking-tight flex items-center gap-1.5">
                {currentView === "founder" && <Lock className="w-4 h-4 text-amber-500" />}
                {currentView === "owner" && <LayoutDashboard className="w-4 h-4 text-[#6161FF]" />}
                {currentView === "manager" && <Users className="w-4 h-4 text-[#6161FF]" />}
                {currentView === "risk" && <AlertTriangle className="w-4 h-4 text-red-600" />}
                {currentView === "sla" && <Mail className="w-4 h-4 text-indigo-600" />}
                {board?.name || "Loading Board..."}
                {currentView === "founder" && (
                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-xs font-bold ml-1 border border-amber-200 uppercase tracking-wide">
                    Team Command Hub
                  </span>
                )}
                {currentView === "manager" && selectedManager && (
                  <span className="text-[#6161FF] bg-indigo-50 px-2 py-0.5 rounded text-xs font-bold ml-1 border border-indigo-100">
                    PM: {selectedManager}
                  </span>
                )}
                {currentView === "risk" && (
                  <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded text-xs font-bold ml-1 border border-red-100">
                    Risk Desk View
                  </span>
                )}
                {currentView === "sla" && (
                  <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-xs font-bold ml-1 border border-indigo-100">
                    SLA Desk View
                  </span>
                )}
              </h2>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {currentView === "founder" && "Team overview & risk score report based on delivery deadlines, subtask completions, and email response timelines."}
                {currentView === "owner" && "Owner overview: COMPLETE perspective of active board projects and overall progress."}
                {currentView === "manager" && `Manager portal: showcasing active items, SLAs, and target dates assigned to ${selectedManager}.`}
                {currentView === "risk" && "Risk Projects Desk: monitoring SLA breaches, missed internal targets, and stuck pipelines."}
                {currentView === "sla" && "SLA Desk: real-time client email responsiveness tracking, rapid response & automated PM escalation."}
              </p>
            </div>

            {/* Quick toggle banner if in demo mode */}
            {isDemoMode && (
              <div className="bg-indigo-50 border border-indigo-100 rounded px-2.5 py-1 text-[10px] text-indigo-700 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>Preview Mode: Click <strong>Connection</strong> to load a live Monday.com board ID</span>
              </div>
            )}
          </div>

          {/* Render TypeTheta Command Centre Dashboard for all standard views */}
          {["founder", "action_board", "promise_tracker", "risk_queue", "internal_flags", "email_sla", "followup_queue", "managers", "missing_data", "wiki", "risk", "sla"].includes(currentView) ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className={`${selectedProject ? "lg:col-span-8" : "lg:col-span-12"} transition-all duration-200`}>
                <TypeThetaDashboard
                  projects={projects}
                  onSelectProject={(p, initialTab) => {
                    setSelectedProject(p);
                  }}
                  todayStr={todayStr}
                  riskConfig={slaConfig}
                  activeMenu={currentView}
                  onSelectMenu={(menu) => setCurrentView(menu as any)}
                  projectEmails={projectEmails}
                  mapping={mapping}
                  onShowConfig={() => setShowConfig(!showConfig)}
                  isDemoMode={isDemoMode}
                  currentUser={currentUser}
                  onOpenInviteModal={() => setIsInviteModalOpen(true)}
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  onLogout={() => {
                    setCurrentUser(null);
                    setToastMessage({ text: "Logged out from portal.", type: "info" });
                    setIsAuthModalOpen(true);
                  }}
                  selectedManager={selectedManager}
                  onSelectManager={(mgr) => setSelectedManager(mgr)}
                  lastSyncedAt={lastSyncedAt}
                  onRefreshLiveBoard={() => fetchLiveBoard(apiKey, boardId || serverBoardId || "1590190694")}
                  isSyncing={isLoading}
                  onOpen2FaModal={() => setIs2FaModalOpen(true)}
                />
              </div>

              <AnimatePresence>
                {(() => {
                  const currentSelectedProject = selectedProject 
                    ? (projects.find(p => p.id === selectedProject.id) || selectedProject) 
                    : null;
                  
                  return currentSelectedProject && (
                    <motion.div
                      initial={{ opacity: 0, x: 15 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 15 }}
                      transition={{ duration: 0.15 }}
                      className="lg:col-span-4 sticky top-20"
                    >
                      <ProjectDetailModal
                        project={currentSelectedProject}
                        onClose={() => setSelectedProject(null)}
                        onAddComment={handleAddComment}
                        isDemoMode={isDemoMode}
                        onReplyToEmail={handleReplyToEmail}
                        onSendSlaReminder={handleSendSlaReminder}
                        onSimulateIncomingEmail={handleSimulateIncomingEmail}
                        riskConfig={slaConfig}
                        projectSlaTier={projectSlaTiers[currentSelectedProject.id] || "Gold"}
                        onChangeProjectSlaTier={handleChangeProjectSlaTier}
                        slaTierHours={slaTierHours}
                        onUpdateMondayCell={handleUpdateMondayCell}
                        mapping={mapping}
                        currentUser={currentUser}
                        isReadOnly={currentUser?.role === "Observer" || isInviteObserverMode}
                      />
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            </div>
          ) : (
            <>
              {/* Top Summary & Dynamic stats cards (Computed SPECIFICALLY for the active view context!) */}
              <DashboardStats 
                projects={viewProjects}
                onSelectFilter={setActiveFilter}
                activeFilter={activeFilter}
              />

              {/* Filtering & Search Bar */}
              <div className="bg-white rounded border border-gray-200 p-3 mt-4 mb-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xs">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by project name or manager..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full text-xs pl-9 pr-4 py-1.5 border border-gray-200 rounded focus:outline-none focus:border-[#6161FF] text-gray-700 bg-gray-50/20"
                  />
                </div>

                {/* Active status indicators display */}
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-500 font-medium w-full sm:w-auto justify-between sm:justify-end">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
                    <span>Scope:</span>
                    <span className="capitalize bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded font-bold text-[#6161FF]">
                      {activeFilter === "all" ? "All Active Items" : activeFilter.replace("_", " ")}
                    </span>
                    <span className="text-gray-300">|</span>
                    <span>Showing {filteredProjects.length} of {viewProjects.length} entries</span>
                  </div>

                  {/* Card / Table Layout Switcher */}
                  <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded border border-gray-200">
                    <button
                      id="layout-toggle-table"
                      onClick={() => setViewLayout("table")}
                      className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                        viewLayout === "table"
                          ? "bg-white text-gray-950 shadow-2xs border border-gray-200/50"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                      title="Spreadsheet Table View"
                    >
                      <List className="w-3.5 h-3.5 text-current" />
                      Table
                    </button>
                    <button
                      id="layout-toggle-card"
                      onClick={() => setViewLayout("card")}
                      className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                        viewLayout === "card"
                          ? "bg-white text-gray-950 shadow-2xs border border-gray-200/50"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                      title="Visual Card Grid View"
                    >
                      <LayoutGrid className="w-3.5 h-3.5 text-current" />
                      Cards
                    </button>
                  </div>
                </div>
              </div>

              {/* Split Layout: Left Table, Right Sticky Insights Sidebar */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                <div className={`${selectedProject ? "lg:col-span-8" : "lg:col-span-12"} transition-all duration-200 flex flex-col gap-4`}>
                  {viewLayout === "table" ? (
                    <ProjectTable 
                      projects={filteredProjects}
                      selectedProjectId={selectedProject?.id}
                      onSelectProject={setSelectedProject}
                    />
                  ) : (
                    <ProjectCards 
                      projects={filteredProjects}
                      selectedProjectId={selectedProject?.id}
                      onSelectProject={setSelectedProject}
                    />
                  )}
                </div>

                <AnimatePresence>
                  {(() => {
                    const currentSelectedProject = selectedProject 
                      ? (projects.find(p => p.id === selectedProject.id) || selectedProject) 
                      : null;
                    
                    return currentSelectedProject && (
                      <motion.div
                        initial={{ opacity: 0, x: 15 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 15 }}
                        transition={{ duration: 0.15 }}
                        className="lg:col-span-4"
                      >
                        <ProjectDetailModal
                          project={currentSelectedProject}
                          onClose={() => setSelectedProject(null)}
                          onAddComment={handleAddComment}
                          isDemoMode={isDemoMode}
                          onReplyToEmail={handleReplyToEmail}
                          onSendSlaReminder={handleSendSlaReminder}
                          onSimulateIncomingEmail={handleSimulateIncomingEmail}
                          riskConfig={slaConfig}
                          projectSlaTier={projectSlaTiers[currentSelectedProject.id] || "Gold"}
                          onChangeProjectSlaTier={handleChangeProjectSlaTier}
                          slaTierHours={slaTierHours}
                          onUpdateMondayCell={handleUpdateMondayCell}
                          mapping={mapping}
                          currentUser={currentUser}
                          isReadOnly={currentUser?.role === "Observer" || isInviteObserverMode}
                        />
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>
              </div>
            </>
          )}
        </main>
      </div>
      <PortalAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onLogin={(user) => {
          setCurrentUser(user);
          setToastMessage({ text: `Logged in as ${user.name} (${user.email})`, type: "success" });
        }}
        onLogout={() => {
          setCurrentUser(null);
          setToastMessage({ text: "Logged out from portal.", type: "info" });
        }}
      />
      <TwoFactorModal
        isOpen={is2FaModalOpen}
        onClose={() => setIs2FaModalOpen(false)}
        currentUser={currentUser}
      />
      <InviteLinkModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </div>
  );
}
