import React, { useState, useEffect, useMemo } from 'react';
import { Upload, FileUp, CheckCircle, AlertCircle, Loader2, Search, X, Shield, Clock, ThumbsUp, ThumbsDown, ChevronDown, Tag, Share2, Ban, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import FullWindowDropZone from './FullWindowDropZone';
import ShareCodeModal from './ShareCodeModal';
import { SeriesApi } from './series/api';
import type { FirmwareSeries } from './series/types';

interface FirmwareUploadProps {
  token: string | null;
  isAdmin: boolean;
  userEmail?: string;
}

interface ProductOption {
  product_id: string;
  name: string;
  mcu: string;
  series_name?: string;
}

interface UploadRecord {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  uploader: { login: string; avatar_url: string; name: string; email: string | null };
  firmware: {
    name: string;
    product_id: string;
    description: string;
    filename: string;
    size: number;
    compressed_size: number;
    md5: string;
    sha256: string;
    oss_url: string;
    release_tag: string | null;
    source: string;
    source_code_url: string;
    author_name: string;
    firmware_type: string[];
  };
  uploaded_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reject_reason: string | null;
}

const SOURCE_OPTIONS = ['REPO', 'RELEASE', 'COMMUNITY', 'CUSTOM'] as const;
const TYPE_OPTIONS = ['factory', 'community', 'tool', 'experiment', 'beta', 'stable'] as const;

async function getApiUrl(): Promise<string> {
  if (window.ipcRenderer) {
    return window.ipcRenderer.invoke('get-api-base-url');
  }
  throw new Error('Not in Electron environment');
}

const FirmwareUpload: React.FC<FirmwareUploadProps> = ({ token, isAdmin, userEmail }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'upload' | 'my_uploads' | 'review'>('upload');

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [productIds, setProductIds] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [releaseTag, setReleaseTag] = useState('');
  const [releaseName, setReleaseName] = useState('');
  const [source, setSource] = useState<string>('COMMUNITY');
  const [sourceCodeUrl, setSourceCodeUrl] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorLink, setAuthorLink] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [firmwareTypes, setFirmwareTypes] = useState<string[]>(['community']);
  const [flashPath, setFlashPath] = useState('0x0');
  const [allSeries, setAllSeries] = useState<FirmwareSeries[]>([]);
  const [seriesIds, setSeriesIds] = useState<string[]>([]);

  // Product search
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);

  // Review/My uploads
  const [pendingUploads, setPendingUploads] = useState<UploadRecord[]>([]);
  const [myUploads, setMyUploads] = useState<UploadRecord[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // Share code modal
  const [shareModalData, setShareModalData] = useState<{ code: string; name: string } | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Review history (admin only, paginated)
  const [historyItems, setHistoryItems] = useState<UploadRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const HISTORY_PER_PAGE = 10;

  // Load products from manifest (via IPC, same as FirmwareCommunity)
  useEffect(() => {
    (async () => {
      try {
        let manifest: any;
        if (window.ipcRenderer) {
          manifest = await window.ipcRenderer.invoke('get-firmware-manifest');
        } else {
          const resp = await fetch('https://lilygo.oss-accelerate.aliyuncs.com/firmware_manifest.json');
          manifest = await resp.json();
        }
        const prods: ProductOption[] = [];
        if (manifest.product_list) {
          for (const group of manifest.product_list) {
            if (group.products) {
              for (const p of group.products) {
                prods.push({ product_id: p.product_id, name: p.name, mcu: p.mcu || '', series_name: group.name });
              }
            } else if (group.product_id) {
              prods.push({ product_id: group.product_id, name: group.name, mcu: group.mcu || '' });
            }
          }
        }
        console.log(`[Upload] Loaded ${prods.length} products from manifest`);
        setProducts(prods);
      } catch (e) {
        console.error('Failed to load products:', e);
      }
    })();
  }, []);

  // Load series (for optional series_ids selection)
  useEffect(() => {
    (async () => {
      try {
        const list = await SeriesApi.list();
        setAllSeries(list);
      } catch (e) {
        console.error('Failed to load series:', e);
      }
    })();
  }, []);

  const eligibleSeries = useMemo(() => {
    if (isAdmin) return allSeries;
    if (!userEmail) return [];
    return allSeries.filter(s => s.admin_emails.includes(userEmail));
  }, [allSeries, isAdmin, userEmail]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const q = productSearch.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.product_id.toLowerCase().includes(q) ||
      p.mcu.toLowerCase().includes(q) ||
      (p.series_name && p.series_name.toLowerCase().includes(q))
    );
  }, [products, productSearch]);

  const selectedProducts = products.filter(p => productIds.includes(p.product_id));

  const toggleProduct = (pid: string) => {
    setProductIds(prev =>
      prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
    );
  };

  // Toggle firmware type tag
  const toggleType = (type: string) => {
    setFirmwareTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) applyFile(e.target.files[0]);
  };

  const applyFile = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.bin')) {
      setUploadStatus('error');
      setUploadMessage('Only .bin files are allowed');
      setFile(null);
      return;
    }
    setFile(selectedFile);
    setUploadStatus('idle');
    setUploadMessage('');
    // Auto-fill name from filename if empty
    if (!name) {
      const baseName = selectedFile.name.replace(/\.bin$/i, '').replace(/[_-]/g, ' ');
      setName(baseName);
    }
  };

  const handleDrop = (files: FileList) => {
    const f = Array.from(files).find(x => x.name.toLowerCase().endsWith('.bin'));
    if (f) applyFile(f);
  };

  const handleUpload = async () => {
    if (!file || !token || !name || productIds.length === 0) return;

    setUploading(true);
    setUploadStatus('idle');
    setUploadMessage('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    formData.append('product_id', productIds.join(','));
    formData.append('description', description);
    if (releaseTag) formData.append('release_tag', releaseTag);
    if (releaseName) formData.append('release_name', releaseName);
    formData.append('source', source);
    if (sourceCodeUrl) formData.append('source_code_url', sourceCodeUrl);
    if (githubRepo) formData.append('github_repo', githubRepo);
    if (authorName) formData.append('author_name', authorName);
    if (authorLink) formData.append('author_link', authorLink);
    if (authorEmail) formData.append('author_email', authorEmail);
    formData.append('firmware_type', firmwareTypes.join(','));
    formData.append('flash_path', flashPath);
    if (seriesIds.length > 0) {
      formData.append('series_ids', seriesIds.join(','));
    }

    try {
      const apiUrl = await getApiUrl();
      const resp = await fetch(`${apiUrl}/upload/firmware`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await resp.json();

      if (resp.ok && data.success) {
        setUploadStatus('success');
        setUploadMessage(data.message || 'Upload successful!');
        // Reset form
        setFile(null);
        setName('');
        setProductIds([]);
        setDescription('');
        setReleaseTag('');
        setReleaseName('');
        setSeriesIds([]);
      } else {
        setUploadStatus('error');
        setUploadMessage(data.error || 'Upload failed');
      }
    } catch (error: any) {
      setUploadStatus('error');
      setUploadMessage(error.message || 'Network error');
    } finally {
      setUploading(false);
    }
  };

  // Load pending uploads (admin)
  const loadPending = async () => {
    if (!token) return;
    setReviewLoading(true);
    try {
      const apiUrl = await getApiUrl();
      const resp = await fetch(`${apiUrl}/upload/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setPendingUploads(data.items || []);
      }
    } catch (e) {
      console.error('Failed to load pending:', e);
    } finally {
      setReviewLoading(false);
    }
  };

  // Load my uploads
  const loadMyUploads = async () => {
    if (!token) return;
    setReviewLoading(true);
    try {
      const apiUrl = await getApiUrl();
      const resp = await fetch(`${apiUrl}/upload/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setMyUploads(data.items || []);
      }
    } catch (e) {
      console.error('Failed to load my uploads:', e);
    } finally {
      setReviewLoading(false);
    }
  };

  // Load review history (admin)
  const loadHistory = async (page: number) => {
    if (!token) return;
    setHistoryLoading(true);
    try {
      const apiUrl = await getApiUrl();
      const resp = await fetch(`${apiUrl}/upload/history?page=${page}&per_page=${HISTORY_PER_PAGE}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setHistoryItems(data.items || []);
        setHistoryPage(data.page || 1);
        setHistoryTotalPages(data.total_pages || 1);
        setHistoryTotal(data.total || 0);
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'review' && isAdmin) {
      loadPending();
      loadHistory(1);
    }
    if (activeTab === 'my_uploads') loadMyUploads();
  }, [activeTab, isAdmin]);

  // Review action
  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    if (!token) return;
    setReviewingId(id);
    try {
      const apiUrl = await getApiUrl();
      const resp = await fetch(`${apiUrl}/upload/${id}/review`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, reason: action === 'reject' ? rejectReason : undefined }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setRejectReason('');
        alert(action === 'approve' ? t('upload.approve_success') : t('upload.reject_success'));
        loadPending();
        loadHistory(1);
      } else {
        alert(data.error || 'Review failed');
      }
    } catch (e) {
      console.error('Review failed:', e);
      alert('Review request failed');
    } finally {
      setReviewingId(null);
    }
  };

  // Cancel pending upload
  const handleCancel = async (id: string) => {
    if (!token) return;
    if (!confirm(t('share.cancel_confirm'))) return;

    setCancellingId(id);
    try {
      const apiUrl = await getApiUrl();
      const resp = await fetch(`${apiUrl}/upload/${id}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        alert(t('share.cancel_success'));
        loadMyUploads();
      } else {
        alert(data.error || 'Cancel failed');
      }
    } catch (e) {
      console.error('Cancel failed:', e);
      alert('Cancel request failed');
    } finally {
      setCancellingId(null);
    }
  };

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
        <AlertCircle size={48} className="mb-4" />
        <p>{t('upload.login_required')}</p>
      </div>
    );
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      approved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
    };
    const icons: Record<string, React.ReactNode> = {
      pending: <Clock size={12} />,
      approved: <CheckCircle size={12} />,
      rejected: <X size={12} />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[status] || ''}`}>
        {icons[status]} {status}
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <FullWindowDropZone active={!uploading && activeTab === 'upload'} accept=".bin" onDrop={handleDrop} hintKey="common.drop_firmware" />

      {/* Tab Bar */}
      <div className="flex border-b border-slate-200 dark:border-zinc-700 px-6 pt-4 shrink-0">
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'upload'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Upload size={14} className="inline mr-1.5 -mt-0.5" />
          {t('upload.tab_upload')}
        </button>
        <button
          onClick={() => setActiveTab('my_uploads')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'my_uploads'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <FileUp size={14} className="inline mr-1.5 -mt-0.5" />
          {t('upload.tab_my_uploads')}
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('review')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'review'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Shield size={14} className="inline mr-1.5 -mt-0.5" />
            {t('upload.tab_admin_review')}
            {pendingUploads.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {pendingUploads.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {/* === UPLOAD TAB === */}
        {activeTab === 'upload' && (
          <div className="p-6 max-w-3xl mx-auto space-y-5">
            {/* File Picker */}
            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1.5 text-sm font-medium">
                {t('upload.firmware_file')} <span className="text-red-400">*</span>
              </label>
              <div className="relative group">
                <input type="file" accept=".bin" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={uploading} />
                <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  file ? 'border-primary/50 bg-primary/5' : 'border-slate-300 dark:border-zinc-600 hover:border-slate-400 dark:hover:border-zinc-500'
                }`}>
                  {file ? (
                    <div className="flex items-center justify-center gap-2 text-primary">
                      <FileUp size={20} />
                      <span className="font-medium">{file.name}</span>
                      <span className="text-xs text-slate-500">({formatSize(file.size)})</span>
                    </div>
                  ) : (
                    <div className="text-slate-500">
                      <Upload size={28} className="mx-auto mb-1.5 opacity-50" />
                      <p className="text-sm">{t('upload.click_or_drag')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Two columns for basic info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Firmware Name */}
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1.5 text-sm font-medium">
                  {t('upload.firmware_name')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('upload.firmware_name_placeholder')}
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Product Multi-Select */}
              <div className="relative">
                <label className="block text-slate-600 dark:text-slate-400 mb-1.5 text-sm font-medium">
                  {t('upload.target_product')} <span className="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setProductDropdownOpen(!productDropdownOpen)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[38px]"
                >
                  <span className={selectedProducts.length > 0 ? 'text-slate-900 dark:text-white truncate' : 'text-slate-400'}>
                    {selectedProducts.length > 0
                      ? selectedProducts.length === 1
                        ? `${selectedProducts[0].name} (${selectedProducts[0].mcu})`
                        : `${selectedProducts.length} products selected`
                      : t('upload.select_product')}
                  </span>
                  <ChevronDown size={14} className="text-slate-400 shrink-0" />
                </button>
                {productDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl max-h-72 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-slate-200 dark:border-zinc-700">
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={productSearch}
                          onChange={e => setProductSearch(e.target.value)}
                          placeholder={t('upload.search_products')}
                          className="w-full pl-8 pr-3 py-1.5 rounded bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="overflow-auto max-h-56">
                      {filteredProducts.map(p => {
                        const checked = productIds.includes(p.product_id);
                        return (
                          <button
                            key={p.product_id}
                            type="button"
                            onClick={() => toggleProduct(p.product_id)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors flex items-center gap-2 ${
                              checked ? 'bg-primary/10' : ''
                            }`}
                          >
                            <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              checked ? 'bg-primary border-primary text-white' : 'border-slate-300 dark:border-zinc-600'
                            }`}>
                              {checked && <CheckCircle size={12} />}
                            </span>
                            <div className="min-w-0">
                              <div className={`font-medium ${checked ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}>{p.name}</div>
                              <div className="text-xs text-slate-400">{p.mcu}{p.series_name ? ` · ${p.series_name}` : ''}</div>
                            </div>
                          </button>
                        );
                      })}
                      {filteredProducts.length === 0 && (
                        <div className="px-3 py-4 text-sm text-slate-400 text-center">{t('upload.no_products_found')}</div>
                      )}
                    </div>
                    {productIds.length > 0 && (
                      <div className="p-2 border-t border-slate-200 dark:border-zinc-700 flex items-center justify-between">
                        <span className="text-xs text-slate-500">{productIds.length} selected</span>
                        <button
                          type="button"
                          onClick={() => { setProductIds([]); }}
                          className="text-xs text-red-400 hover:text-red-500"
                        >
                          Clear all
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Products Tags */}
            {selectedProducts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedProducts.map(p => (
                  <span
                    key={p.product_id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium border border-primary/20"
                  >
                    {p.name}
                    <button type="button" onClick={() => toggleProduct(p.product_id)} className="hover:text-red-400">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1.5 text-sm font-medium">{t('upload.description')}</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t('upload.description_placeholder')}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>

            {/* Source Type (segmented) */}
            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1.5 text-sm font-medium">{t('upload.source_type')}</label>
              <div className="flex flex-wrap gap-2">
                {SOURCE_OPTIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSource(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      source === s
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 border-slate-200 dark:border-zinc-700 hover:border-slate-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Series selection — only shown if the user can manage at least one series */}
            {eligibleSeries.length > 0 && (
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1.5 text-sm font-medium">{t('series.attach_to_series')}</label>
                <div className="flex flex-wrap gap-2">
                  {eligibleSeries.map(s => {
                    const checked = seriesIds.includes(s.id);
                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => setSeriesIds(prev => checked ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                          checked
                            ? 'bg-primary/10 text-primary border-primary/40 ring-1 ring-primary/30'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-zinc-700 hover:text-primary hover:border-primary/40'
                        }`}
                      >
                        {checked ? '✓ ' : ''}{s.name}
                      </button>
                    );
                  })}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{t('series.attach_hint')}</div>
              </div>
            )}

            {/* Firmware Type Tags */}
            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1.5 text-sm font-medium">
                <Tag size={12} className="inline mr-1 -mt-0.5" />
                {t('upload.firmware_tags')}
              </label>
              <div className="flex flex-wrap gap-2">
                {TYPE_OPTIONS.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      firmwareTypes.includes(t)
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 border-slate-200 dark:border-zinc-700 hover:border-slate-300'
                    }`}
                  >
                    {firmwareTypes.includes(t) && <CheckCircle size={10} className="inline mr-1 -mt-0.5" />}
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Version fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1.5 text-sm font-medium">{t('upload.version_tag')}</label>
                <input type="text" value={releaseTag} onChange={e => setReleaseTag(e.target.value)} placeholder="v1.0.0"
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1.5 text-sm font-medium">{t('upload.release_name')}</label>
                <input type="text" value={releaseName} onChange={e => setReleaseName(e.target.value)} placeholder="Initial Release"
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1.5 text-sm font-medium">{t('upload.flash_address')}</label>
                <input type="text" value={flashPath} onChange={e => setFlashPath(e.target.value)} placeholder="0x0"
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            </div>

            {/* Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1.5 text-sm font-medium">{t('upload.source_code_url')}</label>
                <input type="url" value={sourceCodeUrl} onChange={e => setSourceCodeUrl(e.target.value)} placeholder="https://github.com/..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1.5 text-sm font-medium">{t('upload.github_repo')}</label>
                <input type="url" value={githubRepo} onChange={e => setGithubRepo(e.target.value)} placeholder="https://github.com/..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            </div>

            {/* Author */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1.5 text-sm font-medium">{t('upload.author_name')}</label>
                <input type="text" value={authorName} onChange={e => setAuthorName(e.target.value)} placeholder="Your name"
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1.5 text-sm font-medium">{t('upload.author_url')}</label>
                <input type="url" value={authorLink} onChange={e => setAuthorLink(e.target.value)} placeholder="https://github.com/username"
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1.5 text-sm font-medium">{t('upload.author_email')}</label>
                <input type="email" value={authorEmail} onChange={e => setAuthorEmail(e.target.value)} placeholder="email@example.com"
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            </div>

            {/* Status messages */}
            {uploadStatus === 'error' && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-2 text-sm">
                <AlertCircle size={16} /> {uploadMessage}
              </div>
            )}
            {uploadStatus === 'success' && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 flex items-center gap-2 text-sm">
                <CheckCircle size={16} /> {uploadMessage}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleUpload}
              disabled={!file || !name || productIds.length === 0 || uploading}
              className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                !file || !name || productIds.length === 0 || uploading
                  ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/20'
              }`}
            >
              {uploading ? (
                <><Loader2 size={20} className="animate-spin" /> {t('upload.uploading')}</>
              ) : (
                <><Upload size={20} /> {isAdmin ? t('upload.upload_and_publish') : t('upload.upload_for_review')}</>
              )}
            </button>

            {!isAdmin && (
              <p className="text-xs text-slate-400 text-center">
                {t('upload.review_hint')}
              </p>
            )}
          </div>
        )}

        {/* === MY UPLOADS TAB === */}
        {activeTab === 'my_uploads' && (
          <div className="p-6 max-w-3xl mx-auto">
            {reviewLoading ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
            ) : myUploads.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FileUp size={40} className="mx-auto mb-3 opacity-50" />
                <p>{t('upload.no_uploads_yet')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myUploads.map(u => (
                  <div key={u.id} className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-900 dark:text-white text-sm">{u.firmware.name}</span>
                          {statusBadge(u.status)}
                        </div>
                        <div className="text-xs text-slate-500 space-y-0.5">
                          <p>{u.firmware.filename} · {formatSize(u.firmware.size)}</p>
                          <p>Product: {u.firmware.product_id} · Uploaded: {new Date(u.uploaded_at).toLocaleString()}</p>
                          {u.status === 'rejected' && u.reject_reason && (
                            <p className="text-red-400 mt-1">Reason: {u.reject_reason}</p>
                          )}
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Share button - available for all statuses */}
                        <button
                          onClick={() => setShareModalData({ code: u.firmware.sha256.slice(0, 8), name: u.firmware.name })}
                          className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium flex items-center gap-1.5 border border-primary/20 transition-colors"
                        >
                          <Share2 size={12} /> {t('share.share')}
                        </button>
                        {/* Cancel review - only for pending */}
                        {u.status === 'pending' && (
                          <button
                            onClick={() => handleCancel(u.id)}
                            disabled={cancellingId === u.id}
                            className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-medium flex items-center gap-1.5 border border-red-500/20 transition-colors disabled:opacity-50"
                          >
                            {cancellingId === u.id ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}
                            {t('share.cancel_review')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === ADMIN REVIEW TAB === */}
        {activeTab === 'review' && isAdmin && (
          <div className="p-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield size={18} className="text-primary" />
                {t('upload.pending_review')}
              </h3>
              <button onClick={loadPending} className="text-xs text-primary hover:underline">{t('upload.refresh')}</button>
            </div>

            {reviewLoading ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
            ) : pendingUploads.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <CheckCircle size={40} className="mx-auto mb-3 opacity-50" />
                <p>{t('upload.no_pending')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingUploads.map(u => (
                  <div key={u.id} className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
                    {/* Uploader info */}
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200 dark:border-zinc-700">
                      {u.uploader.avatar_url && (
                        <img src={u.uploader.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                      )}
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{u.uploader.login}</span>
                      <span className="text-xs text-slate-400">· {new Date(u.uploaded_at).toLocaleString()}</span>
                    </div>

                    {/* Firmware info */}
                    <div className="space-y-1 mb-3">
                      <div className="font-medium text-slate-900 dark:text-white text-sm">{u.firmware.name}</div>
                      <div className="text-xs text-slate-500 space-y-0.5">
                        <p>File: {u.firmware.filename} · {formatSize(u.firmware.size)} → {formatSize(u.firmware.compressed_size)} ZIP</p>
                        <p>Product: {u.firmware.product_id} · Source: {u.firmware.source}</p>
                        <p>Author: {u.firmware.author_name} · Tags: {u.firmware.firmware_type?.join(', ') || '-'}</p>
                        {u.firmware.release_tag && <p>Version: {u.firmware.release_tag}</p>}
                        {u.firmware.description && (
                          <p className="text-slate-600 dark:text-slate-400 mt-1">{u.firmware.description}</p>
                        )}
                        <p className="font-mono text-[10px] text-slate-400 mt-1">
                          MD5: {u.firmware.md5}<br />SHA256: {u.firmware.sha256}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReview(u.id, 'approve')}
                        disabled={reviewingId === u.id}
                        className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        {reviewingId === u.id ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                        {t('upload.approve')}
                      </button>
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          placeholder={t('upload.reject_reason_placeholder')}
                          className="flex-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
                        />
                        <button
                          onClick={() => handleReview(u.id, 'reject')}
                          disabled={reviewingId === u.id}
                          className="px-4 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm font-medium flex items-center gap-1.5 border border-red-500/20 transition-colors disabled:opacity-50"
                        >
                          <ThumbsDown size={14} /> {t('upload.reject')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Review History (read-only, paginated) */}
            <div className="mt-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <History size={18} className="text-primary" />
                  {t('upload.review_history')}
                  {historyTotal > 0 && (
                    <span className="text-xs font-normal text-slate-400">
                      · {t('upload.total_records', { count: historyTotal })}
                    </span>
                  )}
                </h3>
                <button onClick={() => loadHistory(historyPage)} className="text-xs text-primary hover:underline">{t('upload.refresh')}</button>
              </div>

              {historyLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
              ) : historyItems.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  <History size={32} className="mx-auto mb-2 opacity-50" />
                  <p>{t('upload.no_history')}</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {historyItems.map(u => (
                      <div key={u.id} className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-medium text-slate-900 dark:text-white text-sm">{u.firmware.name}</span>
                              {statusBadge(u.status)}
                            </div>
                            <div className="text-xs text-slate-500 space-y-0.5">
                              <p>
                                {u.firmware.filename} · {formatSize(u.firmware.size)} · {u.firmware.product_id}
                              </p>
                              <p className="flex items-center gap-1 flex-wrap">
                                {u.uploader.avatar_url && (
                                  <img src={u.uploader.avatar_url} alt="" className="w-4 h-4 rounded-full inline-block" />
                                )}
                                <span>{u.uploader.login}</span>
                                <span className="text-slate-400">· {new Date(u.uploaded_at).toLocaleString()}</span>
                              </p>
                              <p>
                                <span className="text-slate-400">{t('upload.reviewed_by')}:</span> {u.reviewed_by || '-'}
                                {u.reviewed_at && (
                                  <span className="text-slate-400"> · {t('upload.reviewed_at')}: {new Date(u.reviewed_at).toLocaleString()}</span>
                                )}
                              </p>
                              {u.status === 'rejected' && u.reject_reason && (
                                <p className="text-red-400">Reason: {u.reject_reason}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {historyTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-4">
                      <button
                        onClick={() => loadHistory(historyPage - 1)}
                        disabled={historyPage <= 1 || historyLoading}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary/30"
                      >
                        <ChevronLeft size={12} /> {t('upload.prev_page')}
                      </button>
                      <span className="text-xs text-slate-500">
                        {t('upload.page_info', { page: historyPage, total: historyTotalPages })}
                      </span>
                      <button
                        onClick={() => loadHistory(historyPage + 1)}
                        disabled={historyPage >= historyTotalPages || historyLoading}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary/30"
                      >
                        {t('upload.next_page')} <ChevronRight size={12} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Share Code Modal */}
      {shareModalData && (
        <ShareCodeModal
          shareCode={shareModalData.code}
          firmwareName={shareModalData.name}
          onClose={() => setShareModalData(null)}
        />
      )}
    </div>
  );
};

export default FirmwareUpload;
