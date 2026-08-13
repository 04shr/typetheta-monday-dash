import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  KeyRound, 
  QrCode, 
  Copy, 
  Check, 
  RefreshCw, 
  X, 
  Smartphone, 
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { PortalUser } from "./PortalAuthModal";

interface TwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: PortalUser | null;
  onUpdateUser2FA?: (enabled: boolean) => void;
}

export default function TwoFactorModal({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser2FA,
}: TwoFactorModalProps) {
  const [is2FAEnabled, setIs2FAEnabled] = useState(() => {
    const saved = localStorage.getItem(`2fa_enabled_${currentUser?.email || "user"}`);
    return saved !== null ? saved === "true" : true; // Default 2FA active for high security
  });

  const [secretKey] = useState("TT-AUTH-9824-SECURE-KEY");
  const [totpCode, setTotpCode] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);
  const [showQrCode, setShowQrCode] = useState(true);
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  if (!isOpen) return null;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(secretKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleGenerateTestCode = () => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setTotpCode(randomCode);
    setFeedback({ text: `🔑 Generated 2FA Code: ${randomCode} (Pre-filled below)` });
  };

  const handleVerifyAndSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length < 6) {
      setFeedback({ text: "Please enter a valid 6-digit verification code.", isError: true });
      return;
    }

    const nextState = !is2FAEnabled;
    setIs2FAEnabled(nextState);
    if (currentUser?.email) {
      localStorage.setItem(`2fa_enabled_${currentUser.email}`, String(nextState));
    }
    if (onUpdateUser2FA) onUpdateUser2FA(nextState);

    setFeedback({
      text: nextState
        ? "✅ Two-Factor Authentication (2FA) is now ACTIVE on your account."
        : "⚠️ Two-Factor Authentication has been disabled.",
    });
    setTotpCode("");
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-slate-900"
        >
          {/* Modal Header */}
          <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-1.5">
                  Two-Factor Authentication (2FA)
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/40">
                    MFA Security
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Protect account sign-ins with TOTP Authenticator app
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Account Status Card */}
            <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
              is2FAEnabled 
                ? "bg-emerald-50 border-emerald-200 text-emerald-950" 
                : "bg-amber-50 border-amber-200 text-amber-950"
            }`}>
              <div className="flex items-center gap-2.5">
                {is2FAEnabled ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <p className="font-extrabold">
                    {is2FAEnabled ? "2FA Protection Enabled" : "2FA Disabled"}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    {currentUser?.email || "Current User"}
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                is2FAEnabled ? "bg-emerald-200 text-emerald-900" : "bg-amber-200 text-amber-900"
              }`}>
                {is2FAEnabled ? "Active" : "Inactive"}
              </span>
            </div>

            {feedback && (
              <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                feedback.isError 
                  ? "bg-rose-50 text-rose-800 border border-rose-200" 
                  : "bg-blue-50 text-blue-800 border border-blue-200"
              }`}>
                {feedback.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{feedback.text}</span>
              </div>
            )}

            {/* Authenticator App Instructions & QR Code Scanner */}
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-[#6161FF]" />
                  Setup with Google / Microsoft Authenticator
                </span>
                <button
                  type="button"
                  onClick={() => setShowQrCode(!showQrCode)}
                  className="text-[11px] text-[#6161FF] font-extrabold hover:underline cursor-pointer"
                >
                  {showQrCode ? "Hide QR" : "Show QR Code"}
                </button>
              </div>

              {/* Visual QR Code Image */}
              {showQrCode && (
                <div className="flex flex-col items-center gap-2 bg-slate-900 p-3.5 rounded-xl text-center text-white shadow-inner">
                  <div className="p-2.5 bg-white rounded-xl shadow-md border border-slate-300">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`otpauth://totp/TypeTheta:${encodeURIComponent(currentUser?.email || "user@company.com")}?secret=${secretKey}&issuer=TypeTheta`)}`}
                      alt="2FA QR Code Scanner"
                      referrerPolicy="no-referrer"
                      className="w-40 h-40 object-contain"
                    />
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium leading-tight">
                    📷 Scan with <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong>, or <strong>Authy</strong>.
                  </p>
                </div>
              )}

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">2FA Secret Key</span>
                  <span className="font-mono font-bold text-slate-800">{secretKey}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs transition-colors flex items-center gap-1 cursor-pointer font-medium"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey ? "Copied" : "Copy"}</span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 pt-0.5">
                <span>Supports Google Authenticator, Authy, or Duo</span>
                <button
                  type="button"
                  onClick={handleGenerateTestCode}
                  className="text-[#6161FF] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Generate 6-Digit OTP
                </button>
              </div>
            </div>

            {/* Verification Code Form */}
            <form onSubmit={handleVerifyAndSave} className="space-y-3">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Verify 6-Digit Authenticator Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 582910"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-center text-sm font-mono tracking-widest font-bold focus:outline-none focus:border-[#6161FF] focus:ring-1 focus:ring-[#6161FF]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs text-white transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 ${
                    is2FAEnabled 
                      ? "bg-amber-600 hover:bg-amber-700" 
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{is2FAEnabled ? "Disable 2FA Security" : "Verify & Enable 2FA"}</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 border border-slate-300 hover:bg-slate-100 rounded-xl font-bold text-xs text-slate-700 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </form>

            {/* Backup Codes Info */}
            <div className="text-[10px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <p className="font-bold text-slate-700 mb-0.5">💡 Production 2FA Note:</p>
              <p>In production with Firebase Auth, multi-factor authentication (MFA) sends 6-digit SMS / TOTP verification challenges automatically to verified devices upon login.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
