import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload } from 'lucide-react';

interface FullWindowDropZoneProps {
  accept?: string;
  onDrop: (files: FileList) => void;
  active: boolean;
  hintKey?: string;
}

const FullWindowDropZone: React.FC<FullWindowDropZoneProps> = ({
  accept,
  onDrop,
  active,
  hintKey = 'common.drop_hint',
}) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);

  const preventDefault = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      preventDefault(e);
      if (!active) return;
      if (e.dataTransfer?.types?.includes('Files')) {
        setIsDragging(true);
      }
    },
    [active, preventDefault]
  );

  const handleDragLeave = useCallback(
    (e: DragEvent) => {
      preventDefault(e);
      if (!active) return;
      const rel = e.relatedTarget as Node | null;
      if (rel === null || !document.body.contains(rel)) {
        setIsDragging(false);
      }
    },
    [active, preventDefault]
  );

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      preventDefault(e);
      if (active && e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    },
    [active, preventDefault]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      preventDefault(e);
      if (!active) return;
      setIsDragging(false);
      const files = e.dataTransfer?.files;
      if (files?.length) {
        onDrop(files);
      }
    },
    [active, onDrop, preventDefault]
  );

  useEffect(() => {
    if (!active) return;
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [active, handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  if (!isDragging) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm pointer-events-auto"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 border-4 border-dashed border-primary/80 shadow-2xl max-w-md mx-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
            <Upload size={40} className="text-primary" />
          </div>
          <p className="text-xl font-bold text-slate-800 dark:text-white">
            {t(hintKey)}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {accept === 'image/*'
              ? t('common.drop_image_hint')
              : accept === '.bin'
              ? t('common.drop_bin_hint')
              : t('common.drop_file_hint')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default FullWindowDropZone;
