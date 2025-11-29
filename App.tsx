import React, { useState, useEffect } from 'react';
import { Home, DollarSign, FileBarChart, Settings, CloudDownload } from 'lucide-react';
import HomeTab from './components/HomeTab';
import AdvancesTab from './components/AdvancesTab';
import ReportsTab from './components/ReportsTab';
import SettingsTab from './components/SettingsTab';
import ExpensesTab from './components/ExpensesTab'; // Added ExpensesTab
import AuthPage from './components/AuthPage';
import { getSettings, getLastNotificationDate, setLastNotificationDate, getWorkEntries, fetchAllFromSupabase, clearLocalData } from './services/storageService';
import { UserSettings, WorkStatus } from './types';
import { format } from 'date-fns';
import { supabase } from './services/supabaseClient';

type Tab = 'home' | 'advances' | 'reports' | 'settings' | 'expenses';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false); // Estado para mostrar carregamento de dados da nuvem

  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [settings, setSettings] = useState<UserSettings>(getSettings());
  const [dataVersion, setDataVersion] = useState(0);
  const [dateToEdit, setDateToEdit] = useState<string | null>(null);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
      if (session) {
        syncData();
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        syncData();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const syncData = async () => {
    setIsSyncing(true);
    // Baixa dados do Supabase e atualiza local storage (limpa dados antigos antes)
    await fetchAllFromSupabase();
    // Atualiza estados locais para refletir os novos dados
    setSettings(getSettings());
    setDataVersion(v => v + 1);
    setIsSyncing(false);
  };

  useEffect(() => {
    setSettings(getSettings());
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  // Lógica de Notificação
  useEffect(() => {
    if (!session) return; // Só roda notificação se estiver logado

    const checkNotification = () => {
        if (!settings.notificationEnabled || !settings.notificationTime) return;

        const now = new Date();
        const currentTime = format(now, 'HH:mm');
        const todayStr = format(now, 'yyyy-MM-dd');
        const lastSent = getLastNotificationDate();

        // Se já enviou hoje, não envia de novo
        if (lastSent === todayStr) return;

        // Verifica se está na hora (com margem de 1 minuto para garantir que pegue)
        if (currentTime === settings.notificationTime) {
            // Verifica se já trabalhou hoje para não mandar alerta desnecessário
            const entries = getWorkEntries();
            const hasEntryToday = entries.some(e => e.date === todayStr && e.status !== WorkStatus.EXTRA_SERVICE);

            if (!hasEntryToday) {
                if (Notification.permission === 'granted') {
                    new Notification("Hora de registrar!", {
                        body: "Você ainda não marcou seu dia de trabalho hoje. Clique para registrar.",
                        icon: "https://cdn-icons-png.flaticon.com/512/2910/2910768.png" // Ícone genérico de calendário
                    });
                    setLastNotificationDate(todayStr);
                }
            } else {
                 // Se já tem registro, marca como 'enviado' para não checar mais hoje
                 setLastNotificationDate(todayStr);
            }
        }
    };

    // Checa a cada 30 segundos
    const intervalId = setInterval(checkNotification, 30000);
    return () => clearInterval(intervalId);
  }, [settings, session]);

  const handleDataUpdate = () => setDataVersion(prev => prev + 1);
  const handleSettingsUpdate = (newSettings: UserSettings) => {
    setSettings(newSettings);
    handleDataUpdate();
  };
  const handleEditEntry = (date: string) => {
    setDateToEdit(date);
    setActiveTab('home');
  };
  
  const handleLogout = async () => {
    // 1. Limpa dados locais para evitar que o próximo usuário veja dados deste usuário
    clearLocalData();
    
    // 2. Limpa sessão
    setSession(null); 
    try {
        await supabase.auth.signOut();
    } catch (error) {
        console.error("Erro silencioso ao sair:", error);
    }
  };

  if (loadingSession || isSyncing) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
              {isSyncing && <div className="text-violet-600 font-medium flex items-center gap-2 animate-pulse"><CloudDownload className="w-5 h-5"/> Sincronizando dados...</div>}
          </div>
      );
  }

  if (!session) {
      return <AuthPage />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'home': return <HomeTab settings={settings} onUpdate={handleDataUpdate} initialDate={dateToEdit} onClearInitialDate={() => setDateToEdit(null)} />;
      case 'advances': return <AdvancesTab onUpdate={handleDataUpdate} />;
      case 'reports': return <ReportsTab settings={settings} onEdit={handleEditEntry} dataVersion={dataVersion} />;
      case 'settings': return <SettingsTab settings={settings} onSave={handleSettingsUpdate} onLogout={handleLogout} />;
      case 'expenses': return <ExpensesTab onUpdate={handleDataUpdate} />; // Added ExpensesTab
      default: return null;
    }
  };

  const NavButton: React.FC<{ tabName: Tab; icon: React.ElementType; label: string }> = ({ tabName, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`flex flex-col items-center p-2 rounded-xl transition-all w-1/5 ${
        activeTab === tabName 
          ? 'text-violet-600 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-300 font-bold scale-105' 
          : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
      }`}
    >
      <Icon className={`w-6 h-6 mb-1 ${activeTab === tabName ? 'stroke-[2.5px]' : ''}`} />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* Top Decorative Bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 fixed top-0 z-50"></div>
      
      <main className="flex-1 p-4 pb-24 max-w-md mx-auto w-full mt-2">{renderTab()}</main>
      
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-3 z-50 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <NavButton tabName="home" icon={Home} label="Registro" />
          <NavButton tabName="advances" icon={DollarSign} label="Vales" />
           <NavButton tabName="expenses" icon={({className}) => (
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
           )} label="Despesas" />
          <NavButton tabName="reports" icon={FileBarChart} label="Relatórios" />
          <NavButton tabName="settings" icon={Settings} label="Ajustes" />
        </div>
      </nav>
    </div>
  );
};

export default App;