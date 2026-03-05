import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Send,
  CheckCircle,
  Monitor,
  Mail,
  AlertTriangle,
  ImagePlus,
  Loader2,
} from 'lucide-react';

export interface FeedbackData {
  type: 'bug' | 'feature' | 'ui' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  screenshots: string[];
  contact: string;
  deviceInfo: {
    os: string;
    appVersion: string;
    screenResolution: string;
  };
  timestamp: string;
}

interface FeedbackPageProps {
  onSubmit?: (data: FeedbackData) => Promise<void>;
}

const FEEDBACK_TYPES = ['bug', 'feature', 'ui', 'other'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const MAX_SCREENSHOTS = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif'];

function getOS(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Win')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Unknown';
}

const TYPE_EMOJIS: Record<string, string> = {
  bug: '🐛',
  feature: '💡',
  ui: '🎨',
  other: '📝',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700',
  high: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700',
  urgent: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
};

const FeedbackPage: React.FC<FeedbackPageProps> = ({ onSubmit }) => {
  const { t } = useTranslation();

  const [type, setType] = useState<FeedbackData['type']>('bug');
  const [priority, setPriority] = useState<FeedbackData['priority']>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const deviceInfo = {
    os: getOS(),
    appVersion: 'v0.1.0-alpha',
    screenResolution: `${window.screen.width}x${window.screen.height}`,
  };

  const resetForm = useCallback(() => {
    setType('bug');
    setPriority('medium');
    setTitle('');
    setDescription('');
    setScreenshots([]);
    setContact('');
    setErrors({});
    setSubmitting(false);
    setSubmitted(false);
  }, []);

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      for (const file of fileArray) {
        if (screenshots.length >= MAX_SCREENSHOTS) break;
        if (!ACCEPTED_TYPES.includes(file.type)) continue;
        if (file.size > MAX_FILE_SIZE) continue;

        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          setScreenshots((prev) => {
            if (prev.length >= MAX_SCREENSHOTS) return prev;
            return [...prev, base64];
          });
        };
        reader.readAsDataURL(file);
      }
    },
    [screenshots.length]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const removeScreenshot = useCallback((index: number) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const validate = (): boolean => {
    const newErrors: { title?: string; description?: string } = {};
    if (!title.trim()) {
      newErrors.title = t('feedback.error_title_required');
    }
    if (!description.trim()) {
      newErrors.description = t('feedback.error_description_required');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    const feedbackData: FeedbackData = {
      type,
      priority,
      title: title.trim(),
      description: description.trim(),
      screenshots,
      contact: contact.trim(),
      deviceInfo,
      timestamp: new Date().toISOString(),
    };

    try {
      await onSubmit?.(feedbackData);
      setSubmitted(true);
      setTimeout(() => {
        resetForm();
      }, 3000);
    } catch {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center p-8 rounded-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-xl border border-gray-200 dark:border-gray-700 max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {t('feedback.thank_you')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {t('feedback.thank_you_desc')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          {t('feedback.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          {t('feedback.subtitle')}
        </p>
      </div>

      <div className="space-y-6">
        {/* Feedback Type */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t('feedback.type_label')}
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {FEEDBACK_TYPES.map((ft) => (
              <button
                key={ft}
                type="button"
                onClick={() => setType(ft)}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                  type === ft
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md scale-[1.02]'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <span className="text-2xl">{TYPE_EMOJIS[ft]}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {t(`feedback.type_${ft}`)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  {t(`feedback.type_${ft}_desc`)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t('feedback.priority_label')}
            <span className="ml-1 text-xs font-normal text-gray-400">({t('feedback.optional')})</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200 cursor-pointer ${
                  priority === p
                    ? `${PRIORITY_COLORS[p]} border-2 shadow-sm`
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                {t(`feedback.priority_${p}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Title & Description */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              {t('feedback.title_label')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                if (e.target.value.length <= 100) setTitle(e.target.value);
              }}
              placeholder={t('feedback.title_placeholder')}
              className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${
                errors.title
                  ? 'border-red-400 focus:ring-red-300'
                  : 'border-gray-200 dark:border-gray-600 focus:ring-blue-300 focus:border-blue-400'
              }`}
            />
            <div className="flex justify-between mt-1">
              {errors.title && (
                <span className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {errors.title}
                </span>
              )}
              <span className="text-xs text-gray-400 ml-auto">{title.length}/100</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              {t('feedback.description_label')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                if (e.target.value.length <= 2000) setDescription(e.target.value);
              }}
              placeholder={t('feedback.description_placeholder')}
              rows={6}
              className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 transition-all resize-none ${
                errors.description
                  ? 'border-red-400 focus:ring-red-300'
                  : 'border-gray-200 dark:border-gray-600 focus:ring-blue-300 focus:border-blue-400'
              }`}
            />
            <div className="flex justify-between mt-1">
              {errors.description && (
                <span className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {errors.description}
                </span>
              )}
              <span className="text-xs text-gray-400 ml-auto">{description.length}/2000</span>
            </div>
          </div>
        </div>

        {/* Screenshots */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t('feedback.screenshots_label')}
            <span className="ml-1 text-xs font-normal text-gray-400">
              ({t('feedback.optional')} · {t('feedback.screenshots_hint', { max: MAX_SCREENSHOTS })})
            </span>
          </label>

          {screenshots.length < MAX_SCREENSHOTS && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                dragOver
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-700/30'
              }`}
            >
              <ImagePlus className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('feedback.screenshots_drop')}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                PNG / JPG / GIF · {t('feedback.screenshots_max_size', { size: '5MB' })}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) processFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
          )}

          {screenshots.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-4">
              {screenshots.map((src, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={src}
                    alt={`Screenshot ${idx + 1}`}
                    className="w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => removeScreenshot(idx)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            {t('feedback.contact_label')}
            <span className="ml-1 text-xs font-normal text-gray-400">({t('feedback.optional')})</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={t('feedback.contact_placeholder')}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all"
            />
          </div>
        </div>

        {/* Device Info */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            <Monitor className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            {t('feedback.device_info_label')}
            <span className="ml-1 text-xs font-normal text-gray-400">({t('feedback.auto_collected')})</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('feedback.device_os')}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{deviceInfo.os}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('feedback.device_version')}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{deviceInfo.appVersion}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('feedback.device_resolution')}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{deviceInfo.screenResolution}</p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('feedback.submitting')}
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                {t('feedback.submit')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage;
