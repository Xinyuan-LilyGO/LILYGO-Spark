import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Send, Trash2, X, Loader2, ThumbsUp, PencilLine, ChevronRight } from 'lucide-react';

// ---- Types ----------------------------------------------------------------

export interface CurrentUser {
  id?: number;
  login: string;
  name?: string;
  avatar_url?: string;
  email?: string;
  isAdmin?: boolean;
}

interface CommentUser {
  id: number;
  login: string;
  name: string;
  avatar_url: string;
  isAdmin?: boolean;
}

export interface ServerComment {
  id: string;
  user: CommentUser;
  content: string;
  created_at: string;
  likes?: number;
  deleted?: boolean;
}

// ---- Utils ----------------------------------------------------------------

/** Sha256 前 16 位（小写），作为评论归属的固件 id */
export function firmwareIdFromSha256(sha256?: string | null): string | null {
  if (!sha256) return null;
  const s = sha256.toLowerCase();
  if (s.length < 16) return null;
  return s.slice(0, 16);
}

async function getApiBase(): Promise<string> {
  if (window.ipcRenderer) {
    return window.ipcRenderer.invoke('get-api-base-url');
  }
  throw new Error('Not in Electron environment');
}

/** 只解析 JSON 响应；非 2xx 或非 JSON 时返回 null（避免 SyntaxError 和 HTML 404 刷屏） */
async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const resp = await fetch(url, init);
    const ct = resp.headers.get('content-type') || '';
    if (!resp.ok || !ct.includes('application/json')) return null;
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

function likeStorageKey(firmwareId: string, commentId: string): string {
  return `lilygo_cmt_like:${firmwareId}:${commentId}`;
}

