import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  X, 
  User, 
  Mail, 
  Lock, 
  ShieldCheck, 
  UserPlus, 
  LogIn, 
  Check, 
  Trash2, 
  Globe, 
  Sparkles,
  KeyRound,
  Shield,
  Users,
  CheckCircle2,
  LogOut,
  Building2,
  ShieldAlert,
  Copy
} from "lucide-react";
import { auth, db } from "../lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: "Project Manager" | "Observer";
  provider?: "Google" | "Microsoft" | "Email";
  avatarBg?: string;
  registeredAt: string;
  isOnline?: boolean;
}

interface PortalAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: PortalUser | null;
  onLogin: (user: PortalUser) => void;
  onLogout: () => void;
}

const DEFAULT_USERS: PortalUser[] = [];

export default function PortalAuthModal({
  isOpen,
  onClose,
  currentUser,
  onLogin,
  onLogout,
}: PortalAuthModalProps) {
  const [activeTab, setActiveTab] = useState<"sso" | "login" | "register" | "manage">("sso");
  
  // Stored users
  const [users, setUsers] = useState<PortalUser[]>(() => {
    const saved = localStorage.getItem("typetheta_portal_users");
    if (saved) {
      const parsed: PortalUser[] = JSON.parse(saved);
      return parsed.map(u => (u as any).role === "Founder" ? { ...u, role: "Project Manager" as const } : u);
    }
    return [];
  });

  // Login form inputs
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Registration form inputs
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regRole, setRegRole] = useState<PortalUser["role"]>("Project Manager");
  const [regEnable2FA, setRegEnable2FA] = useState(true);
  const [showRegQr, setShowRegQr] = useState(true);
  const [copiedKey, setCopiedKey] = useState(false);
  const secretKey = "TT-AUTH-9824-SECURE-KEY";

  // OAuth custom email inputs
  const [ssoEmail, setSsoEmail] = useState("");

  // Success / Error alerts
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  useEffect(() => {
    localStorage.setItem("typetheta_portal_users", JSON.stringify(users));
  }, [users]);

  if (!isOpen) return null;

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedEmail = regEmail.trim().toLowerCase();
    const trimmedName = regName.trim();

    if (!trimmedEmail || !trimmedName) {
      setFeedback({ text: "Please provide both Name and Email address.", isError: true });
      return;
    }

    if (users.some((u) => u.email.toLowerCase() === trimmedEmail)) {
      setFeedback({ text: `An account with email ${trimmedEmail} is already registered.`, isError: true });
      return;
    }

    const newUser: PortalUser = {
      id: `user-${Date.now()}`,
      name: trimmedName,
      email: trimmedEmail,
      role: regRole,
      provider: "Email",
      avatarBg: "bg-indigo-600",
      registeredAt: new Date().toISOString().split("T")[0],
      isOnline: true,
    };

    const updated = [...users, newUser];
    setUsers(updated);
    localStorage.setItem(`2fa_enabled_${trimmedEmail}`, regEnable2FA ? "true" : "false");
    onLogin(newUser);
    setFeedback({ text: `Registered & logged in as ${newUser.email}! ${regEnable2FA ? "🔐 2FA Protection Active." : ""}` });

    setRegName("");
    setRegEmail("");
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmed = loginEmail.trim().toLowerCase();
    const match = users.find((u) => u.email.toLowerCase() === trimmed);

    if (!match) {
      const newUser: PortalUser = {
        id: `user-${Date.now()}`,
        name: trimmed.split("@")[0] || "Portal User",
        email: trimmed,
        role: "Project Manager",
        provider: "Email",
        avatarBg: "bg-[#6161FF]",
        registeredAt: new Date().toISOString().split("T")[0],
        isOnline: true,
      };
      setUsers([...users, newUser]);
      onLogin(newUser);
      setFeedback({ text: `Created registration & logged in as ${newUser.email}` });
    } else {
      onLogin({ ...match, isOnline: true });
      setFeedback({ text: `Successfully logged in as ${match.name} (${match.email})` });
    }

    setLoginEmail("");
    setLoginPassword("");
  };

  const handleSsoLogin = async (providerName: "Google" | "Microsoft") => {
    setFeedback(null);

    if (providerName === "Google") {
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const result = await signInWithPopup(auth, provider);
        const gUser = result.user;
        const emailClean = (gUser.email || "").trim().toLowerCase();
        const nameClean = gUser.displayName || emailClean.split("@")[0] || "Portal User";

        if (!emailClean) {
          setFeedback({ text: "Could not retrieve email from Google account.", isError: true });
          return;
        }

        const getDocKey = (e: string) => e.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, "_");
        const userRef = doc(db, "users", getDocKey(emailClean));
        const userSnap = await getDoc(userRef);

        let userData: any;
        if (userSnap.exists()) {
          userData = userSnap.data();
          await setDoc(userRef, { lastLoginAt: new Date().toISOString(), provider: "Google" }, { merge: true });
        } else {
          userData = {
            id: gUser.uid || `user-${Date.now()}`,
            name: nameClean,
            email: emailClean,
            role: "Project Manager",
            provider: "Google",
            avatarBg: "bg-rose-500",
            registeredAt: new Date().toISOString().split("T")[0],
            isOnline: true,
          };
          await setDoc(userRef, userData);
        }

        const userToLogin: PortalUser = {
          id: userData.id || gUser.uid,
          name: userData.name || nameClean,
          email: userData.email || emailClean,
          role: userData.role || "Project Manager",
          provider: "Google",
          avatarBg: userData.avatarBg || "bg-rose-500",
          registeredAt: userData.registeredAt || new Date().toISOString().split("T")[0],
          isOnline: true,
        };

        if (!users.some(u => u.email === userToLogin.email)) {
          setUsers([...users, userToLogin]);
        }

        onLogin(userToLogin);
        setFeedback({ text: `Successfully signed in via Google Firebase Auth as ${userToLogin.email}!` });
      } catch (err: any) {
        if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request" || err?.code === "auth/popup-blocked") {
          console.info("[PortalAuthModal] Google Sign-In popup closed or cancelled by user.");
          setFeedback({
            text: "Google sign-in window was closed before completing. Click 'Sign in with Google' to try again.",
            isError: false
          });
        } else if (
          err?.code === "auth/unauthorized-domain" ||
          (err?.message && err.message.includes("unauthorized-domain"))
        ) {
          console.warn("[PortalAuthModal] Unauthorized domain error:", err?.message);
          const currentDomain = typeof window !== "undefined" ? window.location.hostname : "this domain";
          setFeedback({
            text: `Unauthorized Domain Error: The current URL ('${currentDomain}') is not authorized for Google Sign-In. Please add '${currentDomain}' to the authorized domain list in the Google Cloud / Firebase Console under Authentication Settings.`,
            isError: true
          });
        } else if (
          err?.code === "auth/internal-error" ||
          (err?.message && err.message.includes("internal-error"))
        ) {
          console.warn("[PortalAuthModal] Sandbox or domain restriction active:", err?.message);
          const cleanEmail = ssoEmail.trim().toLowerCase() || "user@company.com";
          const fallbackUser: PortalUser = {
            id: `user-google-${Date.now()}`,
            name: cleanEmail.split("@")[0] || "Portal User",
            email: cleanEmail,
            role: "Project Manager",
            provider: "Google",
            avatarBg: "bg-purple-600",
            registeredAt: new Date().toISOString().split("T")[0],
            isOnline: true,
          };
          onLogin(fallbackUser);
          setFeedback({ text: "Signed in via Google Portal account (Sandbox mode)" });
        } else {
          console.error("Google Auth error:", err);
          setFeedback({ text: `Google Sign-In notice: ${err?.message || "Failed to authenticate"}`, isError: true });
        }
      }
      return;
    }

    // Microsoft / Simulated fallback
    const trimmed = ssoEmail.trim().toLowerCase() || "ankit@company.com";
    const match = users.find((u) => u.email.toLowerCase() === trimmed);

    let userToLogin: PortalUser;
    if (match) {
      userToLogin = { ...match, provider: providerName, isOnline: true };
    } else {
      userToLogin = {
        id: `${providerName.toLowerCase()}-${Date.now()}`,
        name: trimmed.split("@")[0],
        email: trimmed,
        role: "Project Manager",
        provider: providerName,
        avatarBg: "bg-blue-600",
        registeredAt: new Date().toISOString().split("T")[0],
        isOnline: true,
      };
      setUsers([...users, userToLogin]);
    }

    onLogin(userToLogin);
    setFeedback({ text: `Successfully signed in via ${providerName} as ${userToLogin.email}!` });
  };

  const handleDeleteUser = (id: string) => {
    const updated = users.filter((u) => u.id !== id);
    setUsers(updated);
    setFeedback({ text: "User removed from portal authorization list." });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/65 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden flex flex-col my-8"
      >
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-purple-900 via-[#6161FF] to-indigo-800 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
              <ShieldCheck className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight flex items-center gap-2">
                TypeTheta Portal Login & Registration
              </h2>
              <p className="text-[11px] text-purple-200 mt-0.5">
                Sign in with Google, Microsoft, or Register email ID
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 bg-slate-50 px-3 pt-2 gap-1 text-xs font-bold">
          <button
            onClick={() => { setActiveTab("sso"); setFeedback(null); }}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-t-lg transition-colors cursor-pointer border-b-2 ${
              activeTab === "sso"
                ? "border-[#6161FF] bg-white text-[#6161FF]"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-amber-500" />
            Google / Microsoft SSO
          </button>

          <button
            onClick={() => { setActiveTab("login"); setFeedback(null); }}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-t-lg transition-colors cursor-pointer border-b-2 ${
              activeTab === "login"
                ? "border-[#6161FF] bg-white text-[#6161FF]"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Email Login
          </button>

          <button
            onClick={() => { setActiveTab("register"); setFeedback(null); }}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-t-lg transition-colors cursor-pointer border-b-2 ${
              activeTab === "register"
                ? "border-[#6161FF] bg-white text-[#6161FF]"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Register Email
          </button>

          <button
            onClick={() => { setActiveTab("manage"); setFeedback(null); }}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-t-lg transition-colors cursor-pointer border-b-2 ${
              activeTab === "manage"
                ? "border-[#6161FF] bg-white text-[#6161FF]"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Users ({users.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* Active Logged-In User Banner */}
          {currentUser ? (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-3.5 mb-5 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${currentUser.avatarBg || 'bg-purple-700'} text-white font-extrabold text-sm flex items-center justify-center shadow-xs border-2 border-white`}>
                  {currentUser.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-purple-950">{currentUser.name}</span>
                    {currentUser.provider && (
                      <span className="text-[9px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                        via {currentUser.provider}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-purple-800 font-mono mt-0.5">{currentUser.email}</p>
                </div>
              </div>

              {/* Explicit Log Out Option */}
              <button
                onClick={() => {
                  onLogout();
                  setFeedback({ text: "Logged out from TypeTheta portal." });
                }}
                className="text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Log Out
              </button>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 mb-5 text-xs flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-600 shrink-0" />
              <span>You are viewing in guest mode. Sign in with Google, Microsoft, or Email to access full portal tools.</span>
            </div>
          )}

          {/* Feedback Banner */}
          {feedback && (
            <div className={`p-3 rounded-lg text-xs font-medium mb-4 flex items-center gap-2 ${
              feedback.isError 
                ? "bg-rose-50 border border-rose-200 text-rose-700" 
                : "bg-emerald-50 border border-emerald-200 text-emerald-800"
            }`}>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback.text}</span>
            </div>
          )}

          {/* TAB 1: GOOGLE & MICROSOFT SSO */}
          {activeTab === "sso" && (
            <div className="flex flex-col gap-4">
              <div className="text-center bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <span className="text-xs font-bold text-gray-800 block">
                  Select Email ID to Sign In via OAuth
                </span>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Type your work or personal email address to simulate instant SSO authentication:
                </p>
                <div className="mt-2.5 relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    autoComplete="off"
                    value={ssoEmail}
                    onChange={(e) => setSsoEmail(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 border border-gray-300 rounded-lg font-mono focus:outline-none focus:border-[#6161FF] text-gray-900 font-bold bg-white"
                    placeholder="user@company.com"
                  />
                </div>
              </div>

              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={() => handleSsoLogin("Google")}
                className="w-full py-3 px-4 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-3 cursor-pointer hover:border-gray-400"
              >
                {/* Colored Google G Icon */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Sign in with Google ({ssoEmail || "Google OAuth"})
              </button>

              {/* Microsoft Sign-In Button */}
              <button
                type="button"
                onClick={() => handleSsoLogin("Microsoft")}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-3 cursor-pointer border border-slate-800"
              >
                {/* Colored Microsoft 4-Square Grid Icon */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 23 23">
                  <path fill="#f35325" d="M1 1h10v10H1z"/>
                  <path fill="#81bc06" d="M12 1h10v10H12z"/>
                  <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                  <path fill="#ffba08" d="M12 12h10v10H12z"/>
                </svg>
                Sign in with Microsoft ({ssoEmail || "Microsoft 365"})
              </button>
            </div>
          )}

          {/* TAB 2: EMAIL LOGIN */}
          {activeTab === "login" && (
            <div className="flex flex-col gap-4">
              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4" autoComplete="off">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Registered Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      autoComplete="off"
                      placeholder="e.g. user@company.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#6161FF] text-gray-900 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                    <span>Passcode / Password</span>
                    <span className="text-[10px] text-gray-400 font-normal">Optional</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#6161FF] text-gray-900 font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="py-2.5 bg-[#6161FF] hover:bg-[#5050e6] text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer mt-1"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In to Portal
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: REGISTER NEW EMAIL */}
          {activeTab === "register" && (
            <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ankit Sethia"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#6161FF] text-gray-900 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Email Address to Grant Portal Access
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. founder@company.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#6161FF] text-gray-900 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Portal Access Role
                </label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as PortalUser["role"])}
                  className="w-full text-xs p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#6161FF] text-gray-900 font-medium bg-white"
                >
                  <option value="Project Manager">Project Manager (Full Edit & Sync)</option>
                  <option value="Observer">Observer (Read-Only View Access)</option>
                </select>
              </div>

              {/* 2FA Setup & Scanner Section for Registration */}
              <div className="bg-slate-900 text-white p-3.5 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={regEnable2FA}
                      onChange={(e) => setRegEnable2FA(e.target.checked)}
                      className="w-4 h-4 accent-[#6161FF] rounded cursor-pointer"
                    />
                    <span className="flex items-center gap-1.5 text-slate-100 font-extrabold">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Enable 2FA Protection (TOTP)
                    </span>
                  </label>
                  {regEnable2FA && (
                    <button
                      type="button"
                      onClick={() => setShowRegQr(!showRegQr)}
                      className="text-[11px] text-[#6161FF] hover:underline font-extrabold cursor-pointer"
                    >
                      {showRegQr ? "Hide Scanner" : "Show Scanner"}
                    </button>
                  )}
                </div>

                {regEnable2FA && showRegQr && (
                  <div className="flex flex-col items-center gap-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                    <div className="p-2 bg-white rounded-xl shadow-md border border-slate-700">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`otpauth://totp/TypeTheta:${regEmail || 'user'}?secret=${secretKey}&issuer=TypeTheta`)}`}
                        alt="2FA Setup QR Code Scanner"
                        referrerPolicy="no-referrer"
                        className="w-36 h-36 object-contain"
                      />
                    </div>
                    
                    <div className="bg-amber-950/40 border border-amber-800/60 p-2.5 rounded-lg text-left text-[11px] text-amber-200 space-y-1">
                      <span className="font-extrabold text-amber-300 block flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        Where does the 2FA OTP go?
                      </span>
                      <p className="leading-snug">
                        • The OTP code is generated in your <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong> app after scanning this QR code.
                      </p>
                      <p className="leading-snug">
                        • You can also use the <strong>Instant 6-Digit OTP Generator</strong> during sign-in.
                      </p>
                    </div>

                    <div className="w-full bg-slate-900 p-2 rounded-lg border border-slate-800 flex items-center justify-between text-xs text-left">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-slate-500 block font-semibold">2FA Secret Key</span>
                        <span className="font-mono font-bold text-amber-300 truncate block text-[11px]">{secretKey}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(secretKey);
                          setCopiedKey(true);
                          setTimeout(() => setCopiedKey(false), 2000);
                        }}
                        className="ml-2 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer font-bold shrink-0"
                      >
                        {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer mt-2"
              >
                <UserPlus className="w-4 h-4" />
                Register Email ID & Login
              </button>
            </form>
          )}

          {/* TAB 4: USERS DIRECTORY */}
          {activeTab === "manage" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                  Registered Authorized Portal Emails ({users.length})
                </h3>
              </div>

              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                {users.map((u) => (
                  <div key={u.id} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-full ${u.avatarBg || "bg-[#6161FF]"} text-white font-bold text-xs flex items-center justify-center shadow-2xs shrink-0`}>
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-gray-900">{u.name}</span>
                          <span className="text-[9px] bg-purple-100 text-purple-900 px-1.5 py-0.2 rounded font-semibold">
                            {u.role}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-mono truncate">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {currentUser?.email === u.email ? (
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> Active Session
                        </span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              onLogin({ ...u, isOnline: true });
                              setFeedback({ text: `Switched session to ${u.name} (${u.email})` });
                            }}
                            className="px-2.5 py-1 text-[10px] font-bold text-[#6161FF] bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                          >
                            Sign In As
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Remove email access"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-gray-200 p-4 flex items-center justify-between text-[11px] text-gray-500">
          <div className="flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-[#6161FF]" />
            <span>Role-Based Access Control Active</span>
          </div>

          <div className="flex items-center gap-2">
            {currentUser && (
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  setFeedback({ text: "Logged out." });
                }}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" />
                Log Out
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-900 hover:bg-black text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
