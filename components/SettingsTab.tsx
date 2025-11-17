import React, { useState, useRef } from 'react';
import { UserSettings } from '../types';
import { saveSettings, exportAllData, importAllData, generateTestData } from '../services/storageService';
import { Card } from './ui/Card';
import { User, DollarSign, Briefcase, Download, Upload, Database, AlertTriangle, Wand2, Sun, Moon } from 'lucide-react';
import { format } from 'date-fns';

interface SettingsTabProps {
  settings: UserSettings;
  onSave: (newSettings: UserSettings) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onSave }) => {
  const [formData, setFormData] = useState<UserSettings>(settings);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: keyof UserSettings, value: string | number) => {
    const newSettings = { ...formData, [field]: value };
    setFormData(newSettings);
    if (field === 'theme') {
       onSave(newSettings);
       saveSettings(newSettings);
    }
  };

  const handleSave = () => {
    saveSettings(formData);
    onSave(formData);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

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
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (importAllData(content)) {
        const updatedSettings = JSON.parse(content).settings;
        setFormData(updatedSettings);
        onSave(updatedSettings);
        alert("Dados restaurados com sucesso!");
        setTimeout(() => window.location.reload(), 500); // Recarrega para refletir em todo app
      } else {
        alert("Erro: Arquivo inválido ou corrompido.");
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
      <header>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Configurações</h1>
        <p className="text-slate-500 dark:text-slate-400">Seus dados e preferências</p>
      </header>

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

      <button onClick={handleSave} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg">{showSuccess ? 'Configurações Salvas!' : 'Salvar Alterações'}</button>

      <div className="border-t border-slate-200 dark:border-slate-800 my-6 pt-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Database className="w-5 h-5" />Backup e Restauração</h2>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 p-4 mb-4 flex gap-3"><AlertTriangle className="w-5 h-5 text-amber-600" /><div className="text-sm text-amber-900 dark:text-amber-300"><p className="font-bold">Atenção:</p><p>Seus dados ficam salvos neste dispositivo. Faça backup para não perdê-los.</p></div></div>
          <div className="grid grid-cols-2 gap-4">
              <button onClick={handleExport} className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 border rounded-xl"><Download className="w-8 h-8 text-blue-600 mb-2" /><span>Baixar Backup</span></button>
              <button onClick={handleImportClick} className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 border rounded-xl"><Upload className="w-8 h-8 text-green-600 mb-2" /><span>Restaurar</span><input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" /></button>
          </div>
          <div className="mt-6 pt-6 border-t">
            <button onClick={handleGenerateDemoData} className="w-full flex items-center justify-center space-x-2 p-3 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg"><Wand2 className="w-5 h-5" /><span>Preencher com Dados de Teste</span></button>
          </div>
      </div>
    </div>
  );
};

export default SettingsTab;
