import { useState, useEffect } from 'react'
import Burner from './components/Burner'
import DeviceToast from './components/DeviceToast'
import SettingsPage from './components/SettingsPage'
import Sidebar from './components/Sidebar'
import FirmwareCommunity from './components/FirmwareCommunity'
import FirmwareDumper from './components/FirmwareDumper'
import FirmwareUtilities from './components/FirmwareUtilities'
import FirmwareUpload from './components/FirmwareUpload'

const AUTH_STORAGE_KEY = 'lilygo_auth';

interface AuthUser {
  login: string;
  name?: string;
  avatar_url?: string;
}

function App() {
  const [activeTab, setActiveTab] = useState('firmware') // Default to firmware/community
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Restore auth state
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const { user: u, token: t } = JSON.parse(stored);
        if (u && t) {
          setUser(u);
          setToken(t);
        }
      }
    } catch (_) {}
  }, []);

  // Listen for login success (Deep Link)
  useEffect(() => {
    if (window.ipcRenderer) {
        const handler = (_: any, data: { token: string; user: AuthUser }) => {
            setToken(data.token);
            setUser(data.user || null);
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: data.token, user: data.user }));
        };
        window.ipcRenderer.on('login-success', handler);
        return () => {
            window.ipcRenderer.off('login-success', handler);
        };
    }
  }, []);

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  // const [selectedFirmwareUrl, _setSelectedFirmwareUrl] = useState<string | undefined>(undefined);

  // const handleSelectFirmware = (url: string) => {
  //     _setSelectedFirmwareUrl(url);
  //     setActiveTab('burner');
  // };

  return (
    <div className="flex h-screen bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 overflow-hidden transition-colors">
      <DeviceToast />
      
      {/* Sidebar Component */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={user}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Tab Content */}
        {activeTab === 'burner' && (
            <div className="h-full overflow-auto">
                <Burner />
            </div>
        )}

        {activeTab === 'dumper' && (
            <div className="h-full overflow-auto">
                <FirmwareDumper />
            </div>
        )}
        
        {activeTab === 'utilities' && (
            <div className="h-full overflow-auto">
                <FirmwareUtilities />
            </div>
        )}
        
        {activeTab === 'upload' && (
            <div className="h-full overflow-auto">
                <FirmwareUpload token={token} />
            </div>
        )}
        
        {activeTab === 'firmware' && (
             <FirmwareCommunity />
        )}
        
        {activeTab === 'settings' && (
            <div className="h-full overflow-auto">
                <SettingsPage />
            </div>
        )}
      </div>
    </div>
  )
}

export default App
