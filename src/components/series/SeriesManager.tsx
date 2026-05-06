import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Plus, Trash2, X, Save, Loader2, ChevronRight } from 'lucide-react';
import { FirmwareSeries } from './types';
import { SeriesApi } from './api';

interface SeriesManagerProps {
  token: string;
  onClose: () => void;
  onChanged?: () => void;
}

interface EditState {
  mode: 'create' | 'edit';
  id: string;
  name: string;
  description: string;
  homepage: string;
  icon: string;
  tags: string;
  admin_emails: string;
  order: string;
}

const emptyEdit = (): EditState => ({
  mode: 'create',
  id: '',
  name: '',
  description: '',
  homepage: '',
  icon: '',
  tags: '',
  admin_emails: '',
  order: '',
});

function fromSeries(s: FirmwareSeries): EditState {
  return {
    mode: 'edit',
    id: s.id,
    name: s.name,
    description: s.description || '',
    homepage: s.homepage || '',
    icon: s.icon || '',
    tags: (s.tags || []).join(', '),
    admin_emails: (s.admin_emails || []).join('\n'),
    order: s.order != null ? String(s.order) : '',
  };
}

const SeriesManager: React.FC<SeriesManagerProps> = ({ token, onClose, onChanged }) => {
  const { t } = useTranslation();
  const [list, setList] = useState<FirmwareSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await SeriesApi.list();
      setList(data);
    } catch {
      setErr(t('series.error_load'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const sorted = useMemo(() => {
    return [...list].sort((a, b) => {
      const oa = a.order ?? 1000;
      const ob = b.order ?? 1000;
      if (oa !== ob) return oa - ob;
      return a.id.localeCompare(b.id);
    });
  }, [list]);

  const startCreate = () => {
    setEdit(emptyEdit());
    setErr(null);
  };

  const startEdit = (s: FirmwareSeries) => {
    setEdit(fromSeries(s));
    setErr(null);
  };

  const handleDelete = async (s: FirmwareSeries) => {
    if (!window.confirm(t('series.delete_confirm', { name: s.name }))) return;
    const r = await SeriesApi.remove(token, s.id);
    if (!r.ok) {
      setErr(t('series.error_delete'));
      return;
    }
    await reload();
    onChanged?.();
  };

  const handleSave = async () => {
    if (!edit) return;
    setSaving(true);
    setErr(null);

    const body: Partial<FirmwareSeries> = {
      name: edit.name.trim(),
      description: edit.description.trim(),
      homepage: edit.homepage.trim() || undefined,
      icon: edit.icon.trim() || undefined,
      tags: edit.tags
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      admin_emails: edit.admin_emails
        .split(/\s+|\n/)
        .map(s => s.trim())
        .filter(Boolean),
    };
    if (edit.order.trim() !== '') {
      const n = Number(edit.order);
      if (!Number.isNaN(n)) body.order = n;
    }

    try {
      if (edit.mode === 'create') {
        const id = edit.id.trim().toLowerCase();
        if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(id)) {
          setErr(t('series.id_hint'));
          setSaving(false);
          return;
        }
        const r = await SeriesApi.create(token, { id, ...body });
        if (!r.ok) {
          setErr(r.error || t('series.error_save'));
          setSaving(false);
          return;
        }
      } else {
        const r = await SeriesApi.update(token, edit.id, body);
        if (!r.ok) {
          setErr(r.error || t('series.error_save'));
          setSaving(false);
          return;
        }
      }
      setEdit(null);
      await reload();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700 w-[820px] max-w-[94vw] max-h-[86vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-700">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
            <Layers size={18} className="text-primary" />
            <span>{t('series.manage_series')}</span>
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">({list.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startCreate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
            >
              <Plus size={14} />
              {t('series.create')}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* Left: list */}
          <div className="w-[320px] border-r border-slate-200 dark:border-zinc-700 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-6 flex items-center justify-center gap-2 text-slate-500 text-sm">
                <Loader2 size={14} className="animate-spin" />
                {t('series.saving')}
              </div>
            ) : sorted.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                <div>{t('series.empty')}</div>
                <div className="mt-1 text-xs opacity-80">{t('series.empty_hint')}</div>
              </div>
            ) : (
              <ul>
                {sorted.map(s => {
                  const active = edit?.mode === 'edit' && edit.id === s.id;
                  return (
                    <li
                      key={s.id}
                      className={`px-3 py-2.5 border-b border-slate-100 dark:border-zinc-800 cursor-pointer transition-colors ${
                        active ? 'bg-primary/10' : 'hover:bg-slate-50 dark:hover:bg-zinc-800/60'
                      }`}
                      onClick={() => startEdit(s)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                            {s.name}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 truncate">{s.id}</div>
                        </div>
                        <ChevronRight size={14} className="text-slate-400 shrink-0" />
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{t('series.firmware_count', { count: s.firmware_ids.length })}</span>
                        {s.admin_emails.length > 0 && (
                          <span className="opacity-70">· {s.admin_emails.length} admin</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Right: editor */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
            {!edit ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                <div className="text-center">
                  <Layers size={28} className="mx-auto opacity-40 mb-2" />
                  <div>{t('series.empty_hint')}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Slug */}
                <Field label={t('series.id')} hint={t('series.id_hint')}>
                  <input
                    type="text"
                    disabled={edit.mode === 'edit'}
                    value={edit.id}
                    onChange={e => setEdit({ ...edit, id: e.target.value })}
                    placeholder={t('series.id_placeholder')}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary disabled:opacity-60"
                  />
                </Field>

                {/* Name */}
                <Field label={t('series.name')}>
                  <input
                    type="text"
                    value={edit.name}
                    onChange={e => setEdit({ ...edit, name: e.target.value })}
                    placeholder={t('series.name_placeholder')}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                  />
                </Field>

                {/* Description */}
                <Field label={t('series.description')}>
                  <textarea
                    value={edit.description}
                    onChange={e => setEdit({ ...edit, description: e.target.value })}
                    rows={2}
                    placeholder={t('series.description_placeholder')}
                    className="w-full resize-none px-3 py-1.5 text-sm border border-slate-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('series.homepage')}>
                    <input
                      type="text"
                      value={edit.homepage}
                      onChange={e => setEdit({ ...edit, homepage: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                    />
                  </Field>
                  <Field label={t('series.icon')}>
                    <input
                      type="text"
                      value={edit.icon}
                      onChange={e => setEdit({ ...edit, icon: e.target.value })}
                      placeholder="/series/xxx.png"
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('series.tags')}>
                    <input
                      type="text"
                      value={edit.tags}
                      onChange={e => setEdit({ ...edit, tags: e.target.value })}
                      placeholder={t('series.tags_placeholder')}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                    />
                  </Field>
                  <Field label={t('series.order')} hint={t('series.order_hint')}>
                    <input
                      type="number"
                      value={edit.order}
                      onChange={e => setEdit({ ...edit, order: e.target.value })}
                      placeholder="10"
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                    />
                  </Field>
                </div>

                <Field label={t('series.admin_emails')} hint={t('series.admin_emails_hint')}>
                  <textarea
                    value={edit.admin_emails}
                    onChange={e => setEdit({ ...edit, admin_emails: e.target.value })}
                    rows={3}
                    placeholder={'user@example.com\n504826696@qq.com'}
                    className="w-full resize-none px-3 py-1.5 text-sm font-mono border border-slate-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                  />
                </Field>

                {err && <div className="text-sm text-red-500">{err}</div>}

                <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200 dark:border-zinc-700">
                  {edit.mode === 'edit' ? (
                    <button
                      onClick={() => {
                        const s = list.find(x => x.id === edit.id);
                        if (s) handleDelete(s);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                    >
                      <Trash2 size={12} />
                      {t('series.delete')}
                    </button>
                  ) : (
                    <div />
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEdit(null)}
                      className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                    >
                      {t('series.cancel')}
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !edit.name.trim() || (edit.mode === 'create' && !edit.id.trim())}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm bg-primary hover:bg-primary-hover text-white rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          {t('series.saving')}
                        </>
                      ) : (
                        <>
                          <Save size={14} />
                          {t('series.save')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{label}</label>
    {children}
    {hint && <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{hint}</div>}
  </div>
);

export default SeriesManager;
