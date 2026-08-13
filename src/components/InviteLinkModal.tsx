import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Share2, 
  Copy, 
  Check, 
  Eye, 
  ExternalLink, 
  X, 
  ShieldCheck, 
  Lock,
  Users
} from "lucide-react";

interface InviteLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InviteLinkModal({ isOpen, onClose }: InviteLinkModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=observer`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
          {/* Header */}
          <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-1.5">
                  Observer Share Link
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/40">
                    Read-Only
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Share real-time dashboard view access with stakeholders
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
            {/* Link Box */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Shareable Observer Dashboard URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold text-white transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm ${
                    copied 
                      ? "bg-emerald-600 hover:bg-emerald-700" 
                      : "bg-[#6161FF] hover:bg-[#5050e6]"
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? "Copied!" : "Copy Link"}</span>
                </button>
              </div>
            </div>

            {/* Permissions Summary Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                What can Observer link viewers do?
              </p>
              <ul className="space-y-1.5 text-[11px] text-slate-600 pt-1">
                <li className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Real-time Board Visibility:</strong> View all project statuses, deadlines, PM assignments, and Email SLA metrics instantly.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Auto-Syncing Stream:</strong> Board data updates automatically every 30 seconds.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span><strong>Strict Read-Only Guard:</strong> Cannot change statuses, alter target dates, post updates, or push data to Monday.com.</span>
                </li>
              </ul>
            </div>

            {/* Test Link Action */}
            <div className="flex items-center justify-between pt-2">
              <a
                href={inviteUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-[#6161FF] hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Test Open Observer View in New Tab
              </a>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
