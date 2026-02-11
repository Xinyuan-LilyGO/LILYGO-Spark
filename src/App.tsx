import { useState } from 'react'
import Flasher from './components/Flasher'
import DeviceToast from './components/DeviceToast'
import SettingsPage from './components/SettingsPage'
import Sidebar from './components/Sidebar'
import FirmwareCommunity from './components/FirmwareCommunity'
import FirmwareDumper from './components/FirmwareDumper'

function App() {
  const [activeTab, setActiveTab] = useState('firmware') // Default to firmware/community

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      <DeviceToast />
      
      {/* Sidebar Component */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Tab Content */}
        {activeTab === 'flasher' && (
            <div className="h-full overflow-auto">
                <Flasher />
            </div>
        )}

        {activeTab === 'dumper' && (
            <div className="h-full overflow-auto">
                <FirmwareDumper />
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
