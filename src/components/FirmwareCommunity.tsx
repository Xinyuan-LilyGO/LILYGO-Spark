import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ExternalLink, Download, FileCode, Cpu, RefreshCw, ChevronDown, ChevronRight, Layers, Github, Save, Trash2, Zap, Microscope, User, Pencil, X, ServerCrash, Share2, Check, Hash } from 'lucide-react';
import BurnerModal from './BurnerModal';
import ProductManager from './ProductManager';
import ShareCodeRedeemModal from './ShareCodeRedeemModal';
import { useDownload } from '../contexts/DownloadContext';
import type { DownloadedFile } from '../contexts/DownloadContext';

interface Product {
  product_id: string;
  name: string;
  description: string;
  mcu: string;
  github_repo: string;
  product_page: string;
  image_url: string;
}

interface ProductGroup {
  id?: string; // Series ID
  product_id?: string; // Single product ID
  name: string;
  description: string;
  image_url: string;
  products?: Product[];
  // Single product fields
  mcu?: string;
  github_repo?: string;
  product_page?: string;
}

interface Firmware {
  supported_product_ids: string[];
  name: string;
  version: string;
  type: string;
  filename: string;
  download_url: string;
  description: string;
  release_note?: string;
  size?: number;
  compressed_size?: number;
  oss_url?: string;
  md5?: string;
  sha256?: string;
  source?: string;
  source_code_url?: string;
  published_at?: string;
  author_name?: string;
  author_link?: string;
  author_email?: string;
}

interface Manifest {
  product_list: ProductGroup[];
  firmware_list: Firmware[];
}

interface FirmwareCommunityProps {
  isAdmin?: boolean;
  token?: string | null;
  onSelectFirmware?: (url: string) => void;
  onNavigateToAnalyzer?: (filePath: string, fileName: string) => void;
}

async function getApiUrl(): Promise<string> {
  if (window.ipcRenderer) {
    return window.ipcRenderer.invoke('get-api-base-url');
  }
  throw new Error('Not in Electron environment');
}

// DownloadedFile imported from DownloadContext

const STORAGE_KEY_ONLY_WITH_FIRMWARE = 'firmware_center_only_with_firmware';

/** 在 Electron file:// 协议下，/path 会解析为根目录导致 404，需转为相对路径 */
function resolveImageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  if (url.startsWith('/')) return url.slice(1); // /devices/xxx -> devices/xxx，相对当前文档解析
  return url;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDownloadCount(count: number): string {
  if (count < 1000) return String(count);
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  return `${Math.round(count / 1000)}k`;
}

function productHasFirmware(manifest: Manifest, productId: string): boolean {
  return manifest.firmware_list.some(f => f.supported_product_ids.includes(productId));
}

