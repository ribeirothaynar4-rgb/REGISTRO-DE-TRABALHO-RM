
import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, isSameMonth, parseISO, addMonths, subMonths, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Download, Edit, Trash2, Wallet, TrendingDown, TrendingUp, CalendarSearch, CalendarRange, Calendar } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { UserSettings, WorkEntry, WorkStatus, AdvanceEntry, MonthlyStats } from '../types';
import { getWorkEntries, getAdvances, deleteWorkEntry } from '../services/storageService';
import { Card } from './ui/Card';

interface ReportsTabProps {
  settings: UserSettings;
  onEdit: (date: string) => void;
  dataVersion: number; // For re-triggering fetches
}

type ReportMode = 'month' | 'custom';

const translateStatus = (status: WorkStatus): string => {
  switch (status) {
    case WorkStatus.WORKED: return 'Dia Inteiro';
    case WorkStatus.HALF_DAY: return 'Meio Período';
    case WorkStatus.MISSED: return 'Falta';
    case WorkStatus.DAY_OFF: return 'Folga';
    case WorkStatus.EXTRA_SERVICE: return 'Serviço Extra';
    default: return status;
  }
};

const ReportsTab: React.FC<ReportsTabProps> = ({ settings, onEdit, dataVersion }) => {
  const [reportMode, setReportMode] = useState<ReportMode>('month');
  
  // Estado para modo Mês
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

  // Estados para modo Personalizado (Padrão: últimos 30 dias)
  const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [advances, setAdvances] = useState<AdvanceEntry[]>([]);

  // Carrega dados e aplica lógica de Auto-Jump
  useEffect(() => {
    const loadedEntries = getWorkEntries();
    const loadedAdvances = getAdvances();
    setEntries(loadedEntries);
    setAdvances(loadedAdvances);

    // Auto-Jump apenas se estiver no modo mensal e no mês atual vazio
    if (reportMode === 'month' && isSameMonth(currentMonthDate, new Date())) {
        const hasDataThisMonth = loadedEntries.some(e => isSameMonth(parseISO(e.date), currentMonthDate)) || 
                                 loadedAdvances.some(a => isSameMonth(parseISO(a.date), currentMonthDate));
        
        if (!hasDataThisMonth && (loadedEntries.length > 0 || loadedAdvances.length > 0)) {
            const allDates = [
                ...loadedEntries.map(e => e.date),
                ...loadedAdvances.map(a => a.date)
            ].sort().reverse();

            if (allDates.length > 0) {
                const latestDate = parseISO(allDates[0]);
                if (!isSameMonth(latestDate, currentMonthDate)) {
                    setCurrentMonthDate(latestDate);
                }
            }
        }
    }
  }, [dataVersion]); 

  const handleDeleteEntry = (id: string) => {
    if (window.confirm("Excluir este registro?")) {
        deleteWorkEntry(id);
        setEntries(prev => prev.filter(e => e.id !== id));
    }
  };

  const { monthlyEntries, monthlyAdvances, stats, periodLabel } = useMemo(() => {
    let filteredEntries: WorkEntry[] = [];
    let filteredAdvances: AdvanceEntry[] = [];
    let periodLabel = '';

    if (reportMode === 'month') {
        filteredEntries = entries.filter(e => isSameMonth(parseISO(e.date), currentMonthDate));
        filteredAdvances = advances.filter(a => isSameMonth(parseISO(a.date), currentMonthDate));
        periodLabel = format(currentMonthDate, 'MMMM/yyyy', { locale: ptBR }).toUpperCase();
    } else {
        // Modo Customizado
        const start = startOfDay(parseISO(customStartDate));
        const end = endOfDay(parseISO(customEndDate));
        
        // Validação básica para evitar erro do date-fns se start > end
        if (start <= end) {
            filteredEntries = entries.filter(e => isWithinInterval(parseISO(e.date), { start, end }));
            filteredAdvances = advances.filter(a => isWithinInterval(parseISO(a.date), { start, end }));
        }
        periodLabel = `${format(start, 'dd/MM/yyyy')} a ${format(end, 'dd/MM/yyyy')}`;
    }

    const newStats: MonthlyStats = {
      daysWorked: 0, daysMissed: 0, grossTotal: 0, totalAdvances: 0, finalTotal: 0,
      totalFromDays: 0, totalFromOvertime: 0, totalFromExtraServices: 0,
    };

    filteredEntries.forEach(e => {
      let dayValue = 0;
      if (e.status === WorkStatus.WORKED) { newStats.daysWorked += 1; dayValue = e.dailyRateSnapshot; }
      else if (e.status === WorkStatus.HALF_DAY) { newStats.daysWorked += 0.5; dayValue = e.dailyRateSnapshot / 2; }
      else if (e.status === WorkStatus.MISSED) { newStats.daysMissed += 1; }
      else if (e.status === WorkStatus.EXTRA_SERVICE) { newStats.totalFromExtraServices += e.dailyRateSnapshot; }
      
      newStats.totalFromDays += dayValue;
      if (e.overtimeValue) { newStats.totalFromOvertime += e.overtimeValue; }
    });

    newStats.grossTotal = newStats.totalFromDays + newStats.totalFromOvertime + newStats.totalFromExtraServices;
    newStats.totalAdvances = filteredAdvances.reduce((acc, curr) => acc + curr.amount, 0);
    newStats.finalTotal = newStats.grossTotal - newStats.totalAdvances;

    return { 
        monthlyEntries: filteredEntries.sort((a,b) => a.date.localeCompare(b.date)), 
        monthlyAdvances: filteredAdvances.sort((a,b) => a.date.localeCompare(b.date)), 
        stats: newStats, 
        periodLabel 
    };
  }, [currentMonthDate, customStartDate, customEndDate, reportMode, entries, advances]);

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setTextColor(30, 41, 59); 
    
    doc.setFontSize(16);
    doc.text(`Relatório de Serviços`, 14, 20);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Período: ${periodLabel}`, 14, 26);

    doc.setTextColor(0);
    doc.setFontSize(12);
    if(settings.workerName) doc.text(`Prestador: ${settings.workerName}`, 14, 34);
    // ALTERADO AQUI: De 'Cliente' para 'Patrão'
    if(settings.employerName) doc.text(`Patrão: ${settings.employerName}`, 14, 40);
    
    let finalY = 48;

    autoTable(doc, {
        startY: finalY, head: [['Dia', 'Descrição', 'Valor']],
        body: monthlyEntries.map(e => {
            let desc = '', val = 0;
            if (e.status === WorkStatus.WORKED) { desc = 'Dia Inteiro'; val = e.dailyRateSnapshot; }
            else if (e.status === WorkStatus.HALF_DAY) { desc = 'Meio Período'; val = e.dailyRateSnapshot / 2; }
            else if (e.status === WorkStatus.EXTRA_SERVICE) { desc = e.serviceTitle || 'Serviço Extra'; val = e.dailyRateSnapshot; }
            else { desc = e.status === WorkStatus.MISSED ? 'Falta' : 'Folga'; }
            if (e.overtimeValue) { desc += ` (+H. Extra)`; val += e.overtimeValue; }
            if (e.note) desc += ` - ${e.note}`;
            return [format(parseISO(e.date), 'dd/MM'), desc, `R$ ${val.toFixed(2)}`];
        }),
        headStyles: { fillColor: [124, 58, 237] }, // Violet for table header
        alternateRowStyles: { fillColor: [245, 243, 255] }
    });
    finalY = (doc as any).lastAutoTable.finalY + 10;
    
    if (monthlyAdvances.length > 0) {
        autoTable(doc, { startY: finalY, head: [['Dia', 'Adiantamento', 'Valor']], body: monthlyAdvances.map(a => [format(parseISO(a.date), 'dd/MM'), a.note || 'Vale', `- R$ ${a.amount.toFixed(2)}`]), headStyles: { fillColor: [225, 29, 72] } }); 
        finalY = (doc as any).lastAutoTable.finalY + 10;
    }
    
    doc.setFontSize(12);
    doc.text(`Resumo Financeiro`, 14, finalY);
    finalY += 7;

    autoTable(doc, {
        startY: finalY,
        theme: 'plain',
        body: [
            [`Dias Trabalhados (${stats.daysWorked.toFixed(1)})`, `R$ ${stats.totalFromDays.toFixed(2)}`],
            [`Horas Extras`, `R$ ${stats.totalFromOvertime.toFixed(2)}`],
            [`Serviços Extras`, `R$ ${stats.totalFromExtraServices.toFixed(2)}`],
        ]
    });
    finalY = (doc as any).lastAutoTable.finalY;

    doc.setLineWidth(0.5);
    doc.setDrawColor(200);
    doc.line(14, finalY, 200, finalY);
    finalY += 7;
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Total Bruto: R$ ${stats.grossTotal.toFixed(2)}`, 14, finalY);
    doc.text(`Total Adiantamentos: - R$ ${stats.totalAdvances.toFixed(2)}`, 14, finalY + 5);
    
    finalY += 12;
    
    const finalTotalForPDF = stats.grossTotal - stats.totalAdvances;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(`LÍQUIDO A RECEBER: R$ ${finalTotalForPDF.toFixed(2)}`, 14, finalY);
    
    // Nome do arquivo seguro
    const fileName = reportMode === 'month' 
        ? `Relatorio_${format(currentMonthDate, 'MM-yyyy')}.pdf`
        : `Relatorio_${customStartDate}_ate_${customEndDate}.pdf`;

    doc.save(fileName);
  };
  
  const allItems = useMemo(() => [
        ...monthlyEntries.map(i => ({...i, itemType: 'work'})),
        ...monthlyAdvances.map(i => ({...i, itemType: 'advance'})),
    ].sort((a,b) => a.date.localeCompare(b.date)), [monthlyEntries, monthlyAdvances]);

  const goToLatest = () => {
    const allDates = [...entries.map(e => e.date), ...advances.map(a => a.date)].sort().reverse();
    if (allDates.length > 0) {
        setCurrentMonthDate(parseISO(allDates[0]));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* SELETOR DE MODO */}
      <div className="bg-white dark:bg-slate-900 p-1.5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex">
        <button 
            onClick={() => setReportMode('month')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                reportMode === 'month' 
                ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' 
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
        >
            <Calendar className="w-4 h-4" />
            Por Mês
        </button>
        <button 
            onClick={() => setReportMode('custom')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                reportMode === 'custom' 
                ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' 
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
        >
            <CalendarRange className="w-4 h-4" />
            Personalizado
        </button>
      </div>

      {/* CONTROLES DE DATA */}
      {reportMode === 'month' ? (
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 animate-in slide-in-from-left-2">
            <button onClick={() => setCurrentMonthDate(prev => subMonths(prev, 1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-violet-600"><ChevronLeft className="w-6 h-6" /></button>
            <div className="text-center">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white capitalize">{format(currentMonthDate, 'MMMM', { locale: ptBR })}</h2>
                <p className="text-xs text-slate-500 font-medium">{format(currentMonthDate, 'yyyy')}</p>
            </div>
            <button onClick={() => setCurrentMonthDate(prev => addMonths(prev, 1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-violet-600"><ChevronRight className="w-6 h-6" /></button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 animate-in slide-in-from-right-2">
            <div className="flex items-center gap-2 mb-3">
                <CalendarRange className="w-5 h-5 text-violet-600" />
                <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">Selecione o Intervalo</span>
            </div>
            <div className="flex gap-3">
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">De</label>
                    <input 
                        type="date" 
                        value={customStartDate} 
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-white"
                    />
                </div>
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Até</label>
                    <input 
                        type="date" 
                        value={customEndDate} 
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-white"
                    />
                </div>
            </div>
        </div>
      )}

      {/* CARDS DE TOTAIS */}
      <div className="grid grid-cols-2 gap-3">
          {/* Ganho Bruto */}
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-2 opacity-10"><TrendingUp className="w-12 h-12 text-emerald-600" /></div>
             <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Ganho Bruto</p>
             <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">R$ {stats.grossTotal.toFixed(2)}</p>
          </div>
          
          {/* Adiantamentos */}
          <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-2xl border border-rose-100 dark:border-rose-800 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-2 opacity-10"><TrendingDown className="w-12 h-12 text-rose-600" /></div>
             <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Vales</p>
             <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">- {stats.totalAdvances.toFixed(2)}</p>
          </div>

          {/* Líquido - Full Width */}
          <div className="col-span-2 bg-gradient-to-r from-violet-600 to-indigo-600 p-5 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none text-white relative overflow-hidden">
             <div className="absolute -right-6 -top-6 opacity-20 rounded-full bg-white w-24 h-24 blur-xl"></div>
             <div className="flex justify-between items-center relative z-10">
                <div>
                    <p className="text-xs font-bold text-indigo-100 uppercase tracking-wider mb-1">
                        Líquido ({reportMode === 'month' ? 'Mensal' : 'Período'})
                    </p>
                    <p className="text-3xl font-extrabold tracking-tight">R$ {stats.finalTotal.toFixed(2)}</p>
                </div>
                <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                    <Wallet className="w-8 h-8 text-white" />
                </div>
             </div>
          </div>
      </div>
      
      <div className="w-full">
          <button onClick={generatePDF} className="w-full flex items-center justify-center space-x-2 bg-slate-800 text-white p-4 rounded-xl hover:bg-slate-900 transition-colors shadow-lg shadow-slate-200 dark:shadow-none font-semibold"><Download className="w-5 h-5" /><span>Baixar Relatório PDF</span></button>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-500 uppercase ml-2">Histórico do Período</h3>
        
        {/* Mensagem amigável se estiver vazio */}
        {allItems.length === 0 && (
            <div className="text-center py-8 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                <CalendarSearch className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-slate-400 mb-2 text-sm font-medium">Nenhum registro encontrado.</p>
                { reportMode === 'month' && (entries.length > 0 || advances.length > 0) && (
                    <button 
                        onClick={goToLatest} 
                        className="text-violet-600 bg-violet-50 dark:bg-violet-900/30 px-4 py-2 rounded-lg text-sm font-bold hover:bg-violet-100 transition-colors"
                    >
                        Ir para registros recentes
                    </button>
                )}
            </div>
        )}

        {allItems.map(item => {
            if (item.itemType === 'work') {
                let val = 0;
                let borderColorClass = 'border-l-emerald-500';
                let textClass = 'text-emerald-700 dark:text-emerald-400';
                
                if (item.status === WorkStatus.WORKED) val = item.dailyRateSnapshot;
                else if (item.status === WorkStatus.HALF_DAY) { 
                    val = item.dailyRateSnapshot / 2; 
                    borderColorClass = 'border-l-amber-500';
                    textClass = 'text-amber-700 dark:text-amber-400';
                }
                else if (item.status === WorkStatus.EXTRA_SERVICE) { 
                    val = item.dailyRateSnapshot;
                    borderColorClass = 'border-l-violet-500';
                    textClass = 'text-violet-700 dark:text-violet-400';
                }
                else if (item.status === WorkStatus.MISSED) {
                    borderColorClass = 'border-l-rose-500';
                    textClass = 'text-rose-700 dark:text-rose-400';
                }
                else { // Day Off
                     borderColorClass = 'border-l-slate-400';
                     textClass = 'text-slate-600 dark:text-slate-400';
                }

                if(item.overtimeValue) val += item.overtimeValue;
                
                return (
                <div key={item.id} className={`bg-white dark:bg-slate-900 p-4 rounded-xl flex justify-between items-center shadow-sm border border-slate-100 dark:border-slate-800 border-l-[6px] ${borderColorClass}`}>
                    <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{format(parseISO(item.date), 'dd/MM')}<span className="font-normal text-slate-400 mx-1">•</span>{format(parseISO(item.date), 'EEEE', { locale: ptBR })}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.serviceTitle || translateStatus(item.status)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`font-bold ${textClass}`}>R$ {val.toFixed(2)}</span>
                        <div className="flex gap-1">
                             <button onClick={() => onEdit(item.date)} className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400 hover:text-violet-600 transition-colors"><Edit className="w-4 h-4" /></button>
                             <button onClick={() => handleDeleteEntry(item.id)} className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>);
            } else if (item.itemType === 'advance') {
                 return (
                 <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl flex justify-between items-center shadow-sm border border-slate-100 dark:border-slate-800 border-l-[6px] border-l-rose-500">
                    <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{format(parseISO(item.date), 'dd/MM')}<span className="font-normal text-slate-400 mx-1">•</span>{format(parseISO(item.date), 'EEEE', { locale: ptBR })}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.note || 'Adiantamento'}</p>
                    </div>
                    <span className="font-bold text-rose-600">- R$ {item.amount.toFixed(2)}</span>
                </div>);
            }
            return null;
        })}
      </div>
    </div>
  );
};

export default ReportsTab;
