import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, X, Save, FolderPlus, ChevronDown, ChevronRight, Layers, Cpu, AlertTriangle } from 'lucide-react';

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
  id?: string;
  product_id?: string;
  name: string;
  description: string;
  image_url: string;
  products?: Product[];
  mcu?: string;
  github_repo?: string;
  product_page?: string;
}

interface ProductManagerProps {
  token: string;
  onClose: () => void;
}

async function getApiUrl(): Promise<string> {
  if (window.ipcRenderer) {
    return window.ipcRenderer.invoke('get-api-base-url');
  }
  throw new Error('Not in Electron environment');
}

const emptyProduct = { product_id: '', name: '', description: '', mcu: '', github_repo: '', product_page: '', image_url: '' };

const ProductManager: React.FC<ProductManagerProps> = ({ token, onClose }) => {
  const { t } = useTranslation();
  const [productList, setProductList] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Editing state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingGroup, setEditingGroup] = useState<{ id: string; name: string; description: string; image_url: string } | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [newGroupTarget, setNewGroupTarget] = useState<string | null>(null); // group_id to add product to

  // New group form
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroup, setNewGroup] = useState({ id: '', name: '', description: '', image_url: '' });

  // Expanded groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'product' | 'group'; id: string; name: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const apiUrl = await getApiUrl();
      const resp = await fetch(`${apiUrl}/products`, { headers });
      const data = await resp.json();
      if (data.success) {
        setProductList(data.product_list);
      } else {
        showToast(data.error || 'Failed to load', 'error');
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ---- Product CRUD ----

  const handleSaveProduct = async () => {
    if (!editingProduct || !editingProduct.product_id || !editingProduct.name) {
      showToast('Product ID and Name are required', 'error');
      return;
    }
    setBusy(true);
    try {
      const apiUrl = await getApiUrl();
      if (isNew) {
        const resp = await fetch(`${apiUrl}/products`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ group_id: newGroupTarget, product: editingProduct }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error);
        showToast('Product added');
      } else {
        const resp = await fetch(`${apiUrl}/products/${editingProduct.product_id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(editingProduct),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error);
        showToast('Product updated');
      }
      setEditingProduct(null);
      setIsNew(false);
      setNewGroupTarget(null);
      await loadProducts();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteProduct = async (product_id: string) => {
    setBusy(true);
    try {
      const apiUrl = await getApiUrl();
      const resp = await fetch(`${apiUrl}/products/${product_id}`, { method: 'DELETE', headers });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      showToast(data.firmware_warning ? `Deleted. Warning: ${data.firmware_warning}` : 'Product deleted');
      setConfirmDelete(null);
      await loadProducts();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  // ---- Group CRUD ----

  const handleCreateGroup = async () => {
    if (!newGroup.id || !newGroup.name) {
      showToast('Group ID and Name are required', 'error');
      return;
    }
    setBusy(true);
    try {
      const apiUrl = await getApiUrl();
      const resp = await fetch(`${apiUrl}/products/groups`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newGroup),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      showToast('Group created');
      setShowNewGroup(false);
      setNewGroup({ id: '', name: '', description: '', image_url: '' });
      await loadProducts();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveGroup = async () => {
    if (!editingGroup) return;
    setBusy(true);
    try {
      const apiUrl = await getApiUrl();
      const resp = await fetch(`${apiUrl}/products/groups/${editingGroup.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name: editingGroup.name, description: editingGroup.description, image_url: editingGroup.image_url }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      showToast('Group updated');
      setEditingGroup(null);
      await loadProducts();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    setBusy(true);
    try {
      const apiUrl = await getApiUrl();
      const resp = await fetch(`${apiUrl}/products/groups/${id}`, { method: 'DELETE', headers });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      showToast(`Group deleted${data.products_converted ? ` (${data.products_converted} products converted to standalone)` : ''}`);
      setConfirmDelete(null);
      await loadProducts();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-slate-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary";
  const labelClass = "text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700 w-[900px] max-w-[95vw] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-zinc-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Layers size={20} className="text-primary" />
            {t('productManager.title')}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowNewGroup(true); setEditingProduct(null); setEditingGroup(null); }} className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-zinc-600 hover:border-primary hover:text-primary rounded-lg transition-colors flex items-center gap-1">
              <FolderPlus size={14} />
              {t('productManager.new_group')}
            </button>
            <button onClick={() => { setEditingProduct({ ...emptyProduct }); setIsNew(true); setNewGroupTarget(null); setEditingGroup(null); setShowNewGroup(false); }} className="px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 rounded-lg transition-colors flex items-center gap-1">
              <Plus size={14} />
              {t('productManager.new_product')}
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`mx-5 mt-3 px-4 py-2 rounded-lg text-sm text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.message}
          </div>
        )}

        {/* Body: two columns */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left: Product/Group list */}
          <div className="w-[360px] border-r border-slate-200 dark:border-zinc-700 overflow-y-auto p-4 space-y-2">
            {loading ? (
              <div className="text-center py-8 text-slate-400">{t('productManager.loading')}</div>
            ) : productList.length === 0 ? (
              <div className="text-center py-8 text-slate-400">{t('productManager.empty')}</div>
            ) : (
              productList.map(group => {
                const isGroup = !!group.products && !!group.id;
                const isExpanded = group.id ? expandedGroups.has(group.id) : false;

                if (isGroup) {
                  return (
                    <div key={group.id} className="border border-slate-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                      {/* Group header */}
                      <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-zinc-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800" onClick={() => toggleGroup(group.id!)}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <Layers size={14} className="text-primary shrink-0" />
                        <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{group.name}</span>
                        <span className="text-xs text-slate-400">{group.products?.length || 0}</span>
                        <button onClick={e => { e.stopPropagation(); setEditingGroup({ id: group.id!, name: group.name, description: group.description, image_url: group.image_url }); setEditingProduct(null); setShowNewGroup(false); }}
                          className="p-1 text-slate-400 hover:text-blue-500 rounded transition-colors">
                          <Pencil size={12} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); setConfirmDelete({ type: 'group', id: group.id!, name: group.name }); }}
                          className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors">
                          <Trash2 size={12} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); setEditingProduct({ ...emptyProduct }); setIsNew(true); setNewGroupTarget(group.id!); setEditingGroup(null); setShowNewGroup(false); }}
                          className="p-1 text-slate-400 hover:text-primary rounded transition-colors" title={t('productManager.add_to_group')}>
                          <Plus size={12} />
                        </button>
                      </div>
                      {/* Group products */}
                      {isExpanded && group.products?.map(product => (
                        <div key={product.product_id}
                          className={`flex items-center gap-2 px-4 py-2 border-t border-slate-100 dark:border-zinc-700/50 hover:bg-slate-50 dark:hover:bg-zinc-800/30 cursor-pointer ${editingProduct?.product_id === product.product_id && !isNew ? 'bg-primary/5' : ''}`}
                          onClick={() => { setEditingProduct({ ...product }); setIsNew(false); setEditingGroup(null); setShowNewGroup(false); }}
                        >
                          <Cpu size={12} className="text-slate-400 shrink-0" />
                          <span className="flex-1 text-sm text-slate-600 dark:text-slate-400 truncate">{product.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{product.mcu}</span>
                          <button onClick={e => { e.stopPropagation(); setConfirmDelete({ type: 'product', id: product.product_id, name: product.name }); }}
                            className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                }

                // Standalone product
                return (
                  <div key={group.product_id}
                    className={`flex items-center gap-2 p-3 border border-slate-200 dark:border-zinc-700 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800/30 cursor-pointer ${editingProduct?.product_id === group.product_id && !isNew ? 'bg-primary/5 border-primary/30' : ''}`}
                    onClick={() => { setEditingProduct({ product_id: group.product_id!, name: group.name, description: group.description, mcu: group.mcu || '', github_repo: group.github_repo || '', product_page: group.product_page || '', image_url: group.image_url }); setIsNew(false); setEditingGroup(null); setShowNewGroup(false); }}
                  >
                    <Cpu size={14} className="text-slate-400 shrink-0" />
                    <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{group.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{group.mcu}</span>
                    <button onClick={e => { e.stopPropagation(); setConfirmDelete({ type: 'product', id: group.product_id!, name: group.name }); }}
                      className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Edit form */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* New Group Form */}
            {showNewGroup && (
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <FolderPlus size={16} className="text-primary" />
                  {t('productManager.new_group')}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Group ID *</label>
                    <input className={inputClass} value={newGroup.id} onChange={e => setNewGroup(prev => ({ ...prev, id: e.target.value }))} placeholder="e.g. t-display-series" />
                  </div>
                  <div>
                    <label className={labelClass}>Name *</label>
                    <input className={inputClass} value={newGroup.name} onChange={e => setNewGroup(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. T-Display Series" />
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Description</label>
                    <input className={inputClass} value={newGroup.description} onChange={e => setNewGroup(prev => ({ ...prev, description: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Image URL</label>
                    <input className={inputClass} value={newGroup.image_url} onChange={e => setNewGroup(prev => ({ ...prev, image_url: e.target.value }))} placeholder="/devices/series.jpg" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowNewGroup(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                    {t('productManager.cancel')}
                  </button>
                  <button onClick={handleCreateGroup} disabled={busy} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-1">
                    <Save size={14} />
                    {t('productManager.create')}
                  </button>
                </div>
              </div>
            )}

            {/* Edit Group Form */}
            {editingGroup && (
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Pencil size={16} className="text-blue-500" />
                  {t('productManager.edit_group')}: {editingGroup.id}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelClass}>Name</label>
                    <input className={inputClass} value={editingGroup.name} onChange={e => setEditingGroup(prev => prev ? { ...prev, name: e.target.value } : null)} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Description</label>
                    <input className={inputClass} value={editingGroup.description} onChange={e => setEditingGroup(prev => prev ? { ...prev, description: e.target.value } : null)} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Image URL</label>
                    <input className={inputClass} value={editingGroup.image_url} onChange={e => setEditingGroup(prev => prev ? { ...prev, image_url: e.target.value } : null)} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingGroup(null)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                    {t('productManager.cancel')}
                  </button>
                  <button onClick={handleSaveGroup} disabled={busy} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-1">
                    <Save size={14} />
                    {t('productManager.save')}
                  </button>
                </div>
              </div>
            )}

            {/* Edit/New Product Form */}
            {editingProduct && (
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  {isNew ? <Plus size={16} className="text-primary" /> : <Pencil size={16} className="text-blue-500" />}
                  {isNew ? t('productManager.new_product') : `${t('productManager.edit_product')}: ${editingProduct.product_id}`}
                  {isNew && newGroupTarget && <span className="text-xs text-slate-400 font-normal ml-1">→ {newGroupTarget}</span>}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Product ID *</label>
                    <input className={inputClass} value={editingProduct.product_id} disabled={!isNew}
                      onChange={e => setEditingProduct(prev => prev ? { ...prev, product_id: e.target.value } : null)}
                      placeholder="e.g. T-Display-S3" />
                  </div>
                  <div>
                    <label className={labelClass}>Name *</label>
                    <input className={inputClass} value={editingProduct.name}
                      onChange={e => setEditingProduct(prev => prev ? { ...prev, name: e.target.value } : null)}
                      placeholder="e.g. T-Display S3" />
                  </div>
                  <div>
                    <label className={labelClass}>MCU</label>
                    <input className={inputClass} value={editingProduct.mcu}
                      onChange={e => setEditingProduct(prev => prev ? { ...prev, mcu: e.target.value } : null)}
                      placeholder="e.g. ESP32-S3" />
                  </div>
                  <div>
                    <label className={labelClass}>Image URL</label>
                    <input className={inputClass} value={editingProduct.image_url}
                      onChange={e => setEditingProduct(prev => prev ? { ...prev, image_url: e.target.value } : null)}
                      placeholder="/devices/t-display-s3.jpg" />
                  </div>
                  <div>
                    <label className={labelClass}>GitHub Repo</label>
                    <input className={inputClass} value={editingProduct.github_repo}
                      onChange={e => setEditingProduct(prev => prev ? { ...prev, github_repo: e.target.value } : null)}
                      placeholder="https://github.com/..." />
                  </div>
                  <div>
                    <label className={labelClass}>Product Page</label>
                    <input className={inputClass} value={editingProduct.product_page}
                      onChange={e => setEditingProduct(prev => prev ? { ...prev, product_page: e.target.value } : null)}
                      placeholder="https://lilygo.cc/..." />
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Description</label>
                    <textarea className={inputClass + " resize-none"} rows={3} value={editingProduct.description}
                      onChange={e => setEditingProduct(prev => prev ? { ...prev, description: e.target.value } : null)} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setEditingProduct(null); setIsNew(false); setNewGroupTarget(null); }} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                    {t('productManager.cancel')}
                  </button>
                  <button onClick={handleSaveProduct} disabled={busy} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-1">
                    <Save size={14} />
                    {isNew ? t('productManager.create') : t('productManager.save')}
                  </button>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!editingProduct && !editingGroup && !showNewGroup && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Layers size={48} className="mb-4 opacity-20" />
                <p className="text-sm">{t('productManager.select_hint')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Confirm Delete Dialog */}
        {confirmDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setConfirmDelete(null)}>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-slate-200 dark:border-zinc-700 p-6 w-[400px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle size={24} className="text-red-500" />
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{t('productManager.confirm_delete')}</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                {t('productManager.confirm_delete_message', { name: confirmDelete.name })}
                {confirmDelete.type === 'group' && (
                  <span className="block mt-2 text-amber-600 dark:text-amber-400">
                    {t('productManager.group_delete_warning')}
                  </span>
                )}
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                  {t('productManager.cancel')}
                </button>
                <button
                  onClick={() => {
                    if (confirmDelete.type === 'product') handleDeleteProduct(confirmDelete.id);
                    else handleDeleteGroup(confirmDelete.id);
                  }}
                  disabled={busy}
                  className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {t('productManager.delete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductManager;
