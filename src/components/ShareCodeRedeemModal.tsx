import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, AlertTriangle, Download, Loader2, Hash, Clock, CheckCircle, XCircle, User, FileCode, Cpu } from 'lucide-react';

interface SharedFirmware {
  name: string;
  filename: string;
  version: string;
  description: string;
  size: number;
  compressed_size: number;
  sha256: string;
  md5: string;
  oss_url: string;
  firmware_type: string[];
  product_id: string;
  source: string;
  source_code_url: string;
  author_name: string;
  author_link: string;
  path: string;
}

interface ShareLookupResult {
  firmware: SharedFirmware;
  status: string;
  share_code: string;
  uploaded_at: string;
  uploader: {
    login: string;
    name: string;
    avatar_url: string;
  };
}

interface ShareCodeRedeemModalProps {
  onClose: () => void;
  onDownloadFlash?: (firmware: SharedFirmware) => void;
}

async function getApiUrl(): Promise<string> {
  if (window.ipcRenderer) {
    return window.ipcRenderer.invoke('get-api-base-url');
  }
  throw new Error('Not in Electron environment');
}

const ShareCodeRedeemModal: React.FC<ShareCodeRedeemModalProps> = ({ onClose, onDownloadFlash }) => {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ShareLookupResult | null>(null);

  const handleLookup = async () => {
    const trimmed = code.trim().toLowerCase();
    if (trimmed.length !== 8 || !/^[0-9a-f]+$/.test(trimmed)) {
      setError(t('share.not_found'));
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const apiUrl = await getApiUrl();
      const resp = await fetch(`${apiUrl}/share/${trimmed}`);
      const data = await resp.json();

      if (resp.ok && data.success) {
        setResult(data);
      } else {
        setError(data.error || t('share.not_found'));
      }
    } catch {
      setError(t('share.not_found'));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.trim().length === 8) {
      handleLookup();
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={14} className="text-amber-500" />;
      case 'approved': return <CheckCircle size={14} className="text-emerald-500" />;
      case 'rejected': return <XCircle size={14} className="text-red-500" />;
      default: return <Clock size={14} className="text-slate-400" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'approved': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'rejected': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const statusText = (status: string) => {
    switch (status) {
      case 'pending': return t('share.status_pending');
      case 'approved': return t('share.status_approved');
      case 'rejected': return t('share.status_rejected');
      case 'cancelled': return t('share.status_cancelled');
      default: return status;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Hash size={18} className="text-primary" />
            {result ? t('share.shared_firmware') : t('share.redeem')}
          </h3>
          <button onClick={onClose} className="text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Input area (always visible) */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={code}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 8);
                  setCode(v);
                  setError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder={t('share.redeem_placeholder')}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-600 text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 tracking-wider"
                autoFocus
              />
            </div>
            <button
              onClick={handleLookup}
              disabled={code.trim().length !== 8 || loading}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all shrink-0 ${
                code.trim().length !== 8 || loading
                  ? 'bg-slate-300 dark:bg-zinc-700 text-slate-500 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/20'
              }`}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {t('share.redeem_button')}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-6">
              <Loader2 size={24} className="animate-spin text-primary" />
              <span className="ml-2 text-sm text-slate-500">{t('share.loading')}</span>
            </div>
          )}

          {/* Result */}
          {result && (
            <>
              {/* Third-party warning */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                  <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{t('share.third_party_warning')}</span>
                </div>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80 leading-relaxed ml-6">
                  {t('share.third_party_warning_desc')}
                </p>
              </div>

              {/* Firmware info card */}
              <div className="bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-700 rounded-lg p-4 space-y-3">
                {/* Name + Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-slate-900 dark:text-white text-sm truncate">{result.firmware.name}</h4>
                    {result.firmware.version && (
                      <span className="text-xs text-slate-500">{result.firmware.version}</span>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${statusColor(result.status)}`}>
                    {statusIcon(result.status)} {statusText(result.status)}
                  </span>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <span className="text-slate-400"><FileCode size={11} className="inline mr-1 -mt-0.5" />{result.firmware.filename}</span>
                  </div>
                  <div>
                    <span className="text-slate-400"><Cpu size={11} className="inline mr-1 -mt-0.5" />{result.firmware.product_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">{formatSize(result.firmware.size)}</span>
                    {result.firmware.compressed_size > 0 && (
                      <span className="text-slate-400"> → {formatSize(result.firmware.compressed_size)} ZIP</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <User size={11} className="text-slate-400" />
                    {result.uploader.avatar_url && (
                      <img src={result.uploader.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                    )}
                    <span className="text-slate-500">{result.firmware.author_name || result.uploader.login}</span>
                  </div>
                </div>

                {/* Description */}
                {result.firmware.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-zinc-700 pt-2 leading-relaxed">
                    {result.firmware.description}
                  </p>
                )}

                {/* SHA256 */}
                <div className="font-mono text-[10px] text-slate-400 break-all">
                  SHA256: {result.firmware.sha256}
                </div>
              </div>

              {/* Download button */}
              <button
                onClick={() => {
                  if (onDownloadFlash && result.firmware.oss_url) {
                    onDownloadFlash(result.firmware);
                  } else if (result.firmware.oss_url) {
                    window.open(result.firmware.oss_url, '_blank');
                  }
                }}
                className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all"
              >
                <Download size={18} />
                {t('share.download_flash')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareCodeRedeemModal;
