import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Copy, Check, Share2 } from 'lucide-react';

interface ShareCodeModalProps {
  shareCode: string;
  firmwareName: string;
  onClose: () => void;
}

const ShareCodeModal: React.FC<ShareCodeModalProps> = ({ shareCode, firmwareName, onClose }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = shareCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Share2 size={18} className="text-primary" />
            {t('share.share_code')}
          </h3>
          <button onClick={onClose} className="text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium truncate">{firmwareName}</p>

          {/* Share code display */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareCode}
              className="flex-1 px-4 py-3 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-600 text-base font-mono text-slate-900 dark:text-white text-center tracking-wider select-all focus:outline-none focus:ring-2 focus:ring-primary/50"
              onClick={e => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={handleCopy}
              className={`p-3 rounded-lg border transition-all shrink-0 ${
                copied
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                  : 'bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-600 text-slate-600 dark:text-slate-400 hover:text-primary hover:border-primary/30'
              }`}
              title={t('share.copy_code')}
            >
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </button>
          </div>

          {copied && (
            <p className="text-sm text-emerald-500 text-center font-medium">{t('share.copied')}</p>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-500 text-center leading-relaxed">
            {t('share.share_hint')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShareCodeModal;
