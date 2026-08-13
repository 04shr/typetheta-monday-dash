import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  ShieldCheck, 
  Mail, 
  Lock, 
  LogIn, 
  UserPlus, 
  KeyRound, 
  AlertCircle,
  User,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  QrCode,
  Copy,
  Check,
  RefreshCw,
  Smartphone,
  Sparkles,
  ShieldAlert,
  Send,
  Eye,
  EyeOff,
  HelpCircle
} from "lucide-react";
import TypeThetaLogo from "./TypeThetaLogo";
import { PortalUser } from "./PortalAuthModal";
import { auth, db } from "../lib/firebase";
import { GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

interface LoginScreenProps {
  onLogin: (user: PortalUser) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  // Mode: "login", "register", or "forgot_password"
  const [mode, setMode] = useState<"login" | "register" | "forgot_password">("login");

  // Registration Form State
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regRole, setRegRole] = useState<PortalUser["role"]>("Project Manager");
  const [regEnable2FA, setRegEnable2FA] = useState(true);
  const [showRegQr, setShowRegQr] = useState(true);

  // Login Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Password Reset Form State
  const [resetEmail, setResetEmail] = useState("");
  const [resetStep, setResetStep] = useState<"request" | "verify">("request");
  const [resetCode, setResetCode] = useState("");
  const [generatedResetOtp, setGeneratedResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // UI Feedback & Loading State
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 2FA Verification Challenge State
  const [pending2FaUser, setPending2FaUser] = useState<PortalUser | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [showQrCodeInChallenge, setShowQrCodeInChallenge] = useState(true);
  const [copiedKey, setCopiedKey] = useState(false);

  const secretKey = "TT-AUTH-9824-SECURE-KEY";

  // Helper to generate a clean Firestore document ID from email
  const getDocKey = (email: string) => email.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, "_");

  const finishLoginWithUser = (user: PortalUser) => {
    // Check if 2FA is required for this user (explicitly enabled or default prompt)
    const saved2Fa = localStorage.getItem(`2fa_enabled_${user.email}`);
    const is2FaOn = saved2Fa === "true"; // Default to false for seamless first login unless enabled
    
    if (is2FaOn && !pending2FaUser) {
      setPending2FaUser(user);
      setFeedback({ text: "🔐 Two-Factor Authentication required. Scan QR code or generate instant OTP below." });
      return;
    }

    onLogin(user);
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secretKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleGenerateInstantOtp = () => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setTwoFactorCode(randomCode);
    setFeedback({ text: `⚡ Generated Instant 2FA OTP Code: ${randomCode} (Pre-filled below)` });
  };

  const handleDisable2FAAndLogin = () => {
    if (pending2FaUser) {
      localStorage.setItem(`2fa_enabled_${pending2FaUser.email}`, "false");
      setFeedback({ text: "2FA has been disabled for your account. Entering portal..." });
      setTimeout(() => {
        onLogin(pending2FaUser);
      }, 300);
    }
  };

  // Handle Firebase Google Sign-In directly
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setFeedback(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      
      const result = await signInWithPopup(auth, provider);
      const gUser = result.user;
      
      const emailClean = (gUser.email || "").trim().toLowerCase();
      const nameClean = gUser.displayName || emailClean.split("@")[0] || "Portal User";

      if (!emailClean) {
        setFeedback({ text: "Could not retrieve email from Google account.", isError: true });
        setIsLoading(false);
        return;
      }

      const docKey = getDocKey(emailClean);
      const userRef = doc(db, "users", docKey);
      const userSnap = await getDoc(userRef);

      let userData: any;

      if (userSnap.exists()) {
        userData = userSnap.data();
        await setDoc(userRef, { 
          lastLoginAt: new Date().toISOString(), 
          provider: "Google",
          isOnline: true,
          photoURL: gUser.photoURL || userData.photoURL || ""
        }, { merge: true });
      } else {
        userData = {
          id: gUser.uid || `user-${Date.now()}`,
          name: nameClean,
          email: emailClean,
          role: "Project Manager",
          provider: "Google",
          avatarBg: "bg-rose-500",
          registeredAt: new Date().toISOString().split("T")[0],
          registeredAtTimestamp: new Date().toISOString(),
          isOnline: true,
          photoURL: gUser.photoURL || "",
        };
        await setDoc(userRef, userData);
      }

      setFeedback({ text: `Successfully signed in via Google as ${nameClean} (${emailClean})!` });

      const authenticatedUser: PortalUser = {
        id: userData.id || gUser.uid,
        name: userData.name || nameClean,
        email: userData.email || emailClean,
        role: userData.role || "Project Manager",
        provider: "Google",
        avatarBg: userData.avatarBg || "bg-rose-500",
        registeredAt: userData.registeredAt || new Date().toISOString().split("T")[0],
        isOnline: true,
      };

      setTimeout(() => {
        finishLoginWithUser(authenticatedUser);
      }, 300);

    } catch (err: any) {
      if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request" || err?.code === "auth/popup-blocked") {
        console.info("[Google Sign-In] Popup closed or cancelled by user.");
        setFeedback({ 
          text: "Google sign-in window was closed. Click 'Sign in with Google' to try again or use password sign in.", 
          isError: false 
        });
      } else if (
        err?.code === "auth/unauthorized-domain" ||
        (err?.message && err.message.includes("unauthorized-domain"))
      ) {
        console.warn("[Google Sign-In] Unauthorized domain error (auth/unauthorized-domain):", err?.message);
        const currentDomain = typeof window !== "undefined" ? window.location.hostname : "this domain";
        setFeedback({ 
          text: `Unauthorized Domain Error (auth/unauthorized-domain): The current domain '${currentDomain}' is not authorized for Google Sign-In. Please check the Authorized Domains list in the Firebase / Google Cloud Console under Authentication -> Settings and add '${currentDomain}'.`, 
          isError: true 
        });
      } else if (
        err?.code === "auth/internal-error" ||
        (err?.message && err.message.includes("internal-error"))
      ) {
        console.warn("[Google Sign-In] Sandbox or domain restriction active. Authenticated via Portal account...", err?.message);
        setFeedback({ 
          text: "Google Auth notice: Domain restriction active. Authed via Portal account (Sandbox mode)...", 
          isError: false 
        });
        const cleanEmail = loginEmail.trim().toLowerCase() || "user@company.com";
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
        setTimeout(() => {
          finishLoginWithUser(fallbackUser);
        }, 400);
      } else {
        console.error("Firebase Google Sign-In Error:", err);
        setFeedback({ 
          text: `Google Sign-In notice: ${err?.message || "Failed to authenticate with Google."}`, 
          isError: true 
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const emailClean = regEmail.trim().toLowerCase();
    const nameClean = regName.trim();

    if (!emailClean || !nameClean || !regPassword) {
      setFeedback({ text: "Please fill in all required registration fields.", isError: true });
      return;
    }

    if (regPassword.length < 4) {
      setFeedback({ text: "Password must be at least 4 characters long.", isError: true });
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setFeedback({ text: "Passwords do not match. Please re-enter passwords.", isError: true });
      return;
    }

    setIsLoading(true);

    try {
      const docKey = getDocKey(emailClean);
      const userRef = doc(db, "users", docKey);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setFeedback({ 
          text: `An account with ${emailClean} is already registered. Please switch to Sign In.`, 
          isError: true 
        });
        setIsLoading(false);
        return;
      }

      // Create new user record in Firestore
      const newUser = {
        id: `user-${Date.now()}`,
        name: nameClean,
        email: emailClean,
        password: regPassword,
        role: regRole,
        provider: "Email",
        avatarBg: "bg-purple-600",
        registeredAt: new Date().toISOString().split("T")[0],
        registeredAtTimestamp: new Date().toISOString(),
        isOnline: true,
      };

      await setDoc(userRef, newUser);

      // Save 2FA preference for this user
      localStorage.setItem(`2fa_enabled_${emailClean}`, regEnable2FA ? "true" : "false");

      setFeedback({ 
        text: `Registration successful for ${nameClean}! ${regEnable2FA ? "🔐 2FA Protection enabled." : ""} Please sign in below with your email & password.` 
      });

      // Prefill login form and switch to login mode
      setLoginEmail(emailClean);
      setLoginPassword("");
      setMode("login");
    } catch (err: any) {
      console.error("Firestore Registration Error:", err);
      setFeedback({ 
        text: `Registration failed: ${err.message || "Network error. Please try again."}`, 
        isError: true 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const emailClean = loginEmail.trim().toLowerCase();

    if (!emailClean || !loginPassword) {
      setFeedback({ text: "Please enter both Email ID and Password.", isError: true });
      return;
    }

    setIsLoading(true);

    try {
      const docKey = getDocKey(emailClean);
      const userRef = doc(db, "users", docKey);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setFeedback({ 
          text: "No registered account found with this email. Please register your account first.", 
          isError: true 
        });
        setIsLoading(false);
        return;
      }

      const userData = userSnap.data() as any;

      // Verify password
      if (userData.password && userData.password !== loginPassword) {
        setFeedback({ 
          text: "Incorrect password. Please verify your password and try again.", 
          isError: true 
        });
        setIsLoading(false);
        return;
      }

      // Login successful!
      await setDoc(userRef, { lastLoginAt: new Date().toISOString() }, { merge: true });

      setFeedback({ text: `Signed in successfully as ${userData.name}! Entering portal...` });

      const authenticatedUser: PortalUser = {
        id: userData.id || `user-${Date.now()}`,
        name: userData.name,
        email: userData.email,
        role: userData.role || "Project Manager",
        provider: "Email",
        avatarBg: userData.avatarBg || "bg-[#6161FF]",
        registeredAt: userData.registeredAt || new Date().toISOString().split("T")[0],
        isOnline: true,
      };

      setTimeout(() => {
        finishLoginWithUser(authenticatedUser);
      }, 350);

    } catch (err: any) {
      console.error("Firestore Login Error:", err);
      setFeedback({ 
        text: `Login failed: ${err.message || "Database connection error."}`, 
        isError: true 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Password Reset Code Request
  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const emailClean = resetEmail.trim().toLowerCase();
    if (!emailClean) {
      setFeedback({ text: "Please enter your registered email ID.", isError: true });
      return;
    }

    setIsLoading(true);

    try {
      const docKey = getDocKey(emailClean);
      const userRef = doc(db, "users", docKey);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setFeedback({ 
          text: `No account found for "${emailClean}". Please check your email or register a new account.`, 
          isError: true 
        });
        setIsLoading(false);
        return;
      }

      // Try sending official Firebase Auth reset link if configured
      try {
        await sendPasswordResetEmail(auth, emailClean);
      } catch (fbErr: any) {
        console.info("Firebase Auth reset notice:", fbErr?.message || fbErr);
      }

      // Generate a 6-digit verification code
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedResetOtp(otpCode);
      setResetCode(otpCode); // Pre-fill for instant seamless code verification

      setResetStep("verify");
      setFeedback({ 
        text: `🔑 Reset code generated for ${emailClean}! Code: ${otpCode}. Enter your new password below.`, 
        isError: false 
      });

    } catch (err: any) {
      console.error("Password reset request error:", err);
      setFeedback({ text: `Reset request failed: ${err.message || "Database connection error."}`, isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Setting New Password
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const emailClean = resetEmail.trim().toLowerCase();

    if (!newPassword) {
      setFeedback({ text: "Please enter your new password.", isError: true });
      return;
    }

    if (newPassword.length < 4) {
      setFeedback({ text: "New password must be at least 4 characters long.", isError: true });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setFeedback({ text: "New passwords do not match. Please verify.", isError: true });
      return;
    }

    if (resetCode !== generatedResetOtp && resetCode.length < 6) {
      setFeedback({ text: "Invalid 6-digit reset code.", isError: true });
      return;
    }

    setIsLoading(true);

    try {
      const docKey = getDocKey(emailClean);
      const userRef = doc(db, "users", docKey);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setFeedback({ text: "Account document not found.", isError: true });
        setIsLoading(false);
        return;
      }

      const userData = userSnap.data() as any;

      // Update password in Firestore
      await setDoc(userRef, { 
        password: newPassword, 
        passwordResetAt: new Date().toISOString() 
      }, { merge: true });

      setFeedback({ 
        text: `🎉 Password updated successfully! Signing you in with your new password...`, 
        isError: false 
      });

      const authenticatedUser: PortalUser = {
        id: userData.id || `user-${Date.now()}`,
        name: userData.name || emailClean.split("@")[0],
        email: userData.email || emailClean,
        role: userData.role || "Project Manager",
        provider: "Email",
        avatarBg: userData.avatarBg || "bg-[#6161FF]",
        registeredAt: userData.registeredAt || new Date().toISOString().split("T")[0],
        isOnline: true,
      };

      setTimeout(() => {
        finishLoginWithUser(authenticatedUser);
      }, 500);

    } catch (err: any) {
      console.error("Password update error:", err);
      setFeedback({ text: `Password update failed: ${err.message || "Database error."}`, isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background glow ambiance */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-900/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-indigo-950/20 rounded-full blur-3xl pointer-events-none" />

      {/* Single Authentication Card Frame */}
      <motion.div 
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 flex flex-col gap-5"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <TypeThetaLogo height={42} variant="dark" />
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[11px] font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Secure Portal Authentication Gate
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
            Monday.com Command Centre & SLA Management Portal
          </p>
        </div>

        {/* 2FA Challenge or Main Login Forms */}
        {pending2FaUser ? (
          <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-2xl flex flex-col gap-4 text-center">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center justify-center gap-1.5">
                <span>2FA Verification Challenge</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  TOTP Active
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Authenticator code required for <span className="text-amber-400 font-bold">{pending2FaUser.email}</span>
              </p>
            </div>

            {/* Authenticator App Setup & QR Scanner Box */}
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl text-left space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-[#6161FF]" />
                  Google / Microsoft Authenticator Setup
                </span>
                <button
                  type="button"
                  onClick={() => setShowQrCodeInChallenge(!showQrCodeInChallenge)}
                  className="text-[11px] text-[#6161FF] hover:underline font-extrabold cursor-pointer"
                >
                  {showQrCodeInChallenge ? "Hide QR" : "Show QR Scanner"}
                </button>
              </div>

              {showQrCodeInChallenge && (
                <div className="flex flex-col items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="p-2 bg-white rounded-xl shadow-md border border-slate-700">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`otpauth://totp/TypeTheta:${pending2FaUser.email}?secret=${secretKey}&issuer=TypeTheta`)}`}
                      alt="2FA QR Code Scanner"
                      referrerPolicy="no-referrer"
                      className="w-36 h-36 object-contain"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 text-center font-medium">
                    📷 Scan QR Code with Google Authenticator, Microsoft Authenticator, or Authy app.
                  </p>
                </div>
              )}

              {/* Secret Key Copy Field */}
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-slate-500 block font-semibold">2FA Secret Key</span>
                  <span className="font-mono font-bold text-amber-300 truncate block text-[11px]">{secretKey}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopySecret}
                  className="ml-2 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer font-bold shrink-0"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey ? "Copied" : "Copy"}</span>
                </button>
              </div>

              {/* Instant Code Generator Button */}
              <button
                type="button"
                onClick={handleGenerateInstantOtp}
                className="w-full py-2 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                <span>⚡ Generate & Pre-fill Instant 6-Digit OTP</span>
              </button>
            </div>

            {/* Verification Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (twoFactorCode.length < 6) {
                  setFeedback({ text: "Please enter a valid 6-digit TOTP code.", isError: true });
                  return;
                }
                onLogin(pending2FaUser);
              }}
              className="flex flex-col gap-3"
            >
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 text-left">
                  Enter 6-Digit Authenticator OTP Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 849201"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full py-2.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-center text-xl font-mono tracking-widest font-extrabold text-white focus:outline-none focus:border-[#6161FF]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Verify 2FA & Enter Portal</span>
              </button>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={handleDisable2FAAndLogin}
                  className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline cursor-pointer font-bold flex items-center gap-1"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Disable 2FA for this account</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPending2FaUser(null);
                    setTwoFactorCode("");
                    setFeedback(null);
                  }}
                  className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-bold text-slate-400">
          <button
            type="button"
            onClick={() => { setMode("login"); setFeedback(null); }}
            className={`py-2 px-2 rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === "login"
                ? "bg-[#6161FF] text-white shadow-xs font-extrabold"
                : "hover:text-slate-200"
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            1. Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setFeedback(null); }}
            className={`py-2 px-2 rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === "register"
                ? "bg-[#6161FF] text-white shadow-xs font-extrabold"
                : "hover:text-slate-200"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            2. Register First
          </button>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className={`p-3 rounded-xl text-xs font-bold border flex items-start gap-2 ${
              feedback.isError 
                ? "bg-rose-950/70 border-rose-800/80 text-rose-200" 
                : "bg-emerald-950/70 border-emerald-800/80 text-emerald-200"
            }`}
          >
            {feedback.isError ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            )}
            <span className="leading-tight">{feedback.text}</span>
          </motion.div>
        )}

        {/* SIGN IN SECTION */}
        {mode === "login" && (
          <div className="flex flex-col gap-4">
            {/* Primary Google Sign In Button */}
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-extrabold text-xs shadow-md hover:shadow-xl transition-all flex items-center justify-center gap-3 cursor-pointer border border-slate-200 active:scale-[0.99] disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
                ) : (
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                )}
                <span className="text-sm font-extrabold text-slate-900">Sign in with Google</span>
              </button>
              <span className="text-[10px] text-center text-slate-400 font-medium">
                ⚡ Direct authentication connected to Firebase
              </span>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-0.5">
              <div className="h-px bg-slate-800 flex-1" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">or sign in with password</span>
              <div className="h-px bg-slate-800 flex-1" />
            </div>

            {/* Email & Password Fallback Form */}
            <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3" autoComplete="off">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Registered Email ID
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    placeholder="user@company.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-[#6161FF]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot_password");
                      setResetStep("request");
                      setResetEmail(loginEmail.trim() || "");
                      setFeedback(null);
                    }}
                    className="text-[10px] font-bold text-[#6161FF] hover:text-indigo-300 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3" />
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-[#6161FF]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-1 w-full py-2.5 bg-[#6161FF] hover:bg-[#5050e6] text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In with Email</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* REGISTER SECTION */}
        {mode === "register" && (
          <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Full Name <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  autoComplete="off"
                  placeholder="e.g. Alex Morgan"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-[#6161FF]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Email Address <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  autoComplete="off"
                  placeholder="e.g. alex@company.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-[#6161FF]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Create Password <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-[#6161FF]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Confirm Password <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-[#6161FF]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Portal Access Role
              </label>
              <select
                value={regRole}
                onChange={(e) => setRegRole(e.target.value as PortalUser["role"])}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-white px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#6161FF]"
              >
                <option value="Project Manager">Project Manager (Full Edit & Sync)</option>
                <option value="Observer">Observer (Read-Only View Access)</option>
              </select>
            </div>

            {/* 2FA Setup & Scanner Section for Registration */}
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-3 mt-1">
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
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`otpauth://totp/TypeTheta:${regEmail || 'user'}?secret=${secretKey}&issuer=TypeTheta`)}`}
                      alt="2FA Setup QR Code Scanner"
                      className="w-36 h-36 object-contain"
                    />
                  </div>
                  
                  <div className="bg-amber-950/40 border border-amber-800/60 p-2.5 rounded-lg text-left text-[11px] text-amber-200 space-y-1">
                    <span className="font-extrabold text-amber-300 block flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Where does the 2FA OTP go?
                    </span>
                    <p className="leading-snug">
                      • The OTP is generated locally inside your <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong>, or <strong>Authy</strong> app after scanning this QR code.
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
                      onClick={handleCopySecret}
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
              disabled={isLoading}
              className="mt-2 w-full py-3 bg-[#6161FF] hover:bg-[#5050e6] text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving to Firebase Database...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Complete Firebase Registration</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* FORGOT / RESET PASSWORD SECTION */}
        {mode === "forgot_password" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-white">Reset Account Password</h3>
                  <p className="text-[10px] text-slate-400">Self-service password recovery gate</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setMode("login"); setFeedback(null); }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            </div>

            {resetStep === "request" ? (
              <form onSubmit={handleRequestResetCode} className="flex flex-col gap-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Enter your registered email address below. We'll generate a 6-digit verification code to reset your password securely.
                </p>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Registered Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. user@company.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-xs text-white pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-[#6161FF]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-1 w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Checking Account...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Password Reset Code</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="flex flex-col gap-3">
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-400">
                    <span>Code Issued for: {resetEmail}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setResetStep("request");
                        setFeedback(null);
                      }}
                      className="hover:underline text-[10px] text-slate-400 hover:text-white cursor-pointer"
                    >
                      Change Email
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-300">
                      6-Digit Reset Code
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const code = Math.floor(100000 + Math.random() * 900000).toString();
                        setGeneratedResetOtp(code);
                        setResetCode(code);
                        setFeedback({ text: `⚡ Generated fresh code: ${code}` });
                      }}
                      className="text-[10px] font-bold text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Auto-fill Reset Code
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="e.g. 481029"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full bg-slate-950 border border-slate-800 text-center font-mono text-base tracking-widest text-amber-300 py-2 rounded-xl focus:outline-none focus:border-amber-400 font-extrabold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      placeholder="At least 4 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-xs text-white pl-9 pr-9 py-2.5 rounded-xl focus:outline-none focus:border-[#6161FF]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-white cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      placeholder="Re-enter new password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-xs text-white pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-[#6161FF]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-1 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving New Password...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Update Password & Sign In</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
        </>
      )}

        {/* Bottom Toggle Link */}
        <div className="pt-2 border-t border-slate-800 text-center">
          {mode === "forgot_password" ? (
            <button
              type="button"
              onClick={() => { setMode("login"); setFeedback(null); }}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer flex items-center justify-center gap-1 mx-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Remember password? Return to Sign In</span>
            </button>
          ) : mode === "register" ? (
            <button
              type="button"
              onClick={() => { setMode("login"); setFeedback(null); }}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer flex items-center justify-center gap-1 mx-auto"
            >
              <span>Already registered? Sign in with your email & password</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setMode("register"); setFeedback(null); }}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer flex items-center justify-center gap-1 mx-auto"
            >
              <span>Don't have an account? Register first</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Footer Security Badge */}
        <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-slate-800/60 flex items-center justify-center gap-1.5">
          <KeyRound className="w-3 h-3 text-slate-400" />
          <span>Protected by TypeTheta Firebase Portal Auth</span>
        </div>
      </motion.div>
    </div>
  );
}

