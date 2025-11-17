
import React, { useState, useEffect } from 'react';
import { Home, DollarSign, FileBarChart, Settings } from 'lucide-react';
import HomeTab from './components/HomeTab';
import AdvancesTab from './components/AdvancesTab';
import ReportsTab from './components/ReportsTab';
import SettingsTab from './components/SettingsTab';
import { getSettings } from './services/storageService';
import { UserSettings } from './types';

type Tab = 'home' | 'advances' | 'reports' | 'settings';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [settings, setSettings] = useState<UserSettings>(getSettings());
  const [dataVersion, setDataVersion] = useState(0);
  const [dateToEdit, setDateToEdit] = useState<string | null>(null);

  useEffect(() => {
    setSettings(getSettings());
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  const handleDataUpdate = () => setDataVersion(prev => prev + 1);
  const handleSettingsUpdate = (newSettings: UserSettings) => {
    setSettings(newSettings);
    handleDataUpdate();
  };
  const handleEditEntry = (date: string) => {
    setDateToEdit(date);
    setActiveTab('home');
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'home': return <HomeTab settings={settings} onUpdate={handleDataUpdate} initialDate={dateToEdit} onClearInitialDate={() => setDateToEdit(null)} />;
      case 'advances': return <AdvancesTab onUpdate={handleDataUpdate} />;
      case 'reports': return <ReportsTab settings={settings} onEdit={handleEditEntry} dataVersion={dataVersion} />;
      case 'settings': return <SettingsTab settings={settings} onSave={handleSettingsUpdate} />;
      default: return null;
    }
  };

  const NavButton: React.FC<{ tabName: Tab; icon: React.ElementType; label: string }> = ({ tabName, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`flex flex-col items-center p-2 rounded-lg transition-colors w-1/4 ${
        activeTab === tabName ? 'text-blue-600 bg-blue-50 dark:bg-slate-800 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <Icon className="w-6 h-6 mb-1" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <main className="flex-1 p-4 pb-24 max-w-md mx-auto w-full">{renderTab()}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-2 py-2 z-50">
        <div className="max-w-md mx-auto flex justify-around items-center">
          <NavButton tabName="home" icon={Home} label="Registro" />
          <NavButton tabName="advances" icon={DollarSign} label="Vales" />
          <NavButton tabName="reports" icon={FileBarChart} label="Resumo" />
          <NavButton tabName="settings" icon={Settings} label="Ajustes" />
        </div>
      </nav>
    </div>
  );
};

export default App;