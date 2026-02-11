import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Cpu, Usb, Trash2 } from 'lucide-react';

interface DeviceInfo {
  id: string; // Add unique ID for list rendering
  type: string;
  port?: string;
  vendorId?: string;
  productId?: string;
  manufacturer?: string;
  isEsp?: boolean;
  timestamp: number;
}

const DeviceToast = () => {
  const [notifications, setNotifications] = useState<DeviceInfo[]>([]);
  const [config, setConfig] = useState<{ web_serial_enable: boolean }>({ web_serial_enable: false });
  const { t } = useTranslation();

  const addNotification = (info: Omit<DeviceInfo, 'id' | 'timestamp'>) => {
    const newNotification: DeviceInfo = {
      ...info,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
    };
    
    setNotifications(prev => [newNotification, ...prev]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  useEffect(() => {
    // 1. Listen for config from Main Process
    if (window.ipcRenderer) {
      window.ipcRenderer.on('device-detection-config', (_event, conf) => {
        console.log('Received detection config:', conf);
        setConfig(conf);
      });

      // 2. Listen for devices detected by Main Process (SerialPort / usb-detection)
      window.ipcRenderer.on('device-detected', (_event, deviceInfo: any) => {
        console.log('Device detected (Main):', deviceInfo);
        addNotification(deviceInfo);
      });
    }

    return () => {
      if (window.ipcRenderer) {
        // Use removeAllListeners as implemented in preload to avoid "listener must be function" error
        window.ipcRenderer.off('device-detection-config');
        window.ipcRenderer.off('device-detected');
      }
    };
  }, []);

  // 3. Web Serial API Listener (Renderer Process Strategy)
  useEffect(() => {
    if (!config.web_serial_enable) return;

    if ('serial' in navigator) {
      const handleConnect = (e: any) => {
        console.log('Device connected (Web Serial):', e.target);
        addNotification({
          type: 'web-serial',
          manufacturer: 'Unknown (Web Serial)',
          isEsp: true
        });
      };

      navigator.serial.addEventListener('connect', handleConnect);
      return () => {
        navigator.serial.removeEventListener('connect', handleConnect);
      };
    }
  }, [config.web_serial_enable]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 w-80 max-h-[calc(100vh-6rem)] flex flex-col gap-2 z-50 pointer-events-none">
      {/* Header / Actions Area */}
      <div className="flex justify-end pointer-events-auto mb-1">
        <button 
          onClick={clearAll}
          className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white bg-slate-800/80 px-2 py-1 rounded shadow-sm backdrop-blur-sm transition-colors"
        >
          <Trash2 size={12} />
          <span>{t('device_toast.clear_all')}</span>
        </button>
      </div>

      {/* Scrollable Notification List */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 pb-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
        {notifications.map((device) => (
          <div 
            key={device.id}
            className="pointer-events-auto bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-3 flex items-start space-x-3 text-slate-100 animate-fade-in-left shrink-0"
          >
            <div className="bg-blue-600 p-2 rounded-full mt-1 shrink-0">
              {device.type === 'web-serial' ? <Usb size={18} /> : <Cpu size={18} />}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-sm truncate pr-2">{t('device_toast.new_device')}</h3>
                <button 
                  onClick={() => removeNotification(device.id)} 
                  className="text-slate-400 hover:text-white shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
              
              <div className="mt-1 text-xs text-slate-400 space-y-1">
                <div className="flex items-center justify-between">
                  {device.port ? (
                    <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[120px]" title={device.port}>
                      {device.port}
                    </span>
                  ) : <span></span>}
                  <span className="text-[10px] opacity-60">
                    {new Date(device.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>

                {device.isEsp && (
                  <div>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-900/50 text-green-300 border border-green-800">
                      ESP32 Device
                    </span>
                  </div>
                )}
                
                {device.manufacturer && (
                  <p className="truncate" title={device.manufacturer}>
                    {t('device_toast.manufacturer')}: {device.manufacturer}
                  </p>
                )}
                <p className="opacity-50 text-[10px]">{t('device_toast.via')} {device.type}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeviceToast;
