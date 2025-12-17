import React, { useState, useRef, useEffect } from 'react';
import { UserSettings } from '../types';
import { saveSettings, exportAllData, importAllData, generateTestData } from '../services/storageService';
import { Card } from './ui/Card';
import { User, DollarSign, Briefcase, Download, Upload, Database, AlertTriangle, Wand2, Sun, Moon, Bell, Clock, Code, LogOut, Loader2, CalendarCheck, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';

interface SettingsTabProps {
  settings: UserSettings;
  onSave: (newSettings: UserSettings) => void;
  onLogout: () => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onSave, onLogout }) => {
  const [formData, setFormData] = useState<UserSettings>(settings);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const handleChange = (field: keyof UserSettings, value: any) => {
    const newSettings = { ...formData, [field]: value };
    setFormData(newSettings);
    if (field === 'theme') {
       onSave(newSettings);
       saveSettings(newSettings);
    }
  };

  const handleNotificationToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;

    if (isChecked) {
        if (!('Notification' in window)) {
            alert("Este navegador não suporta notificações.");
            return;
        }

        if (Notification.permission === 'granted') {
            handleChange('notificationEnabled', true);
        } else {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
            if (permission === 'granted') {
                handleChange('notificationEnabled', true);
            } else {
                alert("Você precisa permitir notificações nas configurações do navegador para usar este recurso.");
                handleChange('notificationEnabled', false);
            }
        }
    } else {
        handleChange('notificationEnabled', false);
    }
  };

  const handleSave = () => {
    saveSettings(formData);
    onSave(formData);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleLogoutClick = () => {
    // Ação direta sem confirmação para evitar bloqueios de UI em mobile
    onLogout();
  };

  const handleResetCycle = () => {
     if(confirm("Deseja iniciar um novo ciclo de pagamentos a partir de HOJE? \n\nO saldo na aba Relatórios começará a ser contado desta data em diante.")) {
         const todayStr = format(new Date(), 'yyyy-MM-dd');
         handleChange('billingCycleStartDate', todayStr);
         // Auto-save para garantir
         const newSettings = { ...formData, billingCycleStartDate: todayStr };
         saveSettings(newSettings);
         onSave(newSettings);
         alert(`Novo ciclo iniciado em ${format(new Date(), 'dd/MM/yyyy')}!`);
     }
  }

  const handleExport = () => {
    const data = exportAllData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    link.href = url;
    link.download = `backup_registro_trabalho_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => {
    if (!isImporting) {
        fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      
      // Agora espera o Supabase salvar antes de recarregar
      const success = await importAllData(content);

      if (success) {
        const updatedSettings = JSON.parse(content).settings;
        setFormData(updatedSettings);
        onSave(updatedSettings);
        alert("Dados restaurados com sucesso! O aplicativo será recarregado.");
        window.location.reload(); 
      } else {
        alert("Erro: Arquivo inválido ou corrompido.");
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleGenerateDemoData = () => {
    if (confirm("Atenção: Isso irá APAGAR todos os dados atuais e preencher com dados de exemplo. Deseja continuar?")) {
      generateTestData();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <header className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Configurações</h1>
            <p className="text-slate-500 dark:text-slate-400">Seus dados e preferências</p>
        </div>
        <button 
            type="button"
            onClick={handleLogoutClick}
            className="shrink-0 p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-rose-100 hover:text-rose-600 transition-colors cursor-pointer active:scale-95"
            title="Sair do Aplicativo"
        >
            <LogOut className="w-6 h-6" />
        </button>
      </header>

      {/* NOVO CARD: FECHAMENTO DE CICLO */}
      <Card title="Ciclo de Pagamento / Fechamento" className="border-emerald-200 dark:border-emerald-900">
        <div className="flex items-start space-x-4">
            <div className="bg-emerald-100 dark:bg-emerald-900 p-2.5 rounded-full">
                <RotateCcw className="w-6 h-6 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div className="flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                   Use isto quando receber um pagamento para <strong>zerar o saldo</strong> e começar a contar de novo, sem apagar o histórico.
                </p>
                
                <div className="mb-4">
                   <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1 uppercase">Início do Ciclo Atual</label>
                   <input 
                      type="date"
                      value={formData.billingCycleStartDate || ''}
                      onChange={(e) => handleChange('billingCycleStartDate', e.target.value)}
                      className="w-full p-2 border-2 border-emerald-100 dark:border-emerald-800 rounded-xl bg-white dark:bg-slate-950 font-bold text-slate-800 dark:text-white"
                   />
                </div>

                <button 
                    onClick={handleResetCycle}
                    className="w-full py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                >
                    <CalendarCheck className="w-4 h-4" />
                    Recebi hoje! Reiniciar Saldo
                </button>
            </div>
        </div>
      </Card>

      <Card title="Notificações" className="border-violet-200 dark:border-violet-900">
        <div className="flex items-start space-x-4">
            <div className="bg-violet-100 dark:bg-violet-900 p-2.5 rounded-full">
                <Bell className="w-6 h-6 text-violet-600 dark:text-violet-300" />
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-slate-800 dark:text-white font-bold text-base" htmlFor="notif-toggle">
                        Lembrete Diário
                    </label>
                    <div className="relative inline-block w-12 h-6 align-middle select-none transition duration-200 ease-in">
                        <input 
                            type="checkbox" 
                            name="toggle" 
                            id="notif-toggle" 
                            checked={formData.notificationEnabled}
                            onChange={handleNotificationToggle}
                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-300 ease-in-out checked:right-0 checked:border-emerald-500 right-6 border-slate-300"
                        />
                        <label 
                            htmlFor="notif-toggle" 
                            className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-300 ${formData.notificationEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                        ></label>
                    </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Receba um aviso no celular para não esquecer de marcar o ponto.
                </p>

                {formData.notificationEnabled && (
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm font-bold">Horário do aviso:</span>
                        </div>
                        <input 
                            type="time" 
                            value={formData.notificationTime} 
                            onChange={(e) => handleChange('notificationTime', e.target.value)}
                            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none"
                        />
                    </div>
                )}
                
                {formData.notificationEnabled && notificationPermission === 'denied' && (
                     <p className="text-xs text-rose-500 mt-2 font-bold">
                        ⚠️ Permissão negada no navegador. Habilite nas configurações do site.
                     </p>
                )}
            </div>
        </div>
      </Card>

      <Card title="Aparência">
        <div className="grid grid-cols-2 gap-4">
            <button onClick={() => handleChange('theme', 'light')} className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${formData.theme === 'light' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 dark:border-slate-700'}`}><Sun className="w-8 h-8 mb-2" /><span>Tema Claro</span></button>
            <button onClick={() => handleChange('theme', 'dark')} className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${formData.theme === 'dark' ? 'border-blue-500 bg-slate-800 text-blue-400' : 'border-slate-200 dark:border-slate-700'}`}><Moon className="w-8 h-8 mb-2" /><span>Tema Escuro</span></button>
        </div>
      </Card>

      <Card title="Valores">
        <div className="space-y-4">
           <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valor da Diária (R$)</label>
            <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><DollarSign className="h-5 w-5 text-slate-400" /></div><input type="number" value={formData.dailyRate} onChange={(e) => handleChange('dailyRate', parseFloat(e.target.value) || 0)} className="block w-full pl-10 p-3 border border-slate-300 dark:border-slate-700 rounded-lg" /></div>
           </div>
        </div>
      </Card>

      <Card title="Dados para o Relatório">
        <div className="space-y-4">
           <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Seu Nome Completo</label>
            <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><User className="h-5 w-5 text-slate-400" /></div><input type="text" value={formData.workerName} onChange={(e) => handleChange('workerName', e.target.value)} placeholder="Ex: João da Silva" className="block w-full pl-10 p-3 border border-slate-300 dark:border-slate-700 rounded-lg" /></div>
           </div>
           <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Patrão / Empresa</label>
             <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Briefcase className="h-5 w-5 text-slate-400" /></div><input type="text" value={formData.employerName} onChange={(e) => handleChange('employerName', e.target.value)} placeholder="Ex: Construtora ABC" className="block w-full pl-10 p-3 border border-slate-300 dark:border-slate-700 rounded-lg" /></div>
           </div>
        </div>
      </Card>

      <button onClick={handleSave} className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-violet-200 dark:shadow-none">{showSuccess ? 'Configurações Salvas!' : 'Salvar Alterações'}</button>

      <div className="border-t border-slate-200 dark:border-slate-800 my-6 pt-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Database className="w-5 h-5" />Backup e Restauração</h2>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 p-4 mb-4 flex gap-3"><AlertTriangle className="w-5 h-5 text-amber-600" /><div className="text-sm text-amber-900 dark:text-amber-300"><p className="font-bold">Atenção:</p><p>Seus dados ficam salvos neste dispositivo. Faça backup para não perdê-los.</p></div></div>
          <div className="grid grid-cols-2 gap-4">
              <button onClick={handleExport} className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 border rounded-xl hover:bg-slate-50 transition-colors"><Download className="w-8 h-8 text-blue-600 mb-2" /><span>Baixar Backup</span></button>
              <button 
                onClick={handleImportClick} 
                disabled={isImporting}
                className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 border rounded-xl hover:bg-slate-50 transition-colors relative"
              >
                  {isImporting ? (
                      <>
                        <Loader2 className="w-8 h-8 text-violet-600 mb-2 animate-spin" />
                        <span>Restaurando...</span>
                      </>
                  ) : (
                      <>
                        <Upload className="w-8 h-8 text-green-600 mb-2" />
                        <span>Restaurar</span>
                      </>
                  )}
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
              </button>
          </div>
          <div className="mt-6 pt-6 border-t dark:border-slate-800">
            <button onClick={handleGenerateDemoData} className="w-full flex items-center justify-center space-x-2 p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg text-sm font-medium"><Wand2 className="w-4 h-4" /><span>Preencher com Dados de Teste</span></button>
          </div>
      </div>

      <div className="mt-8 mb-4 flex flex-col items-center justify-center opacity-80">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-600 font-medium">
             <Code className="w-3 h-3" />
             <span>Desenvolvido por</span>
             <span className="text-violet-600 dark:text-violet-400 font-bold">Roniel N.</span>
        </div>
        <p className="text-[10px] text-slate-300 dark:text-slate-700 mt-1">Meu Registro de Trabalho v1.3</p>
      </div>
    </div>
  );
};

export default SettingsTab;