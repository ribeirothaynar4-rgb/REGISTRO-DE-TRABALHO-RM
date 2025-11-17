
import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, isSameMonth, parseISO, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Download, Sparkles, Edit, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { UserSettings, WorkEntry, WorkStatus, AdvanceEntry, MonthlyStats } from '../types';
import { getWorkEntries, getAdvances, deleteWorkEntry } from '../services/storageService';
import { generateMonthlyAnalysis } from '../services/geminiService';
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
  const [aiResult, setAiResult] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    setEntries(getWorkEntries());
    setAdvances(getAdvances());
    setAiResult('');
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
    const monthStr = format(currentDate, 'MMMM/yyyy', { locale: ptBR });
    doc.text(`Relatório de Serviços - ${monthStr.toUpperCase()}`, 14, 20);

    const hasPeriod = !!periodRange;
    const yOffset = hasPeriod ? 8 : 0;

    if (hasPeriod) {
        doc.setFontSize(10);
        doc.text(periodRange, 14, 26);
        doc.setFontSize(12); // Reset
    }

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
        headStyles: { fillColor: [41, 128, 185] }
    });
    finalY = (doc as any).lastAutoTable.finalY + 10;
    
    if (monthlyAdvances.length > 0) {
        autoTable(doc, { startY: finalY, head: [['Dia', 'Adiantamento', 'Valor']], body: monthlyAdvances.map(a => [format(parseISO(a.date), 'dd/MM'), a.note || 'Vale', `- R$ ${a.amount.toFixed(2)}`]), headStyles: { fillColor: [192, 57, 43] } });
        finalY = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Seção de despesas foi completamente removida do PDF
    
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
    doc.line(14, finalY, 200, finalY);
    finalY += 7;
    
    doc.setFontSize(10);
    doc.text(`Total Bruto: R$ ${stats.grossTotal.toFixed(2)}`, 14, finalY);
    doc.text(`Total Adiantamentos: - R$ ${stats.totalAdvances.toFixed(2)}`, 14, finalY + 5);
    
    finalY += 12;
    
    const finalTotalForPDF = stats.grossTotal - stats.totalAdvances;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`VALOR LÍQUIDO A RECEBER: R$ ${finalTotalForPDF.toFixed(2)}`, 14, finalY);
    doc.save(`Relatorio_${format(currentDate, 'MM-yyyy')}.pdf`);
  };

  const handleAiAction = async () => {
    setLoadingAi(true);
    setAiResult('Analisando...');
    const monthName = format(currentDate, 'MMMM', { locale: ptBR });
    const text = await generateMonthlyAnalysis(stats, settings.workerName, monthName);
    setAiResult(text);
    setLoadingAi(false);
  };
  
  const allItems = useMemo(() => [
        ...monthlyEntries.map(i => ({...i, itemType: 'work'})),
        ...monthlyAdvances.map(i => ({...i, itemType: 'advance'})),
    ].sort((a,b) => a.date.localeCompare(b.date)), [monthlyEntries, monthlyAdvances]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
        <button onClick={() => setCurrentDate(prev => subMonths(prev, 1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ChevronLeft className="w-6 h-6" /></button>
        <h2 className="text-lg font-bold text-slate-800 dark:text-white capitalize">{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</h2>
        <button onClick={() => setCurrentDate(prev => addMonths(prev, 1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ChevronRight className="w-6 h-6" /></button>
      </div>

      {periodRange && (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 -mt-4">
          {periodRange}
        </p>
      )}

      <Card>
        <div className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-xs text-slate-500">GANHO BRUTO</p><p className="font-bold text-green-600 text-lg">R$ {stats.grossTotal.toFixed(2)}</p></div>
            <div><p className="text-xs text-slate-500">ADIANTAMENTOS</p><p className="font-bold text-red-600 text-lg">R$ {stats.totalAdvances.toFixed(2)}</p></div>
            <div><p className="text-xs text-slate-500">A RECEBER</p><p className="font-bold text-blue-600 text-lg">R$ {stats.finalTotal.toFixed(2)}</p></div>
        </div>
      </Card>
      
      <div className="grid grid-cols-2 gap-3">
          <button onClick={generatePDF} className="flex items-center justify-center space-x-2 bg-slate-800 text-white p-3 rounded-xl"><Download className="w-5 h-5" /><span>Baixar PDF</span></button>
          <button onClick={handleAiAction} disabled={loadingAi} className="flex items-center justify-center space-x-2 bg-purple-100 text-purple-700 p-3 rounded-xl"><Sparkles className={`w-5 h-5 ${loadingAi ? 'animate-spin' : ''}`} /><span>Análise IA</span></button>
      </div>

      {aiResult && (
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl"><p className="text-purple-800 dark:text-purple-300 text-sm">{aiResult}</p></div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-bold">Histórico Detalhado do Mês</h3>
        {allItems.map(item => {
            if (item.itemType === 'work') {
                let val = 0;
                if (item.status === WorkStatus.WORKED) val = item.dailyRateSnapshot;
                else if (item.status === WorkStatus.HALF_DAY) val = item.dailyRateSnapshot / 2;
                else if (item.status === WorkStatus.EXTRA_SERVICE) val = item.dailyRateSnapshot;
                if(item.overtimeValue) val += item.overtimeValue;
                return (<div key={item.id} className="bg-white dark:bg-slate-900 p-3 rounded-lg flex justify-between items-center border-l-4 border-green-500">
                    <div><p className="font-bold">{format(parseISO(item.date), 'dd/MM, EEEE', { locale: ptBR })}</p><p className="text-xs text-slate-500">{item.serviceTitle || translateStatus(item.status)}</p></div>
                    <div className="flex items-center gap-2"><span className="font-bold">R$ {val.toFixed(2)}</span><button onClick={() => onEdit(item.date)}><Edit className="w-4 h-4 text-slate-400" /></button><button onClick={() => handleDeleteEntry(item.id)}><Trash2 className="w-4 h-4 text-slate-400" /></button></div>
                </div>);
            } else if (item.itemType === 'advance') {
                 return (<div key={item.id} className="bg-white dark:bg-slate-900 p-3 rounded-lg flex justify-between items-center border-l-4 border-red-500">
                    <div><p className="font-bold">{format(parseISO(item.date), 'dd/MM, EEEE', { locale: ptBR })}</p><p className="text-xs text-slate-500">{item.note || 'Adiantamento'}</p></div>
                    <span className="font-bold text-red-600">- R$ {item.amount.toFixed(2)}</span>
                </div>);
            }
            return null;
        })}
      </div>
    </div>
  );
};

export default ReportsTab;