
import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, isSameMonth, parseISO, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Download, Edit, Trash2, Wallet, TrendingDown, TrendingUp } from 'lucide-react';
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [advances, setAdvances] = useState<AdvanceEntry[]>([]);

  useEffect(() => {
    setEntries(getWorkEntries());
    setAdvances(getAdvances());
  }, [currentDate, dataVersion]);

  const handleDeleteEntry = (id: string) => {
    if (window.confirm("Excluir este registro?")) {
        deleteWorkEntry(id);
        setEntries(prev => prev.filter(e => e.id !== id));
    }
  };

  const { monthlyEntries, monthlyAdvances, stats, periodRange } = useMemo(() => {
    const filteredEntries = entries.filter(e => isSameMonth(parseISO(e.date), currentDate));
    const filteredAdvances = advances.filter(a => isSameMonth(parseISO(a.date), currentDate));

    const allItemsSorted = [...filteredEntries, ...filteredAdvances].sort((a, b) => a.date.localeCompare(b.date));
    let periodRange = '';
    if (allItemsSorted.length > 0) {
        const firstDate = parseISO(allItemsSorted[0].date);
        const lastDate = parseISO(allItemsSorted[allItemsSorted.length - 1].date);
        if (format(firstDate, 'yyyy-MM-dd') === format(lastDate, 'yyyy-MM-dd')) {
            periodRange = `Registro de ${format(firstDate, 'dd/MM/yyyy', { locale: ptBR })}`;
        } else {
            periodRange = `Período: ${format(firstDate, 'dd/MM/yyyy', { locale: ptBR })} a ${format(lastDate, 'dd/MM/yyyy', { locale: ptBR })}`;
        }
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

    return { monthlyEntries: filteredEntries.sort((a,b) => a.date.localeCompare(b.date)), monthlyAdvances: filteredAdvances.sort((a,b) => a.date.localeCompare(b.date)), stats: newStats, periodRange };
  }, [currentDate, entries, advances]);

  const generatePDF = () => {
    const doc = new jsPDF();
    // Cores mais profissionais no PDF também
    doc.setTextColor(30, 41, 59); 
    const monthStr = format(currentDate, 'MMMM/yyyy', { locale: ptBR });
    doc.setFontSize(16);
    doc.text(`Relatório de Serviços - ${monthStr.toUpperCase()}`, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    const hasPeriod = !!periodRange;
    const yOffset = hasPeriod ? 8 : 0;

    if (hasPeriod) {
        doc.text(periodRange, 14, 26);
    }

    doc.setTextColor(0);
    doc.setFontSize(12);
    if(settings.workerName) doc.text(`Prestador: ${settings.workerName}`, 14, 30 + yOffset);
    if(settings.employerName) doc.text(`Cliente: ${settings.employerName}`, 14, 36 + yOffset);
    
    let finalY = 45 + yOffset;

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
        autoTable(doc, { startY: finalY, head: [['Dia', 'Adiantamento', 'Valor']], body: monthlyAdvances.map(a => [format(parseISO(a.date), 'dd/MM'), a.note || 'Vale', `- R$ ${a.amount.toFixed(2)}`]), headStyles: { fillColor: [225, 29, 72] } }); // Rose for expenses
        finalY = (doc as any).lastAutoTable.finalY + 10;
    }
    
    doc.setFontSize(12);
    doc.text(`Resumo do Período`, 14, finalY);
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
    doc.text(`VALOR LÍQUIDO A RECEBER: R$ ${finalTotalForPDF.toFixed(2)}`, 14, finalY);
    doc.save(`Relatorio_${format(currentDate, 'MM-yyyy')}.pdf`);
  };
  
  const allItems = useMemo(() => [
        ...monthlyEntries.map(i => ({...i, itemType: 'work'})),
        ...monthlyAdvances.map(i => ({...i, itemType: 'advance'})),
    ].sort((a,b) => a.date.localeCompare(b.date)), [monthlyEntries, monthlyAdvances]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <button onClick={() => setCurrentDate(prev => subMonths(prev, 1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-violet-600"><ChevronLeft className="w-6 h-6" /></button>
        <div className="text-center">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white capitalize">{format(currentDate, 'MMMM', { locale: ptBR })}</h2>
            <p className="text-xs text-slate-500 font-medium">{format(currentDate, 'yyyy')}</p>
        </div>
        <button onClick={() => setCurrentDate(prev => addMonths(prev, 1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-violet-600"><ChevronRight className="w-6 h-6" /></button>
      </div>

      {periodRange && (
        <p className="text-center text-xs font-medium text-slate-400 dark:text-slate-500 -mt-3 bg-slate-100 dark:bg-slate-900 py-1 px-3 rounded-full mx-auto w-max">
          {periodRange}
        </p>
      )}

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
                    <p className="text-xs font-bold text-indigo-100 uppercase tracking-wider mb-1">Valor Líquido a Receber</p>
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
        <h3 className="text-sm font-bold text-slate-500 uppercase ml-2">Histórico Detalhado</h3>
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
