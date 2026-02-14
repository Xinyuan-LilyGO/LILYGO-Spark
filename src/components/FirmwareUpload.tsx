import React, { useState } from 'react';
import { Upload, FileUp, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import FullWindowDropZone from './FullWindowDropZone';

interface FirmwareUploadProps {
  token: string | null;
}

const FirmwareUpload: React.FC<FirmwareUploadProps> = ({ token }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      applyFile(e.target.files[0]);
    }
  };

  const applyFile = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.bin')) {
      setStatus('error');
      setMessage('Only .bin files are allowed');
      setFile(null);
      return;
    }
    setFile(selectedFile);
    setStatus('idle');
    setMessage('');
  };

  const handleDrop = (files: FileList) => {
    const f = Array.from(files).find((x) => x.name.toLowerCase().endsWith('.bin'));
    if (f) applyFile(f);
  };

  const handleUpload = async () => {
    if (!file || !token) return;

    setUploading(true);
    setStatus('idle');
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      let API_URL: string;
      if (window.ipcRenderer) {
        API_URL = await window.ipcRenderer.invoke('get-api-base-url');
      } else {
        throw new Error('无法获取 API 地址：请在 Electron 环境中运行，并配置 lilygo_config.json 中的 api_base_url');
      }

      const response = await fetch(`${API_URL}/upload/firmware`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        setMessage('Upload successful!');
        setUploadedUrl(data.url);
      } else {
        setStatus('error');
        setMessage(data.error || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Upload Error Details:', error);
      setStatus('error');
      if (error.message && error.message.includes('Failed to fetch')) {
        setMessage('Cannot connect to server. Is it running?');
      } else {
        setMessage(error.message || 'Network error');
      }
    } finally {
      setUploading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
        <AlertCircle size={48} className="mb-4" />
        <p>Please login to upload firmware.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto relative">
      <FullWindowDropZone
        active={!uploading}
        accept=".bin"
        onDrop={handleDrop}
        hintKey="common.drop_firmware"
      />
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
        <Upload className="text-primary" />
        Firmware Upload
      </h2>

      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <div className="mb-6">
          <label className="block text-slate-600 dark:text-slate-400 mb-2 text-sm">Select Firmware (.bin)</label>
          <div className="relative group">
            <input
              type="file"
              accept=".bin"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              disabled={uploading}
            />
            <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              file ? 'border-primary/50 bg-primary/5' : 'border-slate-300 dark:border-zinc-600 hover:border-slate-400 dark:hover:border-zinc-500 hover:bg-slate-200 dark:hover:bg-zinc-700/50'
            }`}>
              {file ? (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <FileUp size={24} />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-xs text-slate-500">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <div className="text-slate-500">
                  <Upload size={32} className="mx-auto mb-2 opacity-50" />
                  <p>Click or drag file here</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {status === 'error' && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-2 text-sm">
            <AlertCircle size={16} />
            {message}
          </div>
        )}

        {status === 'success' && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={16} />
              {message}
            </div>
            {uploadedUrl && (
              <div className="text-xs break-all text-slate-600 dark:text-slate-500 mt-2 p-2 bg-slate-200 dark:bg-slate-900 rounded select-all">
                {uploadedUrl}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
            !file || uploading
              ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/20'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload size={20} />
              Upload Firmware
            </>
          )}
        </button>
      </div>
      
      <div className="mt-6 text-xs text-slate-500 dark:text-slate-500">
        <p className="mb-2">Note:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Only .bin files are accepted.</li>
          <li>Files will be validated before storage.</li>
        </ul>
      </div>
    </div>
  );
};

export default FirmwareUpload;
