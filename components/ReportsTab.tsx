
import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, isSameMonth, parseISO, addMonths, subMonths, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Download, Edit, Trash2, Wallet, TrendingDown, TrendingUp, CalendarSearch, CalendarRange, Calendar, RotateCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { UserSettings, WorkEntry, WorkStatus, AdvanceEntry, MonthlyStats } from '../types';
import { getWorkEntries, getAdvances, deleteWorkEntry, deleteAdvance } from '../services/storageService';
import { Card } from './ui/Card';

interface ReportsTabProps {
  settings: UserSettings;
  onEdit: (date: string) => void;
  dataVersion: number;
}

type ReportMode = 'month' | 'custom' | 'cycle';

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
  const [reportMode, setReportMode] = useState<ReportMode>('cycle');
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [advances, setAdvances] = useState<AdvanceEntry[]>([]);

  useEffect(() => {
    setEntries(getWorkEntries());
    setAdvances(getAdvances());
  }, [dataVersion]); 

  const handleDeleteWork = (id: string) => {
    if (window.confirm("Excluir este registro de trabalho?")) {
        deleteWorkEntry(id);
        setEntries(prev => prev.filter(e => e.id !== id));
    }
  };

  const handleDeleteAdvance = (id: string) => {
    if (window.confirm("Excluir este vale?")) {
        deleteAdvance(id);
        setAdvances(prev => prev.filter(a => a.id !== id));
    }
  };

  const { monthlyEntries, monthlyAdvances, stats, periodLabel } = useMemo(() => {
    let fEntries: WorkEntry[] = [];
    let fAdvances: AdvanceEntry[] = [];
    let label = '';

    if (reportMode === 'month') {
        fEntries = entries.filter(e => isSameMonth(parseISO(e.date), currentMonthDate));
        fAdvances = advances.filter(a => isSameMonth(parseISO(a.date), currentMonthDate));
        label = format(currentMonthDate, 'MMMM/yyyy', { locale: ptBR }).toUpperCase();
    } else if (reportMode === 'cycle') {
        const cycleStart = settings.billingCycleStartDate || '2024-12-16';
        fEntries = entries.filter(e => e.date >= cycleStart);
        fAdvances = advances.filter(a => a.date >= cycleStart);
        label = `SALDO DESDE ${format(parseISO(cycleStart), 'dd/MM/yyyy')}`;
    } else {
        const start = startOfDay(parseISO(customStartDate));
        const end = endOfDay(parseISO(customEndDate));
        fEntries = entries.filter(e => isWithinInterval(parseISO(e.date), { start, end }));
        fAdvances = advances.filter(a => isWithinInterval(parseISO(a.date), { start, end }));
        label = `${format(start, 'dd/MM/yyyy')} a ${format(end, 'dd/MM/yyyy')}`;
    }

    const s: MonthlyStats = {
      daysWorked: 0, daysMissed: 0, grossTotal: 0, totalAdvances: 0, finalTotal: 0,
      totalFromDays: 0, totalFromOvertime: 0, totalFromExtraServices: 0,
    };

    fEntries.forEach(e => {
      if (e.status === WorkStatus.WORKED) { s.daysWorked += 1; s.totalFromDays += e.dailyRateSnapshot; }
      else if (e.status === WorkStatus.HALF_DAY) { s.daysWorked += 0.5; s.totalFromDays += (e.dailyRateSnapshot / 2); }
      else if (e.status === WorkStatus.MISSED) s.daysMissed += 1;
      else if (e.status === WorkStatus.EXTRA_SERVICE) s.totalFromExtraServices += e.dailyRateSnapshot;
      if (e.overtimeValue) s.totalFromOvertime += e.overtimeValue;
    });

    s.grossTotal = s.totalFromDays + s.totalFromOvertime + s.totalFromExtraServices;
    s.totalAdvances = fAdvances.reduce((acc, curr) => acc + curr.amount, 0);
    s.finalTotal = s.grossTotal - s.totalAdvances;

    return { 
        monthlyEntries: fEntries.sort((a,b) => a.date.localeCompare(b.date)), 
        monthlyAdvances: fAdvances.sort((a,b) => a.date.localeCompare(b.date)), 
        stats: s, 
        periodLabel: label 
    };
  }, [currentMonthDate, customStartDate, customEndDate, reportMode, entries, advances, settings.billingCycleStartDate]);

  const allItems = useMemo(() => [
        ...monthlyEntries.map(i => ({...i, itemType: 'work'})),
        ...monthlyAdvances.map(i => ({...i, itemType: 'advance'})),
    ].sort((a,b) => a.date.localeCompare(b.date)), [monthlyEntries, monthlyAdvances]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="bg-white dark:bg-slate-900 p-1.5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex overflow-x-auto">
        <button onClick={() => setReportMode('cycle')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${reportMode === 'cycle' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500'}`}><RotateCcw className="w-4 h-4" />Ciclo</button>
        <button onClick={() => setReportMode('month')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${reportMode === 'month' ? 'bg-violet-100 text-violet-700' : 'text-slate-500'}`}><Calendar className="w-4 h-4" />Mês</button>
        <button onClick={() => setReportMode('custom')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${reportMode === 'custom' ? 'bg-violet-100 text-violet-700' : 'text-slate-500'}`}><CalendarRange className="w-4 h-4" />Busca</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800">
             <p className="text-xs font-bold text-emerald-600 uppercase">Bruto</p>
             <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">R$ {stats.grossTotal.toFixed(2)}</p>
          </div>
          <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-2xl border border-rose-100 dark:border-rose-800">
             <p className="text-xs font-bold text-rose-600 uppercase">Vales</p>
             <p className="text-xl font-bold text-rose-700 dark:text-rose-300">- {stats.totalAdvances.toFixed(2)}</p>
          </div>
          <div className="col-span-2 bg-gradient-to-r from-violet-600 to-indigo-600 p-5 rounded-2xl text-white shadow-lg">
             <p className="text-xs font-bold text-indigo-100 uppercase mb-1">A RECEBER (LÍQUIDO)</p>
             <p className="text-3xl font-extrabold">R$ {stats.finalTotal.toFixed(2)}</p>
          </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-500 uppercase ml-2">{periodLabel}</h3>
        {allItems.map(item => (
            <div key={item.id} className={`bg-white dark:bg-slate-900 p-4 rounded-xl flex justify-between items-center shadow-sm border border-l-[6px] ${item.itemType === 'work' ? 'border-l-violet-500' : 'border-l-rose-500'}`}>
                <div>
                    <p className="font-bold text-sm">{format(parseISO(item.date), 'dd/MM')} • {translateStatus((item as any).status || 'Adiantamento')}</p>
                    <p className="text-xs text-slate-500">{(item as any).serviceTitle || (item as any).note || ''}</p>
                </div>
                <div className="flex items-center gap-4"> {/* GAP DE 4 NO RELATÓRIO TAMBÉM */}
                    <span className={`font-bold ${item.itemType === 'work' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {item.itemType === 'work' ? '+' : '-'} R$ {(item as any).dailyRateSnapshot || (item as any).amount}
                    </span>
                    <button 
                        onClick={() => item.itemType === 'work' ? handleDeleteWork(item.id) : handleDeleteAdvance(item.id)} 
                        className="p-2 text-slate-300 hover:text-rose-600"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default ReportsTab;
