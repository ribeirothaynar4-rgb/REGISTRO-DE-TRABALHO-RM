
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
    <div className="space-y-5 animate-in fade-in duration-500">
      <header className="mb-2">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400">
          Registro Diário
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium">Marque seu dia de trabalho ou serviço</p>
      </header>

      {/* CALENDÁRIO PRINCIPAL - Só aparece se NÃO for serviço extra */}
      {status !== WorkStatus.EXTRA_SERVICE && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-1">
            <div className="flex flex-col p-4 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-900/50 rounded-xl">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Data do Registro</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <CalendarIcon className="h-6 w-6 text-violet-500" />
                </div>
                <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="block w-full pl-12 pr-3 py-3 bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent text-slate-900 dark:text-white text-lg font-bold shadow-sm"
                />
            </div>
            <p className="text-center text-violet-600 dark:text-violet-300 capitalize font-semibold mt-3 text-sm">
                {formattedDateDisplay}
            </p>
            </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* Full Day */}
        <button
          onClick={() => setStatus(WorkStatus.WORKED)}
          className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center space-y-2 transition-all duration-300 ${
            status === WorkStatus.WORKED
              ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-700 shadow-lg shadow-emerald-100 transform scale-[1.02] dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-500 dark:shadow-none'
              : 'border-slate-100 bg-white text-slate-500 hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <div className={`p-3 rounded-full ${status === WorkStatus.WORKED ? 'bg-emerald-200/50' : 'bg-slate-100 dark:bg-slate-800'} transition-colors`}>
             <CheckCircle className={`w-7 h-7 ${status === WorkStatus.WORKED ? 'fill-emerald-600 text-white' : ''}`} />
          </div>
          <span className="font-bold text-base">Dia Inteiro</span>
          <span className="text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 px-3 py-1 rounded-full">
            + R$ {settings.dailyRate}
          </span>
        </button>

        {/* Half Day */}
        <button
          onClick={() => setStatus(WorkStatus.HALF_DAY)}
          className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center space-y-2 transition-all duration-300 ${
            status === WorkStatus.HALF_DAY
              ? 'border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 text-amber-700 shadow-lg shadow-amber-100 transform scale-[1.02] dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-500 dark:shadow-none'
              : 'border-slate-100 bg-white text-slate-500 hover:border-amber-200 hover:bg-amber-50/50 hover:text-amber-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
           <div className={`p-3 rounded-full ${status === WorkStatus.HALF_DAY ? 'bg-amber-200/50' : 'bg-slate-100 dark:bg-slate-800'} transition-colors`}>
             <Clock className={`w-7 h-7 ${status === WorkStatus.HALF_DAY ? 'fill-amber-500 text-white' : ''}`} />
           </div>
          <span className="font-bold text-base">Meio Período</span>
          <span className="text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-3 py-1 rounded-full">
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
          className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center space-y-2 transition-all duration-300 ${
            status === WorkStatus.DAY_OFF
              ? 'border-slate-400 bg-slate-100 text-slate-700 shadow-md transform scale-[1.02] dark:bg-slate-800 dark:text-slate-200 dark:border-slate-500'
              : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
           <div className={`p-3 rounded-full ${status === WorkStatus.DAY_OFF ? 'bg-slate-200' : 'bg-slate-100 dark:bg-slate-800'} transition-colors`}>
             <Coffee className={`w-7 h-7 ${status === WorkStatus.DAY_OFF ? 'fill-slate-500 text-white' : ''}`} />
           </div>
          <span className="font-bold text-base">Folga</span>
          <span className="text-xs font-bold bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 px-3 py-1 rounded-full">
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
          className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center space-y-2 transition-all duration-300 ${
            status === WorkStatus.MISSED
              ? 'border-rose-400 bg-rose-50 text-rose-700 shadow-lg shadow-rose-100 transform scale-[1.02] dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-500 dark:shadow-none'
              : 'border-slate-100 bg-white text-slate-500 hover:border-rose-200 hover:bg-rose-50/50 hover:text-rose-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
           <div className={`p-3 rounded-full ${status === WorkStatus.MISSED ? 'bg-rose-200/50' : 'bg-slate-100 dark:bg-slate-800'} transition-colors`}>
              <XCircle className={`w-7 h-7 ${status === WorkStatus.MISSED ? 'fill-rose-500 text-white' : ''}`} />
           </div>
          <span className="font-bold text-base">Falta</span>
          <span className="text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200 px-3 py-1 rounded-full">
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
          className={`col-span-2 p-4 rounded-2xl border-2 flex flex-row items-center justify-center space-x-4 transition-all duration-300 ${
            status === WorkStatus.EXTRA_SERVICE
              ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-lg shadow-violet-100 transform scale-[1.02] dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-500 dark:shadow-none'
              : 'border-violet-100 bg-gradient-to-r from-violet-50/50 to-indigo-50/50 text-violet-600 hover:border-violet-300 dark:bg-slate-900 dark:border-slate-800 dark:text-violet-400'
          }`}
        >
          <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm">
             <Hammer className={`w-6 h-6 ${status === WorkStatus.EXTRA_SERVICE ? 'fill-violet-500 text-violet-600' : 'text-violet-500'}`} />
          </div>
          <div className="text-left">
             <span className="font-bold text-base block">Adicionar Serviço Extra</span>
             <span className="text-xs opacity-80">Instalações, reparos ou trabalhos fora da diária</span>
          </div>
        </button>
      </div>

      {/* EXTRA SERVICE FORM - Only show if Extra Service is selected */}
      {status === WorkStatus.EXTRA_SERVICE && (
         <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <Card className="bg-gradient-to-br from-violet-50 to-white border-violet-200 shadow-lg dark:bg-violet-950/30 dark:border-violet-900 dark:from-slate-900 dark:to-slate-900">
                <div className="flex items-center space-x-3 mb-3 border-b border-violet-100 dark:border-violet-900 pb-3">
                    <div className="bg-violet-100 dark:bg-violet-900 p-2 rounded-full">
                      <Hammer className="w-5 h-5 text-violet-600 dark:text-violet-300" />
                    </div>
                    <label className="block text-sm font-bold text-violet-800 dark:text-violet-200">Detalhes do Serviço Extra</label>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-violet-600 dark:text-violet-400 mb-1 tracking-wide">Nome do Serviço</label>
                        <input
                            type="text"
                            value={serviceTitle}
                            onChange={(e) => setServiceTitle(e.target.value)}
                            placeholder="Ex: Instalação de Portão, Pintura..."
                            className="block w-full p-3 border-2 border-violet-100 dark:border-violet-900 rounded-xl focus:ring-violet-500 focus:border-violet-500 bg-white dark:bg-slate-950 text-violet-900 dark:text-white placeholder-violet-300 shadow-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-violet-600 dark:text-violet-400 mb-1 tracking-wide">Valor Combinado</label>
                        <div className="relative">
                             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-violet-500 font-bold">R$</span>
                            </div>
                            <input
                                type="number"
                                value={serviceValue}
                                onChange={(e) => setServiceValue(e.target.value)}
                                placeholder="0.00"
                                className="block w-full pl-10 p-3 border-2 border-violet-100 dark:border-violet-900 rounded-xl focus:ring-violet-500 focus:border-violet-500 bg-white dark:bg-slate-950 text-lg font-bold text-violet-900 dark:text-white placeholder-violet-200 shadow-sm"
                            />
                        </div>
                    </div>
                     {/* Data movida para cá - visualmente desvinculada do "Calendário de Presença" */}
                    <div>
                        <label className="block text-xs font-bold uppercase text-violet-600 dark:text-violet-400 mb-1 tracking-wide">Data de Referência</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="block w-full p-3 border-2 border-violet-100 dark:border-violet-900 rounded-xl focus:ring-violet-500 focus:border-violet-500 bg-white dark:bg-slate-950 text-violet-900 dark:text-white placeholder-violet-300 shadow-sm"
                        />
                    </div>
                </div>
            </Card>
         </div>
      )}

      {/* Overtime Section - Only show if worked or half day */}
      {(status === WorkStatus.WORKED || status === WorkStatus.HALF_DAY) && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200 shadow-md dark:bg-blue-950/30 dark:border-blue-900 dark:from-slate-900 dark:to-slate-900">
                <div className="flex items-center space-x-3 mb-3 border-b border-blue-100 dark:border-blue-900 pb-3">
                    <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full">
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
                    className="block w-full pl-10 p-3 border-2 border-blue-100 dark:border-blue-800 rounded-xl focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-950 text-lg font-bold text-blue-900 dark:text-white placeholder-blue-200 shadow-sm"
                    />
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium">
                    Valor a receber <strong>além</strong> da diária.
                </p>
            </Card>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Observação (Opcional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Detalhes adicionais..."
          className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-slate-50 dark:bg-slate-950 dark:text-white transition-shadow"
          rows={3}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={!status}
        className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center space-x-3 shadow-xl transition-all duration-300 transform active:scale-95 ${
          isSaved
            ? 'bg-emerald-500 text-white ring-4 ring-emerald-200'
            : status
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-violet-200 shadow-violet-100/50'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
        }`}
      >
        {isSaved ? (
          <>
            <CheckCircle className="w-7 h-7 animate-bounce" />
            <span>{status === WorkStatus.EXTRA_SERVICE ? 'Adicionado!' : 'Salvo!'}</span>
          </>
        ) : (
          <>
            <Save className="w-6 h-6" />
            <span>
                {status === WorkStatus.EXTRA_SERVICE 
                    ? 'Adicionar Serviço' 
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
