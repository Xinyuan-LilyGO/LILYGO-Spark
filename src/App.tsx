import { useState, useEffect } from 'react'
import { useTheme } from './contexts/ThemeContext'
import { DownloadProvider } from './contexts/DownloadContext'
import { useKonamiCode } from './hooks/useKonamiCode'
import FirmwareToolsPage from './components/FirmwareToolsPage'
import { HackerEasterEgg } from './components/HackerEasterEgg'
import Discovery from './components/Discovery'
import DeviceToast from './components/DeviceToast'
import SettingsPage from './components/SettingsPage'
import Sidebar from './components/Sidebar'
import FirmwareCommunity from './components/FirmwareCommunity'
import SerialMonitorTool from './components/SerialMonitorTool'
import ToolboxPage from './components/ToolboxPage'
import FirmwareUpload from './components/FirmwareUpload'
import LilygoCommunity from './components/LilygoCommunity'
import SparkLab from './components/SparkLab'

const AUTH_STORAGE_KEY = 'lilygo_auth';

interface AuthUser {
  login: string;
  name?: string;
  avatar_url?: string;
  email?: string;
  isAdmin?: boolean;
}

function App() {
  const { glassEnabled, resolved } = useTheme();
  const [konamiShow, setKonamiShow] = useState(false);
  useKonamiCode(() => setKonamiShow(true));
  const [activeTab, setActiveTab] = useState('firmware') // Default to firmware center
  const [toolsDefaultTab, setToolsDefaultTab] = useState<'burner' | 'dumper' | 'analyzer' | 'editor' | undefined>(undefined);
  const [pendingAnalysisFile, setPendingAnalysisFile] = useState<{ path: string; fileName: string } | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Check admin role from server
  const checkRole = async (t: string, u: AuthUser) => {
    try {
      let apiUrl: string;
      if (window.ipcRenderer) {
        apiUrl = await window.ipcRenderer.invoke('get-api-base-url');
      } else {
        return;
      }
      const roleUrl = `${apiUrl}/auth/role`;
      console.log(`%c[AUTH] Checking role: ${roleUrl}`, 'color: #00bcd4; font-weight: bold; font-size: 14px;');
      const resp = await fetch(roleUrl, { headers: { Authorization: `Bearer ${t}` } });
      const data = await resp.json();
      console.log(`%c[AUTH] Role response:`, 'color: #00bcd4; font-weight: bold; font-size: 14px;', data);
      if (resp.ok) {
        const updatedUser = { ...u, email: data.email || u.email, isAdmin: data.isAdmin };
        if (data.isAdmin) {
          console.log(`%c[AUTH] ★ ADMIN DETECTED: ${data.login} (${data.email})`, 'color: #ff9800; font-weight: bold; font-size: 16px; background: #1a1a1a; padding: 4px 8px; border-radius: 4px;');
        } else {
          console.log(`%c[AUTH] Regular user: ${data.login}`, 'color: #4caf50; font-weight: bold; font-size: 14px;');
        }
        setUser(updatedUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: t, user: updatedUser }));
      } else {
        console.warn(`%c[AUTH] Role check failed: ${resp.status}`, 'color: #f44336; font-weight: bold; font-size: 14px;', data);
      }
    } catch (e) {
      console.error('%c[AUTH] Role check error:', 'color: #f44336; font-weight: bold; font-size: 14px;', e);
    }
  };

  // Restore auth state + check role
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const { user: u, token: t } = JSON.parse(stored);
        if (u && t) {
          setUser(u);
          setToken(t);
          checkRole(t, u);
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
            // Check role immediately after login
            if (data.user && data.token) {
              checkRole(data.token, data.user);
            }
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

  const bgClass = glassEnabled
    ? resolved === 'dark'
      ? 'bg-glass-mesh-dark'
      : 'bg-glass-mesh-light'
    : 'bg-background';

  return (
    <DownloadProvider>
    <div className={`flex h-screen text-[rgb(var(--color-text-base))] overflow-hidden transition-all duration-300 ${bgClass}`}>
      <HackerEasterEgg show={konamiShow} onComplete={() => setKonamiShow(false)} message="ACCESS GRANTED" />
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
        <div key={activeTab} className="flex-1 flex flex-col min-h-0 overflow-hidden animate-fade-in">
        {/* Tab Content */}
        {activeTab === 'spark_lab' && (
            <div className="h-full overflow-auto">
                <SparkLab />
            </div>
        )}

        {activeTab === 'discovery' && (
             <Discovery />
        )}

        {activeTab === 'community' && (
             <LilygoCommunity />
        )}

        {activeTab === 'tools' && (
            <div className="h-full overflow-auto">
                <FirmwareToolsPage defaultTab={toolsDefaultTab} pendingAnalysisFile={pendingAnalysisFile} onAnalysisFileConsumed={() => setPendingAnalysisFile(null)} />
            </div>
        )}
        
        
        {activeTab === 'serial_tools' && (
            <div className="h-full flex flex-col overflow-hidden">
                <SerialMonitorTool />
            </div>
        )}
        
        {activeTab === 'offline_tools' && (
            <div className="h-full overflow-auto">
                <ToolboxPage />
            </div>
        )}
        
        {activeTab === 'upload' && (
            <div className="h-full overflow-auto">
                <FirmwareUpload token={token} isAdmin={user?.isAdmin || false} />
            </div>
        )}
        
        {activeTab === 'firmware' && (
             <FirmwareCommunity
               isAdmin={user?.isAdmin || false}
               token={token}
               onNavigateToAnalyzer={(filePath, fileName) => {
                 setPendingAnalysisFile({ path: filePath, fileName });
                 setToolsDefaultTab('analyzer');
                 setActiveTab('tools');
             }} />
        )}
        
        {activeTab === 'settings' && (
            <div className="h-full overflow-auto">
                <SettingsPage />
            </div>
        )}
        </div>
      </div>
    </div>
    </DownloadProvider>
  )
}

export default App
