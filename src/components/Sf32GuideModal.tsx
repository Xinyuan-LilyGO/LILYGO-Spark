import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Check, Copy, ExternalLink, FolderOpen, Save, AlertTriangle, X } from 'lucide-react';
import type { DownloadedFile } from '../contexts/DownloadContext';
import { sftoolWriteCommand, type Sf32Extracted, type Sf32PackageInfo } from '../utils/sf32';

/**
 * How to flash a downloaded SF32 (T-Display SF32) release package. Spark does
 * not flash SF32 boards itself: it unzips the package into a folder and tells
 * the user how to run the release's own installer, or SiFli's sftool.
 */
interface Sf32GuideModalProps {
  firmwareName: string;
  sourceCodeUrl?: string;
  pkg: Sf32PackageInfo;
  file: DownloadedFile;
  onSaveAs: () => void;
  onClose: () => void;
}

const SFTOOL_RELEASES = 'https://github.com/OpenSiFli/sftool/releases';
const CH343_DRIVER = 'https://www.wch-ic.com/downloads/CH343SER_EXE.html';

function openLink(url: string) {
  window.ipcRenderer?.invoke('open-url', url, localStorage.getItem('lilygo_link_open_mode') || 'external');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const Step: React.FC<{ n: number; title: string; children?: React.ReactNode }> = ({ n, title, children }) => (
  <li className="flex gap-3">
    <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center mt-0.5">{n}</span>
    <div className="min-w-0 flex-1">
      <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{title}</div>
      {children && <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 space-y-1">{children}</div>}
    </div>
  </li>
);

const Sf32GuideModal: React.FC<Sf32GuideModalProps> = ({ firmwareName, sourceCodeUrl, pkg, file, onSaveAs, onClose }) => {
  const { t } = useTranslation();
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<Sf32Extracted | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Absolute image paths, so it runs from any directory; known once extracted
  const command = extracted ? sftoolWriteCommand(pkg, extracted) : null;

  const handleExtract = async () => {
    setExtracting(true);
    setExtractError(null);
    try {
      const result = await window.ipcRenderer.invoke('extract-sf32-package', file.path);
      if (!result?.success) setExtractError(result?.error || 'Extract failed');
      else if (result.path) setExtracted({ path: result.path, strip: result.strip ?? null, sep: result.sep || '/' });
    } finally {
      setExtracting(false);
    }
  };

  const handleCopy = async () => {
    if (!command) return;
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center bg-slate-100 dark:bg-zinc-900/50 rounded-t-xl">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
            <BookOpen className="mr-2 text-primary" size={20} />
            {t('sf32.guide_title')}
          </h3>
          <button onClick={onClose} className="text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Package */}
          <div className="bg-slate-100 dark:bg-zinc-700/30 p-3 rounded-lg border border-slate-200 dark:border-zinc-600/50">
            <div className="text-sm text-slate-800 dark:text-slate-200 font-medium">{firmwareName}</div>
            <div className="text-xs font-mono text-slate-500 break-all mt-0.5">{file.fileName}</div>
            <table className="mt-2 w-full text-[11px] font-mono text-slate-600 dark:text-slate-400">
              <tbody>
                {pkg.images.map(img => (
                  <tr key={img.role}>
                    <td className="pr-3 py-0.5 whitespace-nowrap">{img.addr}</td>
                    <td className="pr-3 py-0.5 break-all">{img.path}</td>
                    <td className="py-0.5 text-right whitespace-nowrap">{formatSize(img.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">{t('sf32.not_in_app')}</p>
          </div>

          {/* Before you start */}
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <AlertTriangle size={14} />
              {t('sf32.before_title')}
            </p>
            <ul className="mt-1.5 text-xs text-amber-800 dark:text-amber-300/90 list-disc pl-5 space-y-0.5">
              <li>{t('sf32.before_battery')}</li>
              <li>{t('sf32.before_keyboard')}</li>
              <li>{t('sf32.before_cable')}</li>
              <li>{t('sf32.before_close_ports')}</li>
              <li>
                {t('sf32.before_driver')}{' '}
                <button onClick={() => openLink(CH343_DRIVER)} className="underline hover:no-underline">{t('sf32.driver_link')}</button>
              </li>
            </ul>
          </div>

          {/* Steps */}
          <ol className="space-y-4">
            <Step n={1} title={t('sf32.step_extract')}>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={handleExtract}
                  disabled={extracting}
                  className="px-3 py-1.5 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white rounded-lg flex items-center text-xs font-medium transition-all active:scale-95"
                >
                  <FolderOpen size={14} className="mr-1.5" />
                  {extracting ? t('sf32.extracting') : t('sf32.extract_button')}
                </button>
                <button
                  onClick={onSaveAs}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 text-slate-700 dark:text-slate-200 rounded-lg flex items-center text-xs font-medium transition-colors"
                >
                  <Save size={14} className="mr-1.5" />
                  {t('sf32.save_zip')}
                </button>
              </div>
              {extracted && (
                <p className="text-emerald-600 dark:text-emerald-400 break-all flex items-start gap-1">
                  <Check size={12} className="mt-0.5 shrink-0" />
                  {t('sf32.extracted_to', { path: extracted.path, interpolation: { escapeValue: false } })}
                </p>
              )}
              {extractError && <p className="text-red-500 break-all">{extractError}</p>}
            </Step>

            {pkg.installer ? (
              <>
                <Step n={2} title={t('sf32.step_run_installer')}>
                  <p><span className="font-medium">macOS</span>: {t('sf32.installer_mac')}</p>
                  <p><span className="font-medium">Windows</span>: {t('sf32.installer_windows')}</p>
                  <p><span className="font-medium">Linux</span>: {t('sf32.installer_linux')}</p>
                </Step>
                <Step n={3} title={t('sf32.step_wait_done')}>
                  <p>{t('sf32.installer_safe')}</p>
                </Step>
              </>
            ) : (
              <>
                <Step n={2} title={t('sf32.step_get_sftool')}>
                  <button onClick={() => openLink(SFTOOL_RELEASES)} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <ExternalLink size={12} />
                    github.com/OpenSiFli/sftool
                  </button>
                </Step>
                <Step n={3} title={t('sf32.step_run_sftool')}>
                  {command ? (
                  <div className="relative">
                    <pre className="p-2.5 pr-9 rounded-lg bg-slate-900 text-slate-100 text-[11px] font-mono whitespace-pre-wrap break-all">{command}</pre>
                    <button
                      onClick={handleCopy}
                      className="absolute top-1.5 right-1.5 p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                      title={t('sf32.copy')}
                    >
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  ) : (
                    <p className="italic">{t('sf32.command_after_extract')}</p>
                  )}
                  <p>{t('sf32.port_hint')}</p>
                  <p className="text-amber-700 dark:text-amber-400">{t('sf32.sftool_stall')}</p>
                </Step>
              </>
            )}
          </ol>

          {/* Recovery */}
          <div className="text-xs text-slate-500 border-t border-slate-200 dark:border-zinc-700 pt-3 space-y-1">
            <p>{t('sf32.recover')}</p>
            {sourceCodeUrl && (
              <button onClick={() => openLink(sourceCodeUrl)} className="inline-flex items-center gap-1 text-primary hover:underline">
                <ExternalLink size={12} />
                {t('sf32.project_docs')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sf32GuideModal;
