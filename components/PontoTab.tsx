import React, { useState, useEffect } from 'react';
import { Clock, Calendar as CalendarIcon, Save, RotateCcw, Trash2, ArrowRight, HelpCircle, Info, ChevronRight, AlertCircle, TrendingDown, TrendingUp, CheckCircle, FileText, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PontoEntry } from '../types';
import { getPontoEntries, savePontoEntry, deletePontoEntry, getSettings } from '../services/storageService';
import { Card } from './ui/Card';

interface PontoTabProps {
  onUpdate?: () => void;
}

const TARGET_MORNING = '08:00';
const TARGET_LUNCH_OUT = '12:00';
const TARGET_LUNCH_IN = '13:30';
const TARGET_AFTERNOON_OUT = '17:00';
const RATE_PER_MINUTE = 75 / 450; // R$ 75,00 por 7 horas e 30 minutos (450 minutos)

const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const formatMinutesToHuman = (totalMinutes: number): string => {
  const absMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  let res = '';
  if (hours > 0) {
    res += `${hours}h `;
  }
  res += `${minutes}min`;
  return res;
};

const PontoTab: React.FC<PontoTabProps> = ({ onUpdate }) => {
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedPdfMonth, setSelectedPdfMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [morningArrival, setMorningArrival] = useState<string>('08:00');
  const [morningExit, setMorningExit] = useState<string>('12:00');
  const [afternoonArrival, setAfternoonArrival] = useState<string>('13:30');
  const [afternoonExit, setAfternoonExit] = useState<string>('17:00');
  const [isSaved, setIsSaved] = useState(false);
  const [entries, setEntries] = useState<PontoEntry[]>(getPontoEntries());

  // Carrega registro existente na data selecionada
  useEffect(() => {
    const existingEntry = entries.find(e => e.date === selectedDate);
    if (existingEntry) {
      setMorningArrival(existingEntry.morningArrival || '08:00');
      setMorningExit(existingEntry.morningExit || '12:00');
      setAfternoonArrival(existingEntry.afternoonArrival || '13:30');
      setAfternoonExit(existingEntry.afternoonExit || '17:00');
    } else {
      setMorningArrival('08:00');
      setMorningExit('12:00');
      setAfternoonArrival('13:30');
      setAfternoonExit('17:00');
    }
    setIsSaved(false);
  }, [selectedDate, entries]);

  const refreshEntries = () => {
    const fresh = getPontoEntries();
    setEntries(fresh);
    if (onUpdate) onUpdate();
  };

  const handleSave = () => {
    const mArrivalTargetMin = parseTimeToMinutes(TARGET_MORNING);
    const mArrivalActualMin = parseTimeToMinutes(morningArrival);
    const mArrivalDelay = mArrivalActualMin - mArrivalTargetMin; // positivo se atrasado, negativo se adiantado

    const mExitTargetMin = parseTimeToMinutes(TARGET_LUNCH_OUT);
    const mExitActualMin = parseTimeToMinutes(morningExit);
    const mExitDelay = mExitTargetMin - mExitActualMin; // positivo se saiu mais cedo, negativo se extra

    const aArrivalTargetMin = parseTimeToMinutes(TARGET_LUNCH_IN);
    const aArrivalActualMin = parseTimeToMinutes(afternoonArrival);
    const aArrivalDelay = aArrivalActualMin - aArrivalTargetMin; // positivo se atrasado, negativo se adiantado

    const aExitTargetMin = parseTimeToMinutes(TARGET_AFTERNOON_OUT);
    const aExitActualMin = parseTimeToMinutes(afternoonExit);
    const aExitDelay = aExitTargetMin - aExitActualMin; // positivo se saiu mais cedo, negativo se extra

    const totalDelay = mArrivalDelay + mExitDelay + aArrivalDelay + aExitDelay;
    const valueEquivalent = totalDelay * RATE_PER_MINUTE;

    const entry: PontoEntry = {
      id: selectedDate, // Um por dia
      date: selectedDate,
      morningArrival,
      morningExit,
      afternoonArrival,
      afternoonExit,
      morningDelay: mArrivalDelay,
      morningExitDelay: mExitDelay,
      afternoonDelay: aArrivalDelay,
      afternoonExitDelay: aExitDelay,
      totalDelay,
      valueEquivalent
    };

    savePontoEntry(entry);
    setIsSaved(true);
    refreshEntries();
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir o registro de ponto deste dia?')) {
      deletePontoEntry(id);
      refreshEntries();
    }
  };

  const handleResetTimeBank = () => {
    if (confirm('Atenção: Isso irá apagar permanentemente todos os registros de ponto do seu banco de horas. Deseja continuar?')) {
      // Deleta todos os registros de ponto
      entries.forEach(e => deletePontoEntry(e.id));
      refreshEntries();
    }
  };

  const handleDownloadPdf = () => {
    if (!selectedPdfMonth) return;
    
    const [yearStr, monthStr] = selectedPdfMonth.split('-');
    const yearInt = parseInt(yearStr, 10);
    const monthInt = parseInt(monthStr, 10);
    
    const referenceDate = new Date(yearInt, monthInt - 1, 1);
    const referenceMonthLabel = format(referenceDate, "MMMM 'de' yyyy", { locale: ptBR }).toUpperCase();
    
    const settings = getSettings();
    const workerName = settings.workerName || 'Não cadastrado';
    const employerName = settings.employerName || 'Não cadastrado';
    
    const totalDays = new Date(yearInt, monthInt, 0).getDate();
    const rows = [];
    
    const getDayNamePT = (dayIndex: number): string => {
      const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      return days[dayIndex];
    };
    
    // Filtra pontos apenas do mês selecionado
    const monthEntries = entries.filter(e => e.date.startsWith(selectedPdfMonth));
    
    let totalMinutesOwed = 0;
    let totalMinutesExtra = 0;
    
    for (let d = 1; d <= totalDays; d++) {
      const dayStr = String(d).padStart(2, '0');
      const fullDateStr = `${selectedPdfMonth}-${dayStr}`;
      const dayDate = new Date(yearInt, monthInt - 1, d);
      const dayOfWeekIndex = dayDate.getDay();
      const dayOfWeekName = getDayNamePT(dayOfWeekIndex);
      
      const dayEntry = monthEntries.find(e => e.date === fullDateStr);
      
      let morningArrivalVal = '-';
      let morningExitVal = '-';
      let afternoonArrivalVal = '-';
      let afternoonExitVal = '-';
      let statusText = '-';
      
      if (dayEntry) {
        morningArrivalVal = dayEntry.morningArrival || '-';
        morningExitVal = dayEntry.morningExit || '-';
        afternoonArrivalVal = dayEntry.afternoonArrival || '-';
        afternoonExitVal = dayEntry.afternoonExit || '-';
        
        const delay = dayEntry.totalDelay;
        if (delay > 0) {
          statusText = `Atraso: +${delay} min`;
          totalMinutesOwed += delay;
        } else if (delay < 0) {
          statusText = `Extra: ${delay} min`;
          totalMinutesExtra += Math.abs(delay);
        } else {
          statusText = 'No horário';
        }
      } else {
        if (dayOfWeekIndex === 0) {
          statusText = 'DOMINGO';
        } else if (dayOfWeekIndex === 6) {
          statusText = 'SÁBADO';
        } else {
          statusText = 'Sem registro';
        }
      }
      
      rows.push([
        dayStr,
        dayOfWeekName,
        morningArrivalVal,
        morningExitVal,
        afternoonArrivalVal,
        afternoonExitVal,
        statusText
      ]);
    }
    
    const doc = new jsPDF();
    
    // Cabeçalho elegante
    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('FOLHA DE PONTO INDIVIDUAL', 14, 20);
    
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    
    doc.text(`Mês de Referência: ${referenceMonthLabel}`, 14, 28);
    doc.text(`Colaborador: ${workerName}`, 14, 34);
    doc.text(`Empregador/Empresa: ${employerName}`, 14, 40);
    
    // Horários de trabalho normativos
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 100);
    doc.text('Horários padrão de trabalho: Entrada Manhã (08:00) | Almoço (12:00 às 13:30) | Saída Tarde (17:00)', 14, 47);
    doc.setTextColor(0, 0, 0);
    
    // Gerar tabela de ponto
    autoTable(doc, {
      startY: 52,
      head: [['Dia', 'Dia da Semana', 'Entrada Manhã', 'Saída Almoço', 'Volta Almoço', 'Saída Tarde', 'Situação']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [109, 40, 217] }, // Violet-700
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 12 },
        1: { halign: 'left', cellWidth: 28 },
        2: { halign: 'center', cellWidth: 28 },
        3: { halign: 'center', cellWidth: 28 },
        4: { halign: 'center', cellWidth: 28 },
        5: { halign: 'center', cellWidth: 28 },
        6: { halign: 'center', fontStyle: 'bold' }
      },
      styles: { fontSize: 8.5 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          const val = data.cell.text[0];
          if (val.startsWith('Atraso:')) {
            data.cell.styles.textColor = [220, 38, 38]; // Vermelho para atraso
          } else if (val.startsWith('Extra:')) {
            data.cell.styles.textColor = [22, 163, 74]; // Verde para extra
          } else if (val === 'DOMINGO' || val === 'SÁBADO') {
            data.cell.styles.textColor = [120, 120, 120];
            data.cell.styles.fontStyle = 'italic';
          }
        }
      }
    });
    
    const finalY = (doc as any).lastAutoTable.finalY + 12;
    
    // Resumo mensal
    doc.setFontSize(11);
    doc.setFont('Helvetica', 'bold');
    doc.text('RESUMO FINANCEIRO / BANCO DE HORAS:', 14, finalY);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(`Dias Registrados no Mês: ${monthEntries.length} dia(s)`, 14, finalY + 7);
    doc.text(`Total de Atrasos acumulados: +${totalMinutesOwed} minuto(s)`, 14, finalY + 13);
    doc.text(`Total de Crédito extra acumulado: -${totalMinutesExtra} minuto(s)`, 14, finalY + 19);
    
    const diffMinutes = totalMinutesOwed - totalMinutesExtra;
    
    // Explicando as regras de desconto solicitadas pelo usuário:
    // Se saldo for positivo (devedor de minutos), desconta do salário.
    // Se saldo for negativo (crédito de minutos), não aumenta o salário.
    if (diffMinutes > 0) {
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(220, 38, 38); // Vermelho para atraso
      const valueDiscount = diffMinutes * RATE_PER_MINUTE;
      doc.text(`Saldo Consolidado: Devedor de ${diffMinutes} minuto(s). DESCONTO NO SALÁRIO: R$ ${valueDiscount.toFixed(2)}`, 14, finalY + 26);
    } else if (diffMinutes < 0) {
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(22, 163, 74); // Verde para extra
      doc.text(`Saldo Consolidado: Crédito de ${Math.abs(diffMinutes)} minuto(s). SEM DESCONTO (Tempo extra não aumenta salário)`, 14, finalY + 26);
    } else {
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(109, 40, 217);
      doc.text('Saldo Consolidado: Banco de horas em dia. Sem acréscimos ou descontos.', 14, finalY + 26);
    }
    doc.setTextColor(0, 0, 0);
    
    // Linhas de assinatura com espaçamento seguro
    const signatureY = finalY + 45;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.line(14, signatureY, 95, signatureY);
    doc.text('Assinatura do Colaborador', 14, signatureY + 5);
    
    doc.line(115, signatureY, 196, signatureY);
    doc.text('Assinatura do Empregador / Empresa', 115, signatureY + 5);
    
    doc.save(`Folha_de_Ponto_${workerName.replace(/\s/g, '_')}_${selectedPdfMonth}.pdf`);
  };

  // Cálculos acumulados do Banco de Horas
  const totals = entries.reduce(
    (acc, curr) => {
      acc.minutes += curr.totalDelay;
      acc.value += curr.valueEquivalent;
      return acc;
    },
    { minutes: 0, value: 0 }
  );

  const formattedDateDisplay = format(new Date(selectedDate + 'T00:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR });

  // Detalhes da data selecionada
  const selectedMorningArrivalDiff = parseTimeToMinutes(morningArrival) - parseTimeToMinutes(TARGET_MORNING);
  const selectedMorningExitDiff = parseTimeToMinutes(TARGET_LUNCH_OUT) - parseTimeToMinutes(morningExit);
  const selectedAfternoonArrivalDiff = parseTimeToMinutes(afternoonArrival) - parseTimeToMinutes(TARGET_LUNCH_IN);
  const selectedAfternoonExitDiff = parseTimeToMinutes(TARGET_AFTERNOON_OUT) - parseTimeToMinutes(afternoonExit);
  const selectedTotalDiff = selectedMorningArrivalDiff + selectedMorningExitDiff + selectedAfternoonArrivalDiff + selectedAfternoonExitDiff;
  const selectedValueDiff = selectedTotalDiff * RATE_PER_MINUTE;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <header className="mb-2">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400">
          Controle de Ponto
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium">Controle de atrasos e créditos em minutos</p>
      </header>

      {/* BANCO DE HORAS ACUMULADO */}
      <Card className="bg-gradient-to-br from-indigo-50/50 to-violet-50/50 border-indigo-100 dark:from-indigo-950/20 dark:to-violet-950/20 dark:border-indigo-900/50 p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h2 className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">Banco de Horas Acumulado</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Saldo total acumulado de todos os dias registrados</p>
          </div>
          {entries.length > 0 && (
            <button
              onClick={handleResetTimeBank}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 flex items-center gap-1 transition-colors bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-rose-100 dark:border-rose-900/50 shadow-sm"
            >
              <RotateCcw className="w-3 h-3" /> Zerar Saldo
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mt-2">
          {/* Minutos */}
          <div className="bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-indigo-50 dark:border-slate-800/80 shadow-xs flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Saldo de Tempo</span>
            <div className="flex items-center gap-1.5 mt-1">
              {totals.minutes > 0 ? (
                <TrendingUp className="w-5 h-5 text-rose-500" />
              ) : totals.minutes < 0 ? (
                <TrendingDown className="w-5 h-5 text-emerald-500" />
              ) : (
                <Clock className="w-5 h-5 text-slate-400" />
              )}
              <span className={`text-xl font-black ${totals.minutes > 0 ? 'text-rose-600 dark:text-rose-400' : totals.minutes < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
                {totals.minutes !== 0 ? formatMinutesToHuman(totals.minutes) : 'Zeradinho'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">
              {totals.minutes > 0 ? 'tempo que você deve' : totals.minutes < 0 ? 'tempo de crédito extra' : 'sem atrasos ou créditos'}
            </span>
          </div>

          {/* Valor */}
          <div className="bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-indigo-50 dark:border-slate-800/80 shadow-xs flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Desconto no Salário</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-xl font-black ${totals.minutes > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`}>
                R$ {totals.minutes > 0 ? (totals.minutes * RATE_PER_MINUTE).toFixed(2) : '0.00'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">
              {totals.minutes > 0 ? 'a ser descontado' : 'sem desconto (crédito de tempo)'}
            </span>
          </div>
        </div>
      </Card>

      {/* EXPORTAR FOLHA DE PONTO EM PDF */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-violet-500" />
              <span>Exportar Folha de Ponto (PDF)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Gere um documento oficial de folha de ponto assinado com todos os dias do mês de referência.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <input
              type="month"
              value={selectedPdfMonth}
              onChange={(e) => setSelectedPdfMonth(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-violet-500 text-slate-900 dark:text-white"
            />
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Baixar PDF</span>
            </button>
          </div>
        </div>
      </Card>

      {/* REGISTRO DO DIA */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Data do Registro</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <CalendarIcon className="h-5 w-5 text-violet-500" />
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent text-slate-900 dark:text-white font-bold text-base"
            />
          </div>
          <p className="text-center text-violet-600 dark:text-violet-300 capitalize font-semibold mt-2.5 text-xs">
            {formattedDateDisplay}
          </p>
        </div>

        {/* INPUTS DE HORÁRIOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Entrada Manhã */}
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs font-bold mb-1.5">
              <Clock className="w-3.5 h-3.5 text-violet-500" />
              <span>Entrada Manhã</span>
            </div>
            <input
              type="time"
              value={morningArrival}
              onChange={(e) => setMorningArrival(e.target.value)}
              className="w-full text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 font-black text-lg text-slate-900 dark:text-white"
            />
            <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
              <span>Alvo: 08:00</span>
              <button onClick={() => setMorningArrival('08:00')} className="text-violet-500 font-semibold hover:underline">Reset</button>
            </div>
          </div>

          {/* Saída Almoço */}
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs font-bold mb-1.5">
              <Clock className="w-3.5 h-3.5 text-violet-500" />
              <span>Saída Almoço</span>
            </div>
            <input
              type="time"
              value={morningExit}
              onChange={(e) => setMorningExit(e.target.value)}
              className="w-full text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 font-black text-lg text-slate-900 dark:text-white"
            />
            <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
              <span>Alvo: 12:00</span>
              <button onClick={() => setMorningExit('12:00')} className="text-violet-500 font-semibold hover:underline">Reset</button>
            </div>
          </div>

          {/* Retorno Almoço */}
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs font-bold mb-1.5">
              <Clock className="w-3.5 h-3.5 text-violet-500" />
              <span>Volta Almoço</span>
            </div>
            <input
              type="time"
              value={afternoonArrival}
              onChange={(e) => setAfternoonArrival(e.target.value)}
              className="w-full text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 font-black text-lg text-slate-900 dark:text-white"
            />
            <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
              <span>Alvo: 13:30</span>
              <button onClick={() => setAfternoonArrival('13:30')} className="text-violet-500 font-semibold hover:underline">Reset</button>
            </div>
          </div>

          {/* Saída Tarde */}
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs font-bold mb-1.5">
              <Clock className="w-3.5 h-3.5 text-violet-500" />
              <span>Saída Tarde</span>
            </div>
            <input
              type="time"
              value={afternoonExit}
              onChange={(e) => setAfternoonExit(e.target.value)}
              className="w-full text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 font-black text-lg text-slate-900 dark:text-white"
            />
            <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
              <span>Alvo: 17:00</span>
              <button onClick={() => setAfternoonExit('17:00')} className="text-violet-500 font-semibold hover:underline">Reset</button>
            </div>
          </div>
        </div>

        {/* CÁLCULO PRÉVIO DO DIA */}
        <div className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-900 flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-indigo-500" />
            <span className="font-semibold text-slate-500 dark:text-slate-400">Resultado do dia selecionado:</span>
          </div>
          <div className="text-right">
            {selectedTotalDiff > 0 ? (
              <span className="font-bold text-rose-600 dark:text-rose-400">
                +{selectedTotalDiff} min (Desconto R$ {selectedValueDiff.toFixed(2)})
              </span>
            ) : selectedTotalDiff < 0 ? (
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {selectedTotalDiff} min (Crédito de tempo - R$ 0.00)
              </span>
            ) : (
              <span className="font-bold text-slate-500">No horário (R$ 0.00)</span>
            )}
          </div>
        </div>

        {/* BOTAO SALVAR */}
        <button
          onClick={handleSave}
          className={`w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center space-x-2 shadow-md transition-all duration-300 transform active:scale-95 ${
            isSaved
              ? 'bg-emerald-500 text-white ring-4 ring-emerald-200'
              : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-violet-200'
          }`}
        >
          {isSaved ? (
            <>
              <CheckCircle className="w-5 h-5 animate-bounce" />
              <span>Ponto Salvo!</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>Registrar Ponto Diário</span>
            </>
          )}
        </button>
      </div>

      {/* HISTÓRICO DE PONTOS */}
      <div className="space-y-2">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Histórico de Registros</h3>
          <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium">
            {entries.length} {entries.length === 1 ? 'dia' : 'dias'}
          </span>
        </div>

        {entries.length === 0 ? (
          <div className="text-center p-8 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <Clock className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Nenhum ponto registrado ainda.</p>
            <p className="text-xs text-slate-400 mt-1">Marque seus horários acima para começar a calcular.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {entries
              .sort((a, b) => b.date.localeCompare(a.date))
              .map(entry => {
                const dateObj = new Date(entry.date + 'T00:00:00');
                const dayName = format(dateObj, 'EEE', { locale: ptBR }).toUpperCase();
                const dayNum = format(dateObj, 'dd/MM');

                return (
                  <div key={entry.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl p-3 flex justify-between items-center hover:border-slate-200 dark:hover:border-slate-800 transition-all shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg text-center min-w-[50px] border border-slate-100 dark:border-slate-900">
                        <span className="text-[10px] font-black text-violet-500 block leading-tight">{dayName}</span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block leading-tight">{dayNum}</span>
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Manhã:</span>
                          <span className="font-mono bg-slate-50 dark:bg-slate-950 px-1 py-0.5 rounded border border-slate-100 dark:border-slate-900 font-medium text-slate-600 dark:text-slate-400">
                            {entry.morningArrival} às {entry.morningExit || '12:00'}
                          </span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">Tarde:</span>
                          <span className="font-mono bg-slate-50 dark:bg-slate-950 px-1 py-0.5 rounded border border-slate-100 dark:border-slate-900 font-medium text-slate-600 dark:text-slate-400">
                            {entry.afternoonArrival} às {entry.afternoonExit || '17:00'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Alvos: 08:00, 12:00, 13:30 e 17:00
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {entry.totalDelay > 0 ? (
                            <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400">+{entry.totalDelay} min</span>
                          ) : entry.totalDelay < 0 ? (
                            <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">{entry.totalDelay} min</span>
                          ) : (
                            <span className="text-xs font-bold text-slate-500">Em dia</span>
                          )}
                        </div>
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          {entry.totalDelay > 0 ? (
                            <span className="text-rose-500">- R$ {(entry.totalDelay * RATE_PER_MINUTE).toFixed(2)}</span>
                          ) : entry.totalDelay < 0 ? (
                            <span className="text-emerald-500">R$ 0.00 (Tempo extra)</span>
                          ) : (
                            'R$ 0.00'
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:text-slate-600 dark:hover:text-rose-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* METODOLOGIA / EXPLICATIVO */}
      <Card className="bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 p-3 text-xs text-slate-500 space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
          <HelpCircle className="w-4 h-4 text-violet-500" />
          <span>Como funciona o cálculo?</span>
        </div>
        <p className="leading-relaxed">
          O cálculo foi desenhado especificamente conforme suas regras de trabalho:
        </p>
        <ul className="list-disc pl-4 space-y-1.5 leading-relaxed">
          <li><strong>Horários Alvo de Trabalho:</strong> Entrada pela manhã às <strong>08:00</strong>, saída para o almoço às <strong>12:00</strong>, volta do almoço às <strong>13:30</strong> e saída no final da tarde às <strong>17:00</strong>.</li>
          <li><strong>Cálculo do Minuto:</strong> Baseado em um valor de referência de <strong>R$ 75,00</strong> para <strong>7 horas e 30 minutos</strong> de serviço (450 minutos), o que resulta em aproximadamente <strong>R$ 0,167 por minuto</strong>.</li>
          <li><strong>Banco de Horas:</strong> Os atrasos de entrada e as saídas antecipadas acumulam minutos que você deve (positivo). Se você chegar adiantado ou fizer hora extra saindo mais tarde, esse tempo gera crédito que desconta do que você deve (negativo).</li>
        </ul>
      </Card>
    </div>
  );
};

export default PontoTab;