const FirmwareCommunity: React.FC<FirmwareCommunityProps> = ({ isAdmin, token, onSelectFirmware: _onSelectFirmware, onNavigateToAnalyzer }) => {
  const { t } = useTranslation();
  const [manifest, setManifest] = useState<Manifest>({ product_list: [], firmware_list: [] });
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());
  const [onlyWithFirmware, setOnlyWithFirmware] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY_ONLY_WITH_FIRMWARE);
    return stored !== 'false'; // default true
  });
  
  // Global download state from context
  const { tasks, startDownload, removeDownload, saveAs: saveDownloadAs } = useDownload();
  
  // Burner Modal State
  const [burnerModalOpen, setBurnerModalOpen] = useState(false);
  const [fileToBurn, setFileToBurn] = useState<DownloadedFile | null>(null);

  // Admin firmware management state
  const [adminMode, setAdminMode] = useState(false);
  const [editingFirmware, setEditingFirmware] = useState<{ sha256: string; fields: Record<string, string> } | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Download counts state
  const [downloadCounts, setDownloadCounts] = useState<Record<string, number>>({});

  // Product manager modal state
  const [showProductManager, setShowProductManager] = useState(false);

  // Share code state
  const [copiedShareCode, setCopiedShareCode] = useState<string | null>(null);
  const [shareCodeFirmware, setShareCodeFirmware] = useState<Firmware | null>(null);
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  const loadManifest = async () => {
    setLoading(true);
    try {
      // @ts-ignore - ipcRenderer is exposed via contextBridge
      const data = await window.ipcRenderer.invoke('get-firmware-manifest');
      setManifest(data);
      
      // Select first available product
      if (data.product_list.length > 0 && !selectedProductId) {
        const first = data.product_list[0];
        const v0 = first.products?.[0];
        const productId = v0 && 'product_id' in v0 ? v0.product_id : null;
        if (productId) {
          setSelectedProductId(productId);
        } else if (first.product_id) {
          setSelectedProductId(first.product_id);
        }
      }
    } catch (error) {
      console.error('Failed to load manifest:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDownloadCounts = async () => {
    try {
      const apiUrl = await getApiUrl();
      const resp = await fetch(`${apiUrl}/stats/downloads`);
      const data = await resp.json();
      if (data.success && data.counts) {
        setDownloadCounts(data.counts);
      }
    } catch (error) {
      console.error('Failed to load download counts:', error);
    }
  };

  useEffect(() => {
    loadManifest();
    loadDownloadCounts();
  }, []);

  useEffect(() => {
    if (!window.ipcRenderer) return;
    const handler = () => loadManifest();
    window.ipcRenderer.on('manifest-source-changed', handler);
    return () => { window.ipcRenderer.off('manifest-source-changed'); };
  }, []);

  const toggleSeries = (seriesId: string, forceState?: boolean) => {
    setExpandedSeries(prev => {
      const next = new Set(prev);
      const shouldExpand = forceState !== undefined ? forceState : !next.has(seriesId);
      if (shouldExpand) {
        next.add(seriesId);
      } else {
        next.delete(seriesId);
      }
      return next;
    });
  };

  // Helper to find product details by ID (could be single product or in series)
  const findProductById = (id: string | null): Product | ProductGroup | null => {
    if (!id) return null;
    for (const group of manifest.product_list) {
      if (group.product_id === id) return group;
      if (group.products) {
        const product = group.products.find(v => v.product_id === id);
        if (product) return product;
      }
    }
    return null;
  };

  const selectedProduct = findProductById(selectedProductId);

  const relatedFirmwares = React.useMemo(() => {
    return manifest.firmware_list.filter(f =>
      selectedProductId && f.supported_product_ids.includes(selectedProductId)
    );
  }, [manifest.firmware_list, selectedProductId]);

  const handleOnlyWithFirmwareChange = (checked: boolean) => {
    setOnlyWithFirmware(checked);
    localStorage.setItem(STORAGE_KEY_ONLY_WITH_FIRMWARE, String(checked));
  };

  // Share code: generate 8-char code from sha256
  const generateShareCode = (fw: Firmware): string => {
    return fw.sha256 ? fw.sha256.slice(0, 8) : '';
  };

  const handleCopyShareCode = (fw: Firmware) => {
    const code = generateShareCode(fw);
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedShareCode(code);
    setTimeout(() => setCopiedShareCode(null), 2000);
  };

  // Detect if input looks like a share code: starts with # or is pure hex >= 6 chars
  const isShareCode = (input: string): string | null => {
    const trimmed = input.trim();
    if (trimmed.startsWith('#')) return trimmed.slice(1).toLowerCase();
    if (/^[0-9a-f]{6,}$/i.test(trimmed)) return trimmed.toLowerCase();
    return null;
  };

  // Open firmware detail modal by share code (sha256 prefix match)
  // First try local manifest, then fall back to server API for pending/unapproved firmware
  const handleShareCodeGo = (code: string) => {
    const fw = manifest.firmware_list.find(f => f.sha256?.toLowerCase().startsWith(code));
    if (fw) {
      setShareCodeFirmware(fw);
      setSearchQuery('');
    } else {
      // Not in manifest — open the redeem modal with the code pre-filled
      setSearchQuery('');
      setShowRedeemModal(true);
    }
  };

  // Filter logic: search + optionally only products with firmware
  // If input is a share code, don't filter devices
  const q = isShareCode(searchQuery) ? '' : (searchQuery?.toLowerCase() ?? '');
  const filteredGroups = manifest.product_list.map(group => {
    const groupName = group.name ?? '';
    // If it's a single product (no products array), check match
    if (!group.products || !group.products.some((v: any) => 'product_id' in v)) {
      const matches = groupName.toLowerCase().includes(q) || 
                      (group.mcu ?? '').toLowerCase().includes(q);
      if (!matches) return null;
      if (onlyWithFirmware && !productHasFirmware(manifest, group.product_id ?? '')) return null;
      return group;
    }

    // If it's a series with products, check if series matches OR any product matches
    const seriesMatches = groupName.toLowerCase().includes(q);
    let matchingProducts = group.products.filter((v: any) => {
      const vName = (v.name ?? v.title ?? '').toLowerCase();
      const vMcu = (v.mcu ?? '').toLowerCase();
      return vName.includes(q) || vMcu.includes(q);
    });
    if (onlyWithFirmware) {
      matchingProducts = matchingProducts.filter((v: Product) =>
        productHasFirmware(manifest, v.product_id)
      );
    }
    const productsToUse = seriesMatches
      ? (onlyWithFirmware ? group.products!.filter((v: Product) => productHasFirmware(manifest, v.product_id)) : group.products)
      : matchingProducts;

    if (productsToUse.length > 0) {
      return { ...group, products: productsToUse };
    }
    return null;
  }).filter(Boolean) as ProductGroup[];

  const filteredProductCount = filteredGroups.reduce((sum, g) => sum + (g.products?.length ?? (g.product_id ? 1 : 0)), 0);

  // Auto-expand series if searching
  useEffect(() => {
    if (searchQuery) {
      const newExpanded = new Set<string>();
      filteredGroups.forEach(g => {
        if (g.products && g.id) newExpanded.add(g.id);
      });
      setExpandedSeries(newExpanded);
    }
  }, [searchQuery]);

  const handleDownload = async (fw: Firmware) => {
      const task = tasks[fw.download_url];
      if (task?.downloading) return;
      await startDownload(fw.download_url, {
        expectedMd5: fw.md5,
        ossUrl: fw.oss_url,
        originalFilename: fw.filename,
      });
      // Fire-and-forget: report download count
      if (fw.sha256) {
        getApiUrl().then(apiUrl =>
          fetch(`${apiUrl}/stats/download/${fw.sha256}`, { method: 'POST' })
            .then(r => r.json())
            .then(data => {
              if (data.success) {
                setDownloadCounts(prev => ({ ...prev, [fw.sha256!]: data.count }));
              }
            })
            .catch(() => {})
        );
      }
  };

  const handleRemove = async (url: string) => {
      await removeDownload(url);
  };

  const handleSaveAs = async (url: string) => {
      await saveDownloadAs(url);
  };

  const handleBurnClick = (url: string) => {
      const task = tasks[url];
      if (task?.file) {
          setFileToBurn(task.file);
          setBurnerModalOpen(true);
      }
  };

  // Show a non-blocking toast notification (avoids Windows alert() focus bug)
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Admin: delete firmware from manifest
  const handleDeleteFirmware = async (fw: Firmware) => {
    if (!selectedProductId || !fw.sha256) return;
    if (!confirm(t('firmwareCenter.confirm_delete', { name: fw.name }))) return;
    setAdminBusy(true);
    try {
      const apiUrl = await getApiUrl();
      const resp = await fetch(`${apiUrl}/manifest/firmware`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ product_id: selectedProductId, sha256: fw.sha256 }),
      });
      const data = await resp.json();
      if (resp.ok) {
        showToast(t('firmwareCenter.delete_success'));
        loadManifest();
      } else {
        showToast(`${t('firmwareCenter.delete_failed')}: ${data.error}`, 'error');
      }
    } catch (e: any) {
      showToast(`${t('firmwareCenter.delete_failed')}: ${e.message}`, 'error');
    } finally {
      setAdminBusy(false);
    }
  };

  // Admin: start editing firmware metadata
  const handleStartEdit = (fw: Firmware) => {
    setEditingFirmware({
      sha256: fw.sha256 || '',
      fields: {
        name: fw.name || '',
        release_tag: fw.version || '',
        description: fw.description || '',
        source: fw.source || '',
        source_code_url: fw.source_code_url || '',
        author_name: fw.author_name || '',
        author_link: fw.author_link || '',
        author_email: fw.author_email || '',
        firmware_type: fw.type || '',
        path: '',
      },
    });
  };

  // Admin: save edited firmware metadata
  const handleSaveEdit = async () => {
    if (!editingFirmware || !selectedProductId) return;
    setAdminBusy(true);
    try {
      const apiUrl = await getApiUrl();
      const resp = await fetch(`${apiUrl}/manifest/firmware`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          product_id: selectedProductId,
          sha256: editingFirmware.sha256,
          updates: editingFirmware.fields,
        }),
      });
      const data = await resp.json();
      if (resp.ok) {
        showToast(t('firmwareCenter.edit_success'));
        setEditingFirmware(null);
        loadManifest();
      } else {
        showToast(`${t('firmwareCenter.edit_failed')}: ${data.error}`, 'error');
      }
    } catch (e: any) {
      showToast(`${t('firmwareCenter.edit_failed')}: ${e.message}`, 'error');
    } finally {
      setAdminBusy(false);
    }
  };

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 dark:bg-zinc-900 dark:text-slate-100 overflow-hidden relative transition-colors">
      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm text-white transition-all ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.message}
        </div>
      )}
      {/* Share Code Redeem Modal — for pending/unapproved firmware via server API */}
      {showRedeemModal && (
        <ShareCodeRedeemModal
          onClose={() => setShowRedeemModal(false)}
          onDownloadFlash={(firmware) => {
            if (firmware.oss_url) {
              window.open(firmware.oss_url, '_blank');
            }
            setShowRedeemModal(false);
          }}
        />
      )}
      {/* Burner Modal */}
      {burnerModalOpen && fileToBurn && (
          <BurnerModal
              file={fileToBurn}
              onClose={() => setBurnerModalOpen(false)}
          />
      )}
      {/* Product Manager Modal */}
      {showProductManager && token && (
          <ProductManager
              token={token}
              onClose={() => { setShowProductManager(false); loadManifest(); }}
          />
      )}

      {/* Share Code Firmware Modal */}
      {shareCodeFirmware && (() => {
        const fw = shareCodeFirmware;
        const task = tasks[fw.download_url];
        const isDownloaded = !!task?.file;
        const isDownloading = task?.downloading ?? false;
        const progress = task?.progress ?? 0;
        // Resolve supported product names
        const supportedProducts = fw.supported_product_ids.map(pid => {
          const p = findProductById(pid);
          return { id: pid, name: p?.name || pid };
        });
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShareCodeFirmware(null)}>
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700 w-[560px] max-w-[90vw] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-zinc-700">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-primary mb-1 flex items-center gap-1.5">
                    <Hash size={12} />
                    {t('firmwareCenter.share_code_modal_title')}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 break-all">{fw.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      fw.type === 'factory' ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700' :
                      fw.type === 'micropython' ? 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700' :
                      'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700'
                    }`}>
                      {fw.type === 'bin' ? 'REPO' : fw.type.toUpperCase()}
                    </span>
                    {fw.sha256 && <span className="text-xs text-slate-400 font-mono">{generateShareCode(fw)}</span>}
                  </div>
                </div>
                <button onClick={() => setShareCodeFirmware(null)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg transition-colors ml-3">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {/* Info rows */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-mono">
                  <span>{t('firmwareCenter.version')}: {fw.version}</span>
                  {fw.sha256 && downloadCounts[fw.sha256] > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-slate-500 dark:text-slate-400">
                      <Download size={11} /> {formatDownloadCount(downloadCounts[fw.sha256])}
                    </span>
                  )}
                  {fw.filename && <span className="break-all">{t('firmwareCenter.file')}: {fw.filename}</span>}
                  {fw.size && <span>{formatFileSize(fw.size)}</span>}
                  {fw.compressed_size && fw.size && (
                    <span className="text-green-600 dark:text-green-400">
                      ZIP ↓ {formatFileSize(fw.compressed_size)} ({Math.round((1 - fw.compressed_size / fw.size) * 100)}%)
                    </span>
                  )}
                </div>

                {/* Links */}
                <div className="flex flex-wrap gap-3 text-xs">
                  {fw.oss_url && (
                    <a href={fw.oss_url} onClick={e => { e.preventDefault(); window.ipcRenderer?.invoke('open-url', fw.oss_url, localStorage.getItem('lilygo_link_open_mode') || 'internal'); }} className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600 transition-colors cursor-pointer">
                      <ExternalLink size={12} /> OSS ⚡
                    </a>
                  )}
                  {fw.source_code_url && (
                    <a href={fw.source_code_url} onClick={e => { e.preventDefault(); window.ipcRenderer?.invoke('open-url', fw.source_code_url!, localStorage.getItem('lilygo_link_open_mode') || 'internal'); }} className="inline-flex items-center gap-1 text-slate-500 hover:text-primary transition-colors cursor-pointer">
                      <Github size={12} /> {t('firmwareCenter.source_code')}
                    </a>
                  )}
                  {fw.author_name && (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <User size={12} /> {fw.author_name}
                    </span>
                  )}
                </div>

                {fw.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">{fw.description}</p>
                )}

                {/* Supported Products */}
                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('firmwareCenter.supported_products')}</h4>
                  <div className="flex flex-wrap gap-2">
                    {supportedProducts.map(p => (
                      <span key={p.id} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-zinc-600">
                        <Cpu size={12} className="text-slate-400" />
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer: Actions */}
              <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200 dark:border-zinc-700">
                {isDownloading ? (
                  <div className="flex flex-col items-center min-w-[160px]">
                    <div className="text-xs text-primary mb-1">{t('firmwareCenter.downloading')} {progress}%</div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ) : isDownloaded ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setShareCodeFirmware(null); handleBurnClick(fw.download_url); }} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center shadow-lg shadow-emerald-900/20 transition-all active:scale-95">
                      <Zap size={18} className="mr-2" />
                      {t('firmwareCenter.burn')}
                    </button>
                    <button onClick={() => handleSaveAs(fw.download_url)} className="p-2.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg transition-colors" title={t('firmwareCenter.save_as')}>
                      <Save size={18} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => handleDownload(fw)} className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg flex items-center shadow-lg shadow-primary/20 transition-all active:scale-95">
                    <Download size={18} className="mr-2" />
                    {t('firmwareCenter.download')}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Copy Toast */}
      {copiedShareCode && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 dark:bg-zinc-700 text-white text-sm rounded-xl shadow-2xl border border-zinc-600">
            <Check size={14} className="text-green-400" />
            {t('firmwareCenter.share_code_copied')}
          </div>
        </div>
      )}

      {/* Left Column: Device List */}
      <div className="w-[36%] min-w-[260px] max-w-[500px] shrink-0 border-r border-slate-200 dark:border-zinc-700 flex flex-col bg-slate-100/80 dark:bg-zinc-800/50">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-700 space-y-3">
          <div className="relative">
            {isShareCode(searchQuery) ? (
              <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary" size={18} />
            ) : (
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 dark:text-slate-400" size={18} />
            )}
            <input
              type="text"
              placeholder={t('firmwareCenter.search_or_share_code')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const code = isShareCode(searchQuery);
                  if (code) handleShareCodeGo(code);
                }
              }}
              className={`w-full bg-white dark:bg-zinc-900 border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none text-slate-800 dark:text-slate-200 placeholder-slate-500 ${
                isShareCode(searchQuery) ? 'border-primary font-mono' : 'border-slate-300 dark:border-zinc-700 focus:border-primary'
              }`}
            />
            {isShareCode(searchQuery) && (
              <button
                onClick={() => { const code = isShareCode(searchQuery); if (code) handleShareCodeGo(code); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs bg-primary text-white rounded-md hover:bg-primary-hover transition-colors"
              >
                {t('firmwareCenter.share_code_go')}
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
            <input
              type="checkbox"
              checked={onlyWithFirmware}
              onChange={(e) => handleOnlyWithFirmwareChange(e.target.checked)}
              className="rounded border-slate-300 dark:border-zinc-600 text-primary focus:ring-primary"
            />
            <span>
              {t('firmwareCenter.only_with_firmware')}
              <span className="text-slate-500 dark:text-zinc-500 ml-1">{t('firmwareCenter.product_count', { count: filteredProductCount })}</span>
            </span>
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
          {loading ? (
             <div className="space-y-2 p-1">
               {[1, 2, 3, 4, 5, 6].map(i => (
                 <div key={i} className="p-3 rounded-xl border border-transparent bg-slate-100 dark:bg-zinc-800/50 animate-pulse flex items-center">
                   <div className="w-16 h-16 bg-slate-200 dark:bg-zinc-700/50 rounded-lg shrink-0 mr-3"></div>
                   <div className="flex-1 min-w-0 space-y-2">
                     <div className="h-4 bg-slate-200 dark:bg-zinc-700/50 rounded w-3/4"></div>
                     <div className="h-3 bg-slate-200 dark:bg-zinc-700/50 rounded w-1/2"></div>
                   </div>
                 </div>
               ))}
             </div>
          ) : filteredGroups.length === 0 ? (
             <div className="text-center py-10 text-slate-500 dark:text-slate-500">{t('firmwareCenter.no_devices_found')}</div>
          ) : (
            filteredGroups.map(group => {
              const hasProducts = !!group.products?.length && group.products.some((v: any) => 'product_id' in v);
              const isSeries = hasProducts;
              const isExpanded = group.id ? expandedSeries.has(group.id) : false;
              
              if (isSeries) {
                return (
                  <div key={group.id}>
                    {/* Series Header */}
                    <div 
                      onClick={() => group.id && toggleSeries(group.id)}
                      className="flex items-center p-3 rounded-xl cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors select-none group/header"
                    >
                      <div className="h-16 flex items-center justify-center mr-2 text-slate-500 dark:text-slate-500 group-hover/header:text-slate-700 dark:group-hover/header:text-slate-300 transition-colors">
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </div>
                      <div className="w-16 h-16 bg-white rounded-lg p-1 flex items-center justify-center shrink-0 overflow-hidden mr-3 shadow-sm">
                         <img 
                           src={resolveImageUrl(group.image_url)} 
                           alt={group.name} 
                           className="max-w-full max-h-full object-contain"
                           onError={(e) => {
                             (e.target as HTMLImageElement).style.display = 'none';
                             ((e.target as HTMLImageElement).nextSibling as HTMLElement).style.display = 'flex';
                           }}
                         />
                         <div className="hidden w-full h-full items-center justify-center bg-slate-200 text-slate-400">
                            <Layers size={24} />
                         </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">{group.name}</h3>
                        <div className="flex items-center text-xs text-slate-500 mt-1">
                           <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 mr-2">{group.products?.length} {t('firmwareCenter.products')}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 truncate">{group.description}</p>
                      </div>
                    </div>

                    {/* Products List */}
                    {isExpanded && (
                      <div className="ml-[20px] pl-6 border-l-2 border-slate-700/50 mt-1 space-y-1">
                        {group.products?.map(product => (
                          <div 
                            key={product.product_id}
                            onClick={() => setSelectedProductId(product.product_id)}
                            className={`p-2 rounded-lg cursor-pointer transition-all duration-200 flex items-center ${
                              selectedProductId === product.product_id 
                                ? 'bg-primary/10 text-primary border border-primary/30' 
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                          >
                             <div className="w-12 h-12 bg-white rounded-md p-1 flex items-center justify-center shrink-0 mr-3 overflow-hidden shadow-sm">
                                <img 
                                   src={resolveImageUrl(product.image_url)} 
                                   alt={product.name} 
                                   className="max-w-full max-h-full object-contain"
                                   onError={(e) => {
                                     (e.target as HTMLImageElement).style.display = 'none';
                                     ((e.target as HTMLImageElement).nextSibling as HTMLElement).style.display = 'flex';
                                   }}
                                 />
                                 <div className="hidden w-full h-full items-center justify-center bg-slate-200 text-slate-400">
                                    <Cpu size={16} />
                                 </div>
                             </div>
                             <div className="min-w-0">
                                <div className="font-medium text-sm truncate">{product.name}</div>
                                <div className="text-[10px] opacity-70">{product.mcu}</div>
                             </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // Single Product
              return (
                <div 
                  key={group.product_id}
                  onClick={() => setSelectedProductId(group.product_id!)}
                  className={`p-3 rounded-xl cursor-pointer transition-all duration-200 border flex items-center ${
                    selectedProductId === group.product_id 
                      ? 'bg-primary/10 border-primary/50 shadow-lg shadow-primary/10' 
                      : 'bg-slate-100 dark:bg-zinc-800 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {/* Invisible spacer to match Series chevron width (18px icon + mr-2) roughly 26px */}
                  <div className="w-[18px] mr-2 shrink-0"></div>

                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="w-16 h-16 bg-white rounded-lg p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                       <img 
                         src={resolveImageUrl(group.image_url)} 
                         alt={group.name} 
                         className="max-w-full max-h-full object-contain"
                         onError={(e) => {
                           (e.target as HTMLImageElement).style.display = 'none';
                           ((e.target as HTMLImageElement).nextSibling as HTMLElement).style.display = 'flex';
                         }}
                       />
                       <div className="hidden w-full h-full items-center justify-center bg-slate-200 text-slate-400">
                          <Cpu size={24} />
                       </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold truncate ${selectedProductId === group.product_id ? 'text-primary' : 'text-slate-800 dark:text-slate-200'}`}>
                        {group.name}
                      </h3>
                      <div className="flex items-center text-xs text-slate-500 mt-1">
                        <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 mr-2">{group.mcu}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 truncate">{group.description}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Firmware Details */}
      <div className="flex-1 min-w-[320px] flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
        {selectedProduct ? (
          <>
            {/* Header Product Info */}
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
               <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                 <div className="min-w-0 flex-1">
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2 truncate">{selectedProduct.name}</h2>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-[1.5] line-clamp-3" title={selectedProduct.description}>{selectedProduct.description}</p>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3 sm:mt-4">
                        {selectedProduct.github_repo && (
                          <button
                            type="button"
                            onClick={() => {
                              const mode = localStorage.getItem('lilygo_link_open_mode') || 'internal';
                              if (window.ipcRenderer) {
                                window.ipcRenderer.invoke('open-url', selectedProduct.github_repo, mode);
                              } else {
                                window.open(selectedProduct.github_repo, '_blank');
                              }
                            }}
                            className="flex items-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-sm shrink-0 bg-transparent border-none cursor-pointer p-0"
                          >
                              <Github size={16} className="mr-1.5" /> GitHub Repo
                          </button>
                        )}
                        {selectedProduct.product_page && (
                          <button
                            type="button"
                            onClick={() => {
                              const mode = localStorage.getItem('lilygo_link_open_mode') || 'internal';
                              if (window.ipcRenderer) {
                                window.ipcRenderer.invoke('open-url', selectedProduct.product_page, mode);
                              } else {
                                window.open(selectedProduct.product_page, '_blank');
                              }
                            }}
                            className="flex items-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-sm shrink-0 bg-transparent border-none cursor-pointer p-0"
                          >
                              <ExternalLink size={16} className="mr-1.5" /> Product Page
                          </button>
                        )}
                    </div>
                 </div>
                 {/* Large Image Preview */}
                 <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white dark:bg-white rounded-xl p-2 flex items-center justify-center shadow-2xl shrink-0">
                    <img src={resolveImageUrl(selectedProduct.image_url)} alt="" className="max-w-full max-h-full object-contain" />
                 </div>
               </div>
            </div>

            {/* Firmware List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold flex items-center text-slate-900 dark:text-white">
                    <FileCode className="mr-2 text-primary" />
                    Available Firmware
                    <span className="ml-3 text-sm font-normal text-slate-500 dark:text-slate-500 bg-slate-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                        {relatedFirmwares.length}
                    </span>
                  </h3>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowProductManager(true)}
                        className="px-3 py-1.5 text-xs font-medium rounded-md border transition-colors flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-zinc-600 hover:text-primary hover:border-primary/50"
                      >
                        <Layers size={12} />
                        {t('productManager.title')}
                      </button>
                      <button
                        onClick={() => { setAdminMode(prev => !prev); setEditingFirmware(null); }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors flex items-center gap-1.5 ${
                          adminMode
                            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-300 dark:border-red-700'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-zinc-600 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                      >
                        <Pencil size={12} />
                        {adminMode ? t('firmwareCenter.exit_admin_mode') : t('firmwareCenter.enter_admin_mode')}
                      </button>
                    </div>
                  )}
                </div>

                {relatedFirmwares.length === 0 ? (
                    <div className="p-6 sm:p-8 border border-dashed border-slate-300 dark:border-zinc-700 rounded-xl text-center text-slate-500 text-sm sm:text-base min-w-0">
                        {t('firmwareCenter.no_firmware_found')}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {relatedFirmwares.map((fw, idx) => {
                            const task = tasks[fw.download_url];
                            const isDownloaded = !!task?.file;
                            const isDownloading = task?.downloading ?? false;
                            const progress = task?.progress ?? 0;

                            return (
                                <div key={idx} className={"bg-slate-100 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-xl p-4 hover:border-primary/50 transition-all group min-w-0"}>
                                    {/* Info section — full width */}
                                    <div className="min-w-0">
                                        <div className="flex items-start flex-wrap gap-x-3 gap-y-1 mb-1">
                                            <h4 className="text-lg font-medium text-slate-800 dark:text-slate-200 break-all">{fw.name}</h4>
                                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 mt-1 ${
                                                fw.type === 'factory' ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700' :
                                                fw.type === 'micropython' ? 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700' :
                                                fw.type === 'lora' ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700' :
                                                fw.type === 'bin' ? 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-zinc-700 dark:text-zinc-300 dark:border-zinc-600' :
                                                'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700'
                                            }`}>
                                                {fw.type === 'bin' ? 'REPO' : fw.type.toUpperCase()}
                                            </span>
                                            {fw.sha256 && (
                                              <button
                                                onClick={() => handleCopyShareCode(fw)}
                                                className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-slate-300 dark:border-zinc-600 text-slate-400 dark:text-zinc-500 hover:text-primary hover:border-primary/50 transition-colors mt-1"
                                                title={`${t('firmwareCenter.share_code_label')}: ${generateShareCode(fw)}`}
                                              >
                                                {copiedShareCode === generateShareCode(fw) ? <Check size={10} className="text-green-500" /> : <Share2 size={10} />}
                                                <span className="text-slate-500 dark:text-zinc-400">{t('firmwareCenter.share_code_label')}:</span>
                                                <span className="font-mono">{generateShareCode(fw)}</span>
                                              </button>
                                            )}
                                        </div>
                                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-mono">
                                            <span>{t('firmwareCenter.version')}: {fw.version}</span>
                                            {fw.sha256 && downloadCounts[fw.sha256] > 0 && (
                                                <span className="inline-flex items-center gap-0.5 text-slate-500 dark:text-slate-400" title={t('firmwareCenter.download_count')}>
                                                    <Download size={11} /> {formatDownloadCount(downloadCounts[fw.sha256])}
                                                </span>
                                            )}
                                            {fw.filename && <span className="break-all">{t('firmwareCenter.file')}: {fw.filename}</span>}
                                            {(fw.size || task?.file?.fileSize) && (
                                                <span title="Original size">{formatFileSize(fw.size || task?.file?.fileSize || 0)}</span>
                                            )}
                                            {fw.compressed_size && fw.size && (
                                                <span className="text-green-600 dark:text-green-400" title={`ZIP compressed: ${formatFileSize(fw.compressed_size)} / Original: ${formatFileSize(fw.size)}`}>
                                                    ZIP ↓ {formatFileSize(fw.compressed_size)} ({Math.round((1 - fw.compressed_size / fw.size) * 100)}% compression)
                                                </span>
                                            )}
                                            {fw.oss_url && (
                                                <a
                                                    href={fw.oss_url}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (window.ipcRenderer) {
                                                            const mode = localStorage.getItem('lilygo_link_open_mode') || 'internal';
                                                            window.ipcRenderer.invoke('open-url', fw.oss_url, mode);
                                                        }
                                                    }}
                                                    className="inline-flex items-center gap-0.5 text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors cursor-pointer"
                                                    title={fw.oss_url}
                                                >
                                                    <ExternalLink size={12} /> OSS ⚡
                                                </a>
                                            )}
                                            {fw.download_url && (
                                            <a
                                                href={fw.download_url}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (window.ipcRenderer) {
                                                        const mode = localStorage.getItem('lilygo_link_open_mode') || 'internal';
                                                        window.ipcRenderer.invoke('open-url', fw.download_url, mode);
                                                    }
                                                }}
                                                className="inline-flex items-center gap-0.5 text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-primary transition-colors cursor-pointer"
                                                title={fw.download_url}
                                            >
                                                <ExternalLink size={12} /> {t('firmwareCenter.origin')}
                                            </a>
                                            )}
                                            {fw.source_code_url && (
                                                <a
                                                    href={fw.source_code_url}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (window.ipcRenderer) {
                                                            const mode = localStorage.getItem('lilygo_link_open_mode') || 'internal';
                                                            window.ipcRenderer.invoke('open-url', fw.source_code_url!, mode);
                                                        }
                                                    }}
                                                    className="inline-flex items-center gap-0.5 text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-primary transition-colors cursor-pointer"
                                                    title={fw.source_code_url}
                                                >
                                                    <Github size={12} /> {t('firmwareCenter.source_code')}
                                                </a>
                                            )}
                                            {fw.author_name && (
                                                <a
                                                    href={fw.author_link || '#'}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (fw.author_link && window.ipcRenderer) {
                                                            const mode = localStorage.getItem('lilygo_link_open_mode') || 'internal';
                                                            window.ipcRenderer.invoke('open-url', fw.author_link, mode);
                                                        }
                                                    }}
                                                    className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 transition-colors cursor-pointer"
                                                    title={[fw.author_email, fw.author_link].filter(Boolean).join(' · ')}
                                                >
                                                    <User size={12} /> {fw.author_name}
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action bar — admin buttons left, download/burn right */}
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 dark:border-zinc-700/50">
                                        <div className="flex items-center gap-2">
                                            {isAdmin && adminMode && fw.sha256 && (
                                              <>
                                                <button
                                                  onClick={() => handleDeleteFirmware(fw)}
                                                  disabled={adminBusy}
                                                  className="px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
                                                  title={t('firmwareCenter.confirm_delete', { name: fw.name })}
                                                >
                                                  <ServerCrash size={14} />
                                                  {t('firmwareCenter.delete_firmware')}
                                                </button>
                                                <button
                                                  onClick={() => handleStartEdit(fw)}
                                                  disabled={adminBusy}
                                                  className="px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
                                                  title={t('firmwareCenter.edit_firmware')}
                                                >
                                                  <Pencil size={14} />
                                                  {t('firmwareCenter.edit_firmware')}
                                                </button>
                                              </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isDownloading ? (
                                                <div className="flex flex-col items-center min-w-[120px]">
                                                    <div className="text-xs text-primary mb-1">{t('firmwareCenter.downloading')} {progress}%</div>
                                                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                                                    </div>
                                                </div>
                                            ) : isDownloaded ? (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleRemove(fw.download_url)}
                                                        className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                        title={t('firmwareCenter.remove_download')}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleSaveAs(fw.download_url)}
                                                        className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                        title={t('firmwareCenter.save_as')}
                                                    >
                                                        <Save size={18} />
                                                    </button>
                                                    {onNavigateToAnalyzer && task?.file && (
                                                        <button
                                                            onClick={() => onNavigateToAnalyzer(task.file!.path, task.file!.fileName)}
                                                            className="p-2 text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                            title={t('firmwareCenter.analyze')}
                                                        >
                                                            <Microscope size={18} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleBurnClick(fw.download_url)}
                                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
                                                    >
                                                        <Zap size={18} className="mr-2" />
                                                        {t('firmwareCenter.burn')}
                                                    </button>
                                                </div>
                                            ) : task?.error ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-red-500 max-w-[160px] truncate" title={task.error}>
                                                        {task.error}
                                                    </span>
                                                    <button
                                                        className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg flex items-center text-sm transition-all active:scale-95"
                                                        onClick={() => handleDownload(fw)}
                                                    >
                                                        {t('firmwareCenter.retry')}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg flex items-center shadow-lg shadow-primary/20 transition-all active:scale-95"
                                                    onClick={() => handleDownload(fw)}
                                                >
                                                    <Download size={18} className="mr-2" />
                                                    {t('firmwareCenter.download')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {fw.release_note && (
                                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-700/50 text-sm text-slate-600 dark:text-slate-400">
                                            <span className="text-slate-500 font-semibold mr-2">{t('firmwareCenter.note')}</span>
                                            {fw.release_note}
                                        </div>
                                    )}

                                    {/* Admin: Inline Edit Form */}
                                    {isAdmin && adminMode && editingFirmware?.sha256 === fw.sha256 && (
                                      <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800/50">
                                        <div className="flex items-center justify-between mb-3">
                                          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{t('firmwareCenter.editing')}</span>
                                          <button onClick={() => setEditingFirmware(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                            <X size={16} />
                                          </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {([
                                            ['name', 'field_name'],
                                            ['release_tag', 'field_version'],
                                            ['source', 'field_source'],
                                            ['source_code_url', 'field_source_code_url'],
                                            ['author_name', 'field_author_name'],
                                            ['author_link', 'field_author_link'],
                                            ['author_email', 'field_author_email'],
                                            ['firmware_type', 'field_firmware_type'],
                                            ['path', 'field_path'],
                                          ] as [string, string][]).map(([field, labelKey]) => (
                                            <div key={field}>
                                              <label className="text-xs text-slate-500 dark:text-slate-400">{t(`firmwareCenter.${labelKey}`)}</label>
                                              <input
                                                type="text"
                                                value={editingFirmware!.fields[field] || ''}
                                                onChange={(e) => setEditingFirmware(prev => prev ? {
                                                  ...prev,
                                                  fields: { ...prev.fields, [field]: e.target.value }
                                                } : null)}
                                                className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                                              />
                                            </div>
                                          ))}
                                          <div className="sm:col-span-2">
                                            <label className="text-xs text-slate-500 dark:text-slate-400">{t('firmwareCenter.field_description')}</label>
                                            <textarea
                                              value={editingFirmware!.fields.description || ''}
                                              onChange={(e) => setEditingFirmware(prev => prev ? {
                                                ...prev,
                                                fields: { ...prev.fields, description: e.target.value }
                                              } : null)}
                                              rows={2}
                                              className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                                            />
                                          </div>
                                        </div>
                                        <div className="flex justify-end gap-2 mt-3">
                                          <button
                                            onClick={() => setEditingFirmware(null)}
                                            className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                                          >
                                            {t('firmwareCenter.cancel')}
                                          </button>
                                          <button
                                            onClick={handleSaveEdit}
                                            disabled={adminBusy}
                                            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                                          >
                                            {adminBusy ? '...' : t('firmwareCenter.save')}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
          </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-slate-500">
                <RefreshCw size={48} className="mb-4 opacity-20" />
                <p>{t('firmwareCenter.select_device_hint')}</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default FirmwareCommunity;