function formatRelativeTime(iso: string, locale: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  if (Number.isNaN(then)) return iso;
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 60) return locale.startsWith('zh') ? '刚刚' : locale.startsWith('ja') ? 'たった今' : 'just now';
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return locale.startsWith('zh') ? `${m} 分钟前` : locale.startsWith('ja') ? `${m} 分前` : `${m}m ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return locale.startsWith('zh') ? `${h} 小时前` : locale.startsWith('ja') ? `${h} 時間前` : `${h}h ago`;
  }
  if (diff < 86400 * 30) {
    const d = Math.floor(diff / 86400);
    return locale.startsWith('zh') ? `${d} 天前` : locale.startsWith('ja') ? `${d} 日前` : `${d}d ago`;
  }
  return new Date(iso).toLocaleDateString();
}

// ---- Icons (pinky finger like) -------------------------------------------

/** 小拇指点赞图标 */
const PinkyLikeIcon: React.FC<{ size?: number; filled?: boolean; className?: string }> = ({
  size = 16,
  filled = false,
  className,
}) => {
  // 用 emoji 直接表达小拇指，保持跨平台可见
  return (
    <span
      aria-hidden
      className={className}
      style={{
        fontSize: size,
        lineHeight: 1,
        display: 'inline-block',
        filter: filled ? 'saturate(1.2)' : 'grayscale(0.4) opacity(0.85)',
        transform: filled ? 'scale(1.05)' : undefined,
        transition: 'transform 120ms ease',
      }}
    >
      🤙
    </span>
  );
};

// ---- Hook -----------------------------------------------------------------

interface UseCommentsResult {
  count: number;
  top: ServerComment | null;
  comments: ServerComment[];
  loadingSummary: boolean;
  loadingAll: boolean;
  fetchAll: () => Promise<void>;
  post: (content: string) => Promise<void>;
  remove: (commentId: string) => Promise<void>;
  toggleLike: (commentId: string) => Promise<void>;
  isLiked: (commentId: string) => boolean;
}

function useComments(firmwareId: string | null): UseCommentsResult {
  const [count, setCount] = useState(0);
  const [top, setTop] = useState<ServerComment | null>(null);
  const [comments, setComments] = useState<ServerComment[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [likedTick, setLikedTick] = useState(0); // force re-render after localStorage change

  const fetchSummary = useCallback(async () => {
    if (!firmwareId) return;
    setLoadingSummary(true);
    try {
      const api = await getApiBase();
      // 新接口：summary（服务端已排序，只返回 count + top）
      const data = await fetchJson<{ success?: boolean; count?: number; top?: ServerComment | null }>(
        `${api}/comments/${firmwareId}/summary`
      );
      if (data?.success) {
        setCount(data.count || 0);
        setTop(data.top || null);
        return;
      }
      // 旧服务器没有 summary 路由：回退到 list 接口自行计算
      const list = await fetchJson<{ success?: boolean; comments?: ServerComment[] }>(
        `${api}/comments/${firmwareId}`
      );
      if (list?.success) {
        const visible = (list.comments || []).filter(c => !c.deleted);
        const sorted = visible.sort((a, b) => {
          const la = a.likes || 0, lb = b.likes || 0;
          if (la !== lb) return lb - la;
          return b.created_at.localeCompare(a.created_at);
        });
        setCount(sorted.length);
        setTop(sorted[0] || null);
      }
    } finally {
      setLoadingSummary(false);
    }
  }, [firmwareId]);

  const fetchAll = useCallback(async () => {
    if (!firmwareId) return;
    setLoadingAll(true);
    try {
      const api = await getApiBase();
      const data = await fetchJson<{ success?: boolean; comments?: ServerComment[] }>(
        `${api}/comments/${firmwareId}`
      );
      if (data?.success) {
        const visible = (data.comments || []).filter(c => !c.deleted);
        // 如果后端是旧版（没按 likes 排序），前端再排一次
        const sorted = visible.sort((a, b) => {
          const la = a.likes || 0, lb = b.likes || 0;
          if (la !== lb) return lb - la;
          return b.created_at.localeCompare(a.created_at);
        });
        setComments(sorted);
        setCount(sorted.length);
        setTop(sorted[0] || null);
      }
    } finally {
      setLoadingAll(false);
    }
  }, [firmwareId]);

  const post = useCallback(
    async (content: string) => {
      if (!firmwareId) return;
      const api = await getApiBase();
      const raw = localStorage.getItem('lilygo_auth');
      const token = raw ? (JSON.parse(raw).token as string) : null;
      if (!token) throw new Error('not_logged_in');
      const resp = await fetch(`${api}/comments/${firmwareId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.success) {
        const err = new Error(data?.error || 'post_failed');
        (err as any).status = resp.status;
        (err as any).reason = data?.reason;
        throw err;
      }
      await fetchAll();
    },
    [firmwareId, fetchAll]
  );

  const remove = useCallback(
    async (commentId: string) => {
      if (!firmwareId) return;
      const api = await getApiBase();
      const raw = localStorage.getItem('lilygo_auth');
      const token = raw ? (JSON.parse(raw).token as string) : null;
      if (!token) throw new Error('not_logged_in');
      const resp = await fetch(`${api}/comments/${firmwareId}/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success) {
        throw new Error(data?.error || 'delete_failed');
      }
      await fetchAll();
    },
    [firmwareId, fetchAll]
  );

  const isLiked = useCallback(
    (commentId: string): boolean => {
      if (!firmwareId) return false;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      likedTick; // access to subscribe to re-renders
      return localStorage.getItem(likeStorageKey(firmwareId, commentId)) === '1';
    },
    [firmwareId, likedTick]
  );

  const toggleLike = useCallback(
    async (commentId: string) => {
      if (!firmwareId) return;
      const api = await getApiBase();
      const liked = localStorage.getItem(likeStorageKey(firmwareId, commentId)) === '1';
      const method = liked ? 'DELETE' : 'POST';
      // 乐观更新
      setComments(prev =>
        prev.map(c =>
          c.id === commentId ? { ...c, likes: Math.max(0, (c.likes || 0) + (liked ? -1 : 1)) } : c
        )
      );
      setTop(prev =>
        prev && prev.id === commentId
          ? { ...prev, likes: Math.max(0, (prev.likes || 0) + (liked ? -1 : 1)) }
          : prev
      );
      if (liked) localStorage.removeItem(likeStorageKey(firmwareId, commentId));
      else localStorage.setItem(likeStorageKey(firmwareId, commentId), '1');
      setLikedTick(t => t + 1);

      try {
        const resp = await fetch(`${api}/comments/${firmwareId}/${commentId}/like`, { method });
        const data = await resp.json();
        if (data?.success && typeof data.likes === 'number') {
          // 以服务端数字为准
          setComments(prev => prev.map(c => (c.id === commentId ? { ...c, likes: data.likes } : c)));
          setTop(prev => (prev && prev.id === commentId ? { ...prev, likes: data.likes } : prev));
        }
      } catch (e) {
        console.error('Failed to toggle like:', e);
      }
    },
    [firmwareId]
  );

  useEffect(() => {
    if (firmwareId) {
      fetchSummary();
    } else {
      setCount(0);
      setTop(null);
      setComments([]);
    }
  }, [firmwareId, fetchSummary]);

  return { count, top, comments, loadingSummary, loadingAll, fetchAll, post, remove, toggleLike, isLiked };
}

// ---- Components -----------------------------------------------------------

const CommentAvatar: React.FC<{ user: CommentUser; size?: number }> = ({ user, size = 32 }) => {
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.login}
        width={size}
        height={size}
        className="rounded-full shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-slate-300 dark:bg-zinc-600 flex items-center justify-center text-white font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {(user.name || user.login || '?').charAt(0).toUpperCase()}
    </div>
  );
};

interface CommentRowProps {
  firmwareId: string;
  comment: ServerComment;
  currentUser?: CurrentUser | null;
  liked: boolean;
  onToggleLike: () => void;
  onDelete?: () => void;
}

const CommentRow: React.FC<CommentRowProps> = ({ comment, currentUser, liked, onToggleLike, onDelete }) => {
  const { t, i18n } = useTranslation();
  const isOwner = !!currentUser && currentUser.login === comment.user.login;
  const canDelete = !!currentUser && (isOwner || currentUser.isAdmin);

  return (
    <div className="flex gap-3 py-3">
      <CommentAvatar user={comment.user} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">
            {comment.user.name || comment.user.login}
          </span>
          {comment.user.isAdmin && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
              {t('comments.admin_badge')}
            </span>
          )}
          {isOwner && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/40">
              {t('comments.you_badge')}
            </span>
          )}
          <span className="text-xs text-slate-500 dark:text-slate-500">
            {formatRelativeTime(comment.created_at, i18n.language || 'en')}
          </span>
        </div>
        <div className="mt-1 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
          {comment.content}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={onToggleLike}
            aria-label={liked ? t('comments.unlike_aria') : t('comments.like_aria')}
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-all ${
              liked
                ? 'text-primary bg-primary/10 ring-1 ring-primary/30'
                : 'text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-primary/5'
            }`}
          >
            {liked ? <PinkyLikeIcon size={14} filled /> : <ThumbsUp size={13} />}
            <span className="font-mono tabular-nums">{comment.likes || 0}</span>
          </button>
          {canDelete && onDelete && (
            <button
              onClick={() => {
                if (window.confirm(t('comments.delete_confirm'))) onDelete();
              }}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors"
            >
              <Trash2 size={12} />
              {t('comments.delete')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface CommentsModalProps {
  firmwareId: string;
  firmwareName?: string;
  currentUser?: CurrentUser | null;
  onClose: () => void;
  onChange?: () => void;
}

const CommentsModal: React.FC<CommentsModalProps> = ({ firmwareId, firmwareName, currentUser, onClose, onChange }) => {
  const { t } = useTranslation();
  const { comments, loadingAll, fetchAll, post, remove, toggleLike, isLiked } = useComments(firmwareId);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSubmit = async () => {
    const content = draft.trim();
    if (!content || submitting) return;
    if (!currentUser) {
      setErrorMsg(t('comments.login_required'));
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await post(content);
      setDraft('');
      onChange?.();
    } catch (e: any) {
      const reason = e?.reason || (typeof e?.message === 'string' ? e.message : '');
      if (e?.status === 400 && (reason === 'anti-spam' || reason === 'spam')) {
        setErrorMsg(t('comments.spam_blocked'));
      } else {
        setErrorMsg(t('comments.error_post'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await remove(commentId);
      onChange?.();
    } catch {
      setErrorMsg(t('comments.error_delete'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700 w-[640px] max-w-[92vw] max-h-[82vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-700">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
              <MessageCircle size={18} className="text-primary" />
              <span>{t('comments.title')}</span>
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                ({comments.length})
              </span>
            </div>
            {firmwareName && (
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {firmwareName}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable comments list */}
        <div className="flex-1 overflow-y-auto px-5 custom-scrollbar">
          {loadingAll ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">{t('comments.loading')}</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              {t('comments.empty')}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {comments.map(c => (
                <CommentRow
                  key={c.id}
                  firmwareId={firmwareId}
                  comment={c}
                  currentUser={currentUser}
                  liked={isLiked(c.id)}
                  onToggleLike={() => toggleLike(c.id)}
                  onDelete={() => handleDelete(c.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-slate-200 dark:border-zinc-700 p-4 bg-slate-50 dark:bg-zinc-900/80">
          {!currentUser ? (
            <div className="text-sm text-center text-slate-500 dark:text-slate-400 py-2">
              {t('comments.login_required_tip')}
            </div>
          ) : (
            <>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder={t('comments.write_placeholder')}
                rows={3}
                maxLength={1000}
                className="w-full resize-none px-3 py-2 text-sm border border-slate-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
              />
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-slate-400 tabular-nums">{draft.length}/1000</div>
                <div className="flex items-center gap-2">
                  {errorMsg && <span className="text-xs text-red-500">{errorMsg}</span>}
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || draft.trim().length === 0}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        {t('comments.submitting')}
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        {t('comments.submit')}
                      </>
                    )}
                  </button>
                </div>
              </div>
              {errorMsg && !submitting && (
                <div className="text-xs text-red-500 mt-1 text-right">{errorMsg}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface CommentsPanelProps {
  /** Firmware sha256（完整或前缀都行，组件内部会截 16 位） */
  firmwareSha256?: string | null;
  firmwareName?: string;
  currentUser?: CurrentUser | null;
}

/**
 * 固件卡片右下角内嵌的评论区：
 *   - 左侧：💬 N 条评论 + 最热评论预览
 *   - 右侧：写评论按钮（未登录会弹提示）
 */
const CommentsPanel: React.FC<CommentsPanelProps> = ({ firmwareSha256, firmwareName, currentUser }) => {
  const { t, i18n } = useTranslation();
  const firmwareId = useMemo(() => firmwareIdFromSha256(firmwareSha256 || null), [firmwareSha256]);
  const { count, top, loadingSummary, toggleLike, isLiked } = useComments(firmwareId);
  const [modalOpen, setModalOpen] = useState(false);
  const [loginTipVisible, setLoginTipVisible] = useState(false);

  if (!firmwareId) return null;

  const countLabel =
    count === 0 ? t('comments.count_zero') : count === 1 ? t('comments.count_one') : t('comments.count_other', { count });

  const openModal = () => setModalOpen(true);
  const handleWrite = () => {
    if (!currentUser) {
      setLoginTipVisible(true);
      setTimeout(() => setLoginTipVisible(false), 2400);
      return;
    }
    setModalOpen(true);
  };

  const hasTop = !loadingSummary && !!top;

  const writeButton = (
    <div className="relative">
      {loginTipVisible && (
        <div className="absolute bottom-full mb-1.5 right-0 px-2.5 py-1 rounded-md bg-zinc-800 dark:bg-zinc-700 text-white text-xs shadow-lg whitespace-nowrap animate-fade-in z-10">
          {t('comments.login_required')}
        </div>
      )}
      <button
        onClick={handleWrite}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/15 transition-colors"
      >
        <PencilLine size={12} />
        {t('comments.write')}
      </button>
    </div>
  );

  // 空状态：极简 inline 行，没评论时不制造视觉噪音
  if (!hasTop) {
    return (
      <>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle size={12} className="opacity-60" />
            <span>{t('comments.count_zero')}</span>
          </span>
          {writeButton}
        </div>
        {modalOpen && (
          <CommentsModal
            firmwareId={firmwareId}
            firmwareName={firmwareName}
            currentUser={currentUser}
            onClose={() => setModalOpen(false)}
          />
        )}
      </>
    );
  }

  // 有评论：一张精致卡片
  const liked = isLiked(top.id);

  return (
    <div className="mt-3">
      <div className="group relative rounded-xl border border-slate-200/70 dark:border-zinc-700/60 bg-gradient-to-br from-slate-50/60 to-slate-50/30 dark:from-zinc-800/40 dark:to-zinc-800/20 hover:border-primary/40 hover:shadow-sm transition-all">
        {/* 顶部迷你 header */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
          <button
            onClick={openModal}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-primary transition-colors"
            title={t('comments.view_all')}
          >
            <MessageCircle size={13} className="text-primary" />
            <span>{countLabel}</span>
            {count > 1 && <ChevronRight size={12} className="opacity-60 group-hover:opacity-100 transition-opacity" />}
          </button>
          {writeButton}
        </div>

        {/* 顶评内容 */}
        <button
          onClick={openModal}
          className="w-full text-left px-3 pb-3 flex items-start gap-2.5"
          title={t('comments.view_all')}
        >
          <CommentAvatar user={top.user} size={26} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-500">
              <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                {top.user.name || top.user.login}
              </span>
              {top.user.isAdmin && (
                <span className="text-[9px] px-1 py-px rounded-sm bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60 leading-none">
                  {t('comments.admin_badge')}
                </span>
              )}
              <span className="opacity-60">·</span>
              <span>{formatRelativeTime(top.created_at, i18n.language || 'en')}</span>
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-200 line-clamp-2 mt-0.5 break-words leading-snug">
              {top.content}
            </div>
          </div>
          <button
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              toggleLike(top.id);
            }}
            aria-label={liked ? t('comments.unlike_aria') : t('comments.like_aria')}
            className={`shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-all ${
              liked
                ? 'text-primary bg-primary/10 ring-1 ring-primary/30'
                : 'text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-primary/5'
            }`}
          >
            {liked ? <PinkyLikeIcon size={13} filled /> : <ThumbsUp size={12} />}
            {!!(top.likes && top.likes > 0) && (
              <span className="font-mono tabular-nums text-[11px]">{top.likes}</span>
            )}
          </button>
        </button>
      </div>

      {modalOpen && (
        <CommentsModal
          firmwareId={firmwareId}
          firmwareName={firmwareName}
          currentUser={currentUser}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
};

export default CommentsPanel;
