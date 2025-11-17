import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, CheckCircle, XCircle, Save, Clock, PlusCircle, Hammer, Coffee } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { WorkEntry, WorkStatus, UserSettings } from '../types';
import { saveWorkEntry, getWorkEntries } from '../services/storageService';
import { Card } from './ui/Card';

interface HomeTabProps {
  settings: UserSettings;
  onUpdate: () => void;
  initialDate?: string | null;
  onClearInitialDate?: () => void;
}

const HomeTab: React.FC<HomeTabProps> = ({ settings, onUpdate, initialDate, onClearInitialDate }) => {
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [status, setStatus] = useState<WorkStatus | null>(null);
  const [note, setNote] = useState('');
  const [overtime, setOvertime] = useState('');
  
  // Novos estados para Serviço Extra
  const [serviceTitle, setServiceTitle] = useState('');
  const [serviceValue, setServiceValue] = useState('');

  const [isSaved, setIsSaved] = useState(false);
  const [hasExistingEntry, setHasExistingEntry] = useState(false);

  // Se receber uma data para editar vinda do relatório, atualiza o estado
  useEffect(() => {
    if (initialDate) {
        setSelectedDate(initialDate);
        if (onClearInitialDate) {
            onClearInitialDate();
        }
    }
  }, [initialDate, onClearInitialDate]);

  // Load existing entry for selected date
  useEffect(() => {
    // Só busca registro existente se NÃO for serviço extra (pois serviço extra não vincula com dia único)
    if (status === WorkStatus.EXTRA_SERVICE) {
        setHasExistingEntry(false);
        return;
    }

    const entries = getWorkEntries();
    const entry = entries.find(e => e.date === selectedDate);
    
    // Se encontrar um registro que NÃO seja serviço extra na data selecionada
    if (entry && entry.status !== WorkStatus.EXTRA_SERVICE) {
      setStatus(entry.status);
      setNote(entry.note || '');
      setOvertime(entry.overtimeValue ? entry.overtimeValue.toString() : '');
      setHasExistingEntry(true);
    } else if (!entry) {
      // Se não tiver registro, e o status atual não for extra, limpa (mas mantém se usuário acabou de clicar no botão)
       if (status !== WorkStatus.EXTRA_SERVICE && status !== null && !isSaved) {
          // Mantém o status que o usuário clicou
       } else if (!isSaved) {
          setStatus(null);
          setNote('');
          setOvertime('');
       }
       setHasExistingEntry(false);
    }
    setIsSaved(false);
  }, [selectedDate]); // Removemos 'status' da dependência para evitar loop, controlamos na lógica interna

  const handleSave = () => {
    if (!status) return;

    let rateToSave = settings.dailyRate;
    
    // Se for serviço extra, o valor do snapshot é o valor digitado
    if (status === WorkStatus.EXTRA_SERVICE) {
        if (!serviceValue) {
            alert("Por favor, digite o valor do serviço.");
            return;
        }
        rateToSave = parseFloat(serviceValue);
    }

    const entry: WorkEntry = {
      id: status === WorkStatus.EXTRA_SERVICE ? Date.now().toString() : selectedDate, // ID único para serviços
      date: selectedDate,
      status,
      note,
      dailyRateSnapshot: rateToSave,
      overtimeValue: (status === WorkStatus.WORKED || status === WorkStatus.HALF_DAY) && overtime ? parseFloat(overtime) : undefined,
      serviceTitle: status === WorkStatus.EXTRA_SERVICE ? serviceTitle : undefined
    };

    saveWorkEntry(entry);
    setIsSaved(true);
    
    if (status !== WorkStatus.EXTRA_SERVICE) {
        setHasExistingEntry(true);
    } else {
        // Se for serviço extra, limpa os campos para permitir adicionar outro
        setServiceTitle('');
        setServiceValue('');
        setNote('');
        // Não alteramos isHasExistingEntry, mantemos como false para indicar "Adição"
    }

    onUpdate();
    
    setTimeout(() => setIsSaved(false), 2000);
  };

  // FIX: Adiciona T00:00:00 para garantir a interpretação do fuso horário local em vez de UTC
  const formattedDateDisplay = format(new Date(selectedDate + 'T00:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Registro Diário</h1>
        <p className="text-slate-500 dark:text-slate-400">Marque seu dia de trabalho ou serviço</p>
      </header>

      {/* CALENDÁRIO PRINCIPAL - Só aparece se NÃO for serviço extra */}
      {status !== WorkStatus.EXTRA_SERVICE && (
        <Card>
            <div className="flex flex-col space-y-4">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Data do Registro</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <CalendarIcon className="h-5 w-5 text-slate-400" />
                </div>
                <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-white dark:bg-slate-950 text-lg"
                />
            </div>
            <p className="text-center text-slate-600 dark:text-slate-300 capitalize font-medium bg-slate-50 dark:bg-slate-900 p-2 rounded-md">
                {formattedDateDisplay}
            </p>
            </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* Full Day */}
        <button
          onClick={() => setStatus(WorkStatus.WORKED)}
          className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${
            status === WorkStatus.WORKED
              ? 'border-green-600 bg-green-50 text-green-700 shadow-md transform scale-105 ring-2 ring-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-500'
              : 'border-slate-200 bg-white text-slate-500 hover:border-green-300 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
          }`}
        >
          <CheckCircle className={`w-8 h-8 ${status === WorkStatus.WORKED ? 'fill-current' : ''}`} />
          <span className="font-bold text-base">Dia Inteiro</span>
          <span className="text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded-full">
            + R$ {settings.dailyRate}
          </span>
        </button>

        {/* Half Day */}
        <button
          onClick={() => setStatus(WorkStatus.HALF_DAY)}
          className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${
            status === WorkStatus.HALF_DAY
              ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-md transform scale-105 ring-2 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-500'
              : 'border-slate-200 bg-white text-slate-500 hover:border-amber-300 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
          }`}
        >
          <Clock className={`w-8 h-8 ${status === WorkStatus.HALF_DAY ? 'fill-current' : ''}`} />
          <span className="font-bold text-base">Meio Período</span>
          <span className="text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full">
            + R$ {settings.dailyRate / 2}
          </span>
        </button>

        {/* Day Off (Folga) */}
        <button
          onClick={() => {
            setStatus(WorkStatus.DAY_OFF);
            setOvertime('');
            setServiceValue('');
            setServiceTitle('');
          }}
          className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${
            status === WorkStatus.DAY_OFF
              ? 'border-slate-500 bg-slate-100 text-slate-700 shadow-md transform scale-105 ring-2 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-400'
              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
          }`}
        >
          <Coffee className={`w-8 h-8 ${status === WorkStatus.DAY_OFF ? 'fill-current' : ''}`} />
          <span className="font-bold text-base">Folga</span>
          <span className="text-xs font-medium bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full">
            R$ 0,00
          </span>
        </button>

        {/* Missed */}
        <button
          onClick={() => {
            setStatus(WorkStatus.MISSED);
            setOvertime(''); 
            setServiceValue('');
            setServiceTitle('');
          }}
          className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${
            status === WorkStatus.MISSED
              ? 'border-red-600 bg-red-50 text-red-700 shadow-md transform scale-105 ring-2 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-500'
              : 'border-slate-200 bg-white text-slate-500 hover:border-red-300 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
          }`}
        >
          <XCircle className={`w-8 h-8 ${status === WorkStatus.MISSED ? 'fill-current' : ''}`} />
          <span className="font-bold text-base">Falta</span>
          <span className="text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-2 py-0.5 rounded-full">
            R$ 0,00
          </span>
        </button>

        {/* Extra Service - Full Width Row */}
        <button
          onClick={() => {
              setStatus(WorkStatus.EXTRA_SERVICE);
              // Resetar campos para garantir que não edite o dia
              setHasExistingEntry(false); 
          }}
          className={`col-span-2 p-4 rounded-xl border-2 flex flex-row items-center justify-center space-x-3 transition-all ${
            status === WorkStatus.EXTRA_SERVICE
              ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md transform scale-[1.02] ring-2 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-500'
              : 'border-indigo-100 bg-indigo-50/50 text-indigo-600 hover:border-indigo-300 dark:bg-slate-900 dark:border-slate-800 dark:text-indigo-400'
          }`}
        >
          <Hammer className={`w-6 h-6 ${status === WorkStatus.EXTRA_SERVICE ? 'fill-current' : ''}`} />
          <div className="text-left">
             <span className="font-bold text-base block">Adicionar Serviço Extra</span>
             <span className="text-xs opacity-80">Instalações, reparos ou trabalhos fora da diária</span>
          </div>
        </button>
      </div>

      {/* EXTRA SERVICE FORM - Only show if Extra Service is selected */}
      {status === WorkStatus.EXTRA_SERVICE && (
         <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <Card className="bg-indigo-50 border-indigo-200 shadow-md dark:bg-indigo-950/30 dark:border-indigo-900">
                <div className="flex items-center space-x-3 mb-3 border-b border-indigo-200 dark:border-indigo-900 pb-2">
                    <div className="bg-indigo-100 dark:bg-indigo-900 p-1.5 rounded-full">
                      <Hammer className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                    </div>
                    <label className="block text-sm font-bold text-indigo-800 dark:text-indigo-200">Novo Serviço Extra</label>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-indigo-800 dark:text-indigo-300 mb-1">Nome do Serviço (Obrigatório)</label>
                        <input
                            type="text"
                            value={serviceTitle}
                            onChange={(e) => setServiceTitle(e.target.value)}
                            placeholder="Ex: Instalação de Portão, Pintura..."
                            className="block w-full p-3 border border-indigo-300 dark:border-indigo-700 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-indigo-900 dark:text-white placeholder-indigo-300"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-indigo-800 dark:text-indigo-300 mb-1">Valor Combinado (R$)</label>
                        <div className="relative">
                             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-indigo-500 font-bold">R$</span>
                            </div>
                            <input
                                type="number"
                                value={serviceValue}
                                onChange={(e) => setServiceValue(e.target.value)}
                                placeholder="0.00"
                                className="block w-full pl-10 p-3 border border-indigo-300 dark:border-indigo-700 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-lg font-semibold text-indigo-900 dark:text-white placeholder-indigo-200"
                            />
                        </div>
                    </div>
                     {/* Data movida para cá - visualmente desvinculada do "Calendário de Presença" */}
                    <div>
                        <label className="block text-xs font-medium text-indigo-800 dark:text-indigo-300 mb-1">Data de Referência</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="block w-full p-3 border border-indigo-300 dark:border-indigo-700 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-indigo-900 dark:text-white placeholder-indigo-300"
                        />
                    </div>
                </div>
            </Card>
         </div>
      )}

      {/* Overtime Section - Only show if worked or half day */}
      {(status === WorkStatus.WORKED || status === WorkStatus.HALF_DAY) && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <Card className="bg-blue-50 border-blue-200 shadow-md dark:bg-blue-950/30 dark:border-blue-900">
                <div className="flex items-center space-x-3 mb-3 border-b border-blue-200 dark:border-blue-900 pb-2">
                    <div className="bg-blue-100 dark:bg-blue-900 p-1.5 rounded-full">
                      <PlusCircle className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                    </div>
                    <label className="block text-sm font-bold text-blue-800 dark:text-blue-200">Horas Extras (Opcional)</label>
                </div>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-blue-500 font-bold">R$</span>
                    </div>
                    <input
                    type="number"
                    value={overtime}
                    onChange={(e) => setOvertime(e.target.value)}
                    placeholder="0.00"
                    className="block w-full pl-10 p-3 border border-blue-300 dark:border-blue-700 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-lg font-semibold text-blue-900 dark:text-white placeholder-blue-200"
                    />
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    Valor a receber <strong>além</strong> da diária.
                </p>
            </Card>
        </div>
      )}

      <Card>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Observação (Opcional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Detalhes adicionais..."
          className="w-full p-3 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-950 dark:text-white"
          rows={3}
        />
      </Card>

      <button
        onClick={handleSave}
        disabled={!status}
        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-2 shadow-lg transition-all ${
          isSaved
            ? 'bg-green-600 text-white'
            : status
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
        }`}
      >
        {isSaved ? (
          <>
            <CheckCircle className="w-6 h-6" />
            <span>{status === WorkStatus.EXTRA_SERVICE ? 'Serviço Adicionado!' : 'Salvo com Sucesso!'}</span>
          </>
        ) : (
          <>
            <Save className="w-6 h-6" />
            <span>
                {status === WorkStatus.EXTRA_SERVICE 
                    ? 'Adicionar Serviço Novo' 
                    : (hasExistingEntry ? 'Atualizar Registro' : 'Salvar Registro')
                }
            </span>
          </>
        )}
      </button>
    </div>
  );
};

export default HomeTab;
