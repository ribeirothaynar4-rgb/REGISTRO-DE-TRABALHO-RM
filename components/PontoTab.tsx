import React, { useState, useEffect } from 'react';
import { Clock, Calendar as CalendarIcon, Save, RotateCcw, Trash2, HelpCircle, Info, TrendingDown, TrendingUp, CheckCircle, FileText, Download, Calculator, DollarSign, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
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
const DAILY_RATE = 75.0; // R$ 75,00 por dia
const TARGET_DAILY_MINUTES = 450; // 7h 30min
const RATE_PER_MINUTE = DAILY_RATE / TARGET_DAILY_MINUTES; // R$ 0,166666...

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

export interface DayCalculationDetails {
  jornadaPrevista: number; // 450 min
  tempoRegistrado: number; // minutos trabalhados
  atrasoEntrada: number;
  atrasoSaidaAlmoco: number;
  atrasoVoltaAlmoco: number;
  atrasoSaidaTarde: number;
  atrasos: number; // soma dos atrasos
  buscarFilho: number; // schoolMinutes
  creditoPermanencia: number; // tempo alem das 17:00
  tempoConsiderado: number; // tempoRegistrado - atrasos - buscarFilho
  saldoMinutos: number; // creditoPermanencia - atrasos - buscarFilho
  descontoDia: number; // valor em R$ de desconto
  explicacao: string;
}

export const calculateDayDetails = (
  mArrival: string,
  mExit: string,
  aArrival: string,
  aExit: string,
  schoolMin: number = 0
): DayCalculationDetails => {
  const mArrMin = parseTimeToMinutes(mArrival || TARGET_MORNING);
  const mExtMin = parseTimeToMinutes(mExit || TARGET_LUNCH_OUT);
  const aArrMin = parseTimeToMinutes(aArrival || TARGET_LUNCH_IN);
  const aExtMin = parseTimeToMinutes(aExit || TARGET_AFTERNOON_OUT);

  const targetMArr = parseTimeToMinutes(TARGET_MORNING); // 480 (08:00)
  const targetMExt = parseTimeToMinutes(TARGET_LUNCH_OUT); // 720 (12:00)
  const targetAArr = parseTimeToMinutes(TARGET_LUNCH_IN); // 810 (13:30)
  const targetAExt = parseTimeToMinutes(TARGET_AFTERNOON_OUT); // 1020 (17:00)

  // Tempo registrado bruto (tempo trabalhado de manha + tempo trabalhado a tarde)
  const morningWorked = Math.max(0, mExtMin - mArrMin);
  const afternoonWorked = Math.max(0, aExtMin - aArrMin);
  const tempoRegistrado = morningWorked + afternoonWorked;

  // Atrasos e saídas antecipadas
  const atrasoEntrada = Math.max(0, mArrMin - targetMArr);
  const atrasoSaidaAlmoco = Math.max(0, targetMExt - mExtMin);
  const atrasoVoltaAlmoco = Math.max(0, aArrMin - targetAArr);
  const atrasoSaidaTarde = Math.max(0, targetAExt - aExtMin);

  const atrasos = atrasoEntrada + atrasoSaidaAlmoco + atrasoVoltaAlmoco + atrasoSaidaTarde;
  const buscarFilho = Math.max(0, schoolMin || 0);

  // Crédito de permanência (tempo trabalhado após as 17:00)
  const creditoPermanencia = Math.max(0, aExtMin - targetAExt);

  // Tempo considerado para pagamento = Tempo registrado - Atrasos - Buscar filho
  const tempoConsiderado = Math.max(0, tempoRegistrado - atrasos - buscarFilho);

  // Saldo do banco de horas no dia = Créditos - Atrasos - Buscar filho
  const saldoMinutos = creditoPermanencia - atrasos - buscarFilho;

  // Desconto financeiro do dia
  const descontoDia = saldoMinutos < 0 ? Math.abs(saldoMinutos) * RATE_PER_MINUTE : 0;

  // Texto explicativo
  let explicacao = `Saldo do Banco: +${creditoPermanencia}m (crédito permanência) - ${atrasos}m (atrasos) - ${buscarFilho}m (buscar filho) = ${saldoMinutos < 0 ? `-${Math.abs(saldoMinutos)} min` : `+${saldoMinutos} min`}. `;
  if (saldoMinutos < 0) {
    explicacao += `Gera desconto diário de R$ ${descontoDia.toFixed(2).replace('.', ',')}.`;
  } else if (saldoMinutos > 0) {
    explicacao += `Sem descontos no salário. Crédito acumulado no banco de horas.`;
  } else {
    explicacao += `Jornada e créditos em perfeito equilíbrio (saldo 0 min). Sem descontos.`;
  }

  return {
    jornadaPrevista: TARGET_DAILY_MINUTES,
    tempoRegistrado,
    atrasoEntrada,
    atrasoSaidaAlmoco,
    atrasoVoltaAlmoco,
    atrasoSaidaTarde,
    atrasos,
    buscarFilho,
    creditoPermanencia,
    tempoConsiderado,
    saldoMinutos,
    descontoDia,
    explicacao
  };
};

const PontoTab: React.FC<PontoTabProps> = ({ onUpdate }) => {
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedPdfMonth, setSelectedPdfMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [morningArrival, setMorningArrival] = useState<string>('08:00');
  const [morningExit, setMorningExit] = useState<string>('12:00');
  const [afternoonArrival, setAfternoonArrival] = useState<string>('13:30');
  const [afternoonExit, setAfternoonExit] = useState<string>('17:00');
  const [schoolMinutes, setSchoolMinutes] = useState<number>(0);
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
      setSchoolMinutes(existingEntry.schoolMinutes || 0);
    } else {
      setMorningArrival('08:00');
      setMorningExit('12:00');
      setAfternoonArrival('13:30');
      setAfternoonExit('17:00');
      setSchoolMinutes(0);
    }
    setIsSaved(false);
  }, [selectedDate, entries]);

  const refreshEntries = () => {
    const fresh = getPontoEntries();
    setEntries(fresh);
    if (onUpdate) onUpdate();
  };

  const handleSave = () => {
    const details = calculateDayDetails(
      morningArrival,
      morningExit,
      afternoonArrival,
      afternoonExit,
      schoolMinutes
    );

    const totalDelay = (details.atrasos + details.buscarFilho) - details.creditoPermanencia;
    const valueEquivalent = details.descontoDia;

    const entry: PontoEntry = {
      id: selectedDate,
      date: selectedDate,
      morningArrival,
      morningExit,
      afternoonArrival,
      afternoonExit,
      morningDelay: details.atrasoEntrada,
      morningExitDelay: details.atrasoSaidaAlmoco,
      afternoonDelay: details.atrasoVoltaAlmoco,
      afternoonExitDelay: details.atrasoSaidaTarde,
      schoolMinutes,
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
    const issueDateLabel = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    
    const settings = getSettings();
    const workerName = settings.workerName || 'Não informado';
    const employerName = settings.employerName || 'Não informado';
    
    const totalDays = new Date(yearInt, monthInt, 0).getDate();
    const tableRows: any[] = [];
    const detailRows: any[] = [];
    
    const getDayNamePT = (dayIndex: number): string => {
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      return days[dayIndex];
    };

    const getFullDayNamePT = (dayIndex: number): string => {
      const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
      return days[dayIndex];
    };
    
    const monthEntries = entries.filter(e => e.date.startsWith(selectedPdfMonth));
    
    let totalDiasTrabalhados = 0;
    let sumJornadaPrevista = 0;
    let sumTempoRegistrado = 0;
    let sumAtrasos = 0;
    let sumBuscarFilho = 0;
    let sumCreditos = 0;
    let sumTempoConsiderado = 0;
    let sumSaldoMinutos = 0;
    let totalDescontoFinanceiro = 0;
    
    for (let d = 1; d <= totalDays; d++) {
      const dayStr = String(d).padStart(2, '0');
      const fullDateStr = `${selectedPdfMonth}-${dayStr}`;
      const dayDate = new Date(yearInt, monthInt - 1, d);
      const dayOfWeekIndex = dayDate.getDay();
      const dayOfWeekName = getDayNamePT(dayOfWeekIndex);
      const fullDayOfWeekName = getFullDayNamePT(dayOfWeekIndex);
      
      const dayEntry = monthEntries.find(e => e.date === fullDateStr);
      
      if (dayEntry) {
        totalDiasTrabalhados++;
        const details = calculateDayDetails(
          dayEntry.morningArrival,
          dayEntry.morningExit,
          dayEntry.afternoonArrival,
          dayEntry.afternoonExit,
          dayEntry.schoolMinutes || 0
        );

        sumJornadaPrevista += details.jornadaPrevista;
        sumTempoRegistrado += details.tempoRegistrado;
        sumAtrasos += details.atrasos;
        sumBuscarFilho += details.buscarFilho;
        sumCreditos += details.creditoPermanencia;
        sumTempoConsiderado += details.tempoConsiderado;
        sumSaldoMinutos += details.saldoMinutos;
        totalDescontoFinanceiro += details.descontoDia;

        let statusCell = 'No horário';
        if (details.saldoMinutos < 0) {
          statusCell = `Desc. R$ ${details.descontoDia.toFixed(2).replace('.', ',')}`;
        } else if (details.saldoMinutos > 0) {
          statusCell = `+${formatMinutesToHuman(details.saldoMinutos)} crédito`;
        }

        tableRows.push([
          dayStr,
          dayOfWeekName,
          dayEntry.morningArrival || '08:00',
          dayEntry.morningExit || '12:00',
          dayEntry.afternoonArrival || '13:30',
          dayEntry.afternoonExit || '17:00',
          '07h 30min',
          formatMinutesToHuman(details.tempoRegistrado),
          details.atrasos > 0 ? `${details.atrasos}m` : '0m',
          details.buscarFilho > 0 ? `${details.buscarFilho}m` : '0m',
          details.creditoPermanencia > 0 ? `${details.creditoPermanencia}m` : '0m',
          formatMinutesToHuman(details.tempoConsiderado),
          details.saldoMinutos < 0 ? `-${Math.abs(details.saldoMinutos)}m` : `+${details.saldoMinutos}m`,
          statusCell
        ]);

        detailRows.push([
          `${dayStr}/${monthStr} (${fullDayOfWeekName})`,
          `${dayEntry.morningArrival || '08:00'} - ${dayEntry.morningExit || '12:00'} | ${dayEntry.afternoonArrival || '13:30'} - ${dayEntry.afternoonExit || '17:00'}`,
          `Crédito permanência: +${details.creditoPermanencia}m\nAtrasos: -${details.atrasos}m | Buscar filho: -${details.buscarFilho}m\nSaldo banco: ${details.saldoMinutos < 0 ? `-${Math.abs(details.saldoMinutos)} min` : `+${details.saldoMinutos} min`}`,
          `Considerado: ${formatMinutesToHuman(details.tempoConsiderado)}\n(${details.tempoRegistrado}m reg. - ${details.atrasos}m - ${details.buscarFilho}m)`,
          details.saldoMinutos < 0 ? `Saldo: -${Math.abs(details.saldoMinutos)}min\n(Desc. R$ ${details.descontoDia.toFixed(2).replace('.', ',')})` : `Saldo: +${details.saldoMinutos}min\n(Sem desconto)`
        ]);

      } else {
        let textStatus = 'Sem registro';
        if (dayOfWeekIndex === 0) textStatus = 'DOMINGO';
        else if (dayOfWeekIndex === 6) textStatus = 'SÁBADO';

        tableRows.push([
          dayStr,
          dayOfWeekName,
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          textStatus
        ]);
      }
    }
    
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const primaryColor: [number, number, number] = [108, 62, 244]; // #6C3EF4 Roxo principal
    
    // CABEÇALHO PROFISSIONAL
    doc.setFillColor(108, 62, 244);
    doc.rect(0, 0, 297, 18, 'F');
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('FOLHA DE PONTO MENSAL - DETALHADA E AUTOEXPLICATIVA', 14, 12);

    // Bloco de Identificação
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.setFont('Helvetica', 'bold');
    
    doc.text(`Empresa / Empregador:`, 14, 25);
    doc.setFont('Helvetica', 'normal');
    doc.text(employerName, 52, 25);

    doc.setFont('Helvetica', 'bold');
    doc.text(`Colaborador(a):`, 14, 30);
    doc.setFont('Helvetica', 'normal');
    doc.text(workerName, 42, 30);

    doc.setFont('Helvetica', 'bold');
    doc.text(`Mês de Referência:`, 160, 25);
    doc.setFont('Helvetica', 'normal');
    doc.text(referenceMonthLabel, 192, 25);

    doc.setFont('Helvetica', 'bold');
    doc.text(`Data de Emissão:`, 160, 30);
    doc.setFont('Helvetica', 'normal');
    doc.text(issueDateLabel, 188, 30);

    // Quadro de Regras da Jornada
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.roundedRect(14, 34, 269, 13, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(108, 62, 244);
    doc.text('REGRAS DA JORNADA:', 18, 39);

    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Horário Previsto: Entrada 08:00 | Saída Almoço 12:00 | Retorno Almoço 13:30 | Saída 17:00 | Jornada Diária: 7h 30min (450 min)', 55, 39);
    doc.text('Valor Diário: R$ 75,00 | Valor por Minuto: R$ 0,166667 (R$ 75,00 ÷ 450 min). Todos os atrasos e buscas de filhos são detalhados individualmente.', 18, 44);

    // TABELA PRINCIPAL
    autoTable(doc, {
      startY: 49,
      head: [['Data', 'Dia', 'Entrada', 'S. Almoço', 'V. Almoço', 'Saída', 'J. Prevista', 'T. Registrado', 'Atrasos', 'Buscar Filho', 'Créditos', 'T. Considerado', 'Saldo', 'Situação / Desconto']],
      body: tableRows,
      theme: 'grid',
      headStyles: { 
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'center'
      },
      styles: { fontSize: 7.5, cellPadding: 1.5, halign: 'center' },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 12 },
        1: { cellWidth: 14 },
        2: { cellWidth: 16 },
        3: { cellWidth: 16 },
        4: { cellWidth: 16 },
        5: { cellWidth: 16 },
        6: { cellWidth: 18 },
        7: { cellWidth: 20, fontStyle: 'bold' },
        8: { cellWidth: 16 },
        9: { cellWidth: 18 },
        10: { cellWidth: 16 },
        11: { cellWidth: 22, fontStyle: 'bold' },
        12: { cellWidth: 16, fontStyle: 'bold' },
        13: { cellWidth: 36, fontStyle: 'bold' }
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const val = data.cell.text[0];
          if (val.startsWith('Desc.')) {
            data.cell.styles.textColor = [220, 38, 38]; // Vermelho
          } else if (val.includes('crédito')) {
            data.cell.styles.textColor = [22, 163, 74]; // Verde
          } else if (val === 'DOMINGO' || val === 'SÁBADO') {
            data.cell.styles.textColor = [148, 163, 184];
            data.cell.styles.fontStyle = 'italic';
          }
        }
      }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 8;

    // SEÇÃO DE EXPLICAÇÃO DETALHADA DOS DIAS TRABALHADOS
    if (detailRows.length > 0) {
      if (currentY + 40 > 200) {
        doc.addPage();
        currentY = 15;
      }

      doc.setFontSize(10);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(108, 62, 244);
      doc.text('DETALHAMENTO E MEMÓRIA DE CÁLCULO POR DIA TRABALHADO:', 14, currentY);
      currentY += 4;

      autoTable(doc, {
        startY: currentY,
        head: [['Data / Dia', 'Horários Registrados', 'Como o Saldo do Banco Foi Calculado', 'Horas p/ Pagamento', 'Saldo do Banco / Status']],
        body: detailRows,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 7.5, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 42, fontStyle: 'bold' },
          1: { cellWidth: 48 },
          2: { cellWidth: 70 },
          3: { cellWidth: 55 },
          4: { cellWidth: 54, fontStyle: 'bold' }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;

      // NOTA EXPLICATIVA SOBRE A REGRA
      if (currentY + 16 > 200) {
        doc.addPage();
        currentY = 15;
      }

      doc.setFillColor(254, 243, 199); // Amber 100
      doc.setDrawColor(245, 158, 11); // Amber 500
      doc.roundedRect(14, currentY, 269, 13, 2, 2, 'FD');

      doc.setFontSize(7);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(180, 83, 9); // Amber 700
      doc.text('NOTA EXPLICATIVA SOBRE A REGRA DO BANCO DE HORAS:', 18, currentY + 4);

      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(120, 53, 15);
      const ruleNoteText = 'O saldo do banco de horas é calculado utilizando apenas os créditos obtidos pela permanência após o horário previsto de saída, descontando os atrasos e o tempo utilizado para buscar o filho. O Tempo Considerado para Pagamento possui finalidade exclusivamente financeira e não participa do cálculo do banco de horas.';
      const splitRuleText = doc.splitTextToSize(ruleNoteText, 260);
      doc.text(splitRuleText, 18, currentY + 7.5);

      currentY += 17;
    }

    // QUADRO RESUMO GERAL DO MÊS
    if (currentY + 55 > 200) {
      doc.addPage();
      currentY = 15;
    }

    doc.setFillColor(245, 243, 255); // Violet light 50
    doc.setDrawColor(108, 62, 244);
    doc.roundedRect(14, currentY, 269, 52, 3, 3, 'FD');

    doc.setFontSize(11);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(108, 62, 244);
    doc.text('RESUMO GERAL DO MÊS', 20, currentY + 8);

    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    const valorBrutoDias = totalDiasTrabalhados * DAILY_RATE;
    const valorLiquido = Math.max(0, valorBrutoDias - totalDescontoFinanceiro);

    // Coluna 1
    doc.setFont('Helvetica', 'bold');
    doc.text('Dias Trabalhados no Mês:', 20, currentY + 16);
    doc.setFont('Helvetica', 'normal');
    doc.text(`${totalDiasTrabalhados} dia(s)`, 65, currentY + 16);

    doc.setFont('Helvetica', 'bold');
    doc.text('Jornada Prevista do Mês:', 20, currentY + 22);
    doc.setFont('Helvetica', 'normal');
    doc.text(`${formatMinutesToHuman(sumJornadaPrevista)} (${sumJornadaPrevista} min)`, 65, currentY + 22);

    doc.setFont('Helvetica', 'bold');
    doc.text('Tempo Registrado no Mês:', 20, currentY + 28);
    doc.setFont('Helvetica', 'normal');
    doc.text(`${formatMinutesToHuman(sumTempoRegistrado)} (${sumTempoRegistrado} min)`, 65, currentY + 28);

    doc.setFont('Helvetica', 'bold');
    doc.text('Tempo Considerado para Pagamento:', 20, currentY + 34);
    doc.setFont('Helvetica', 'normal');
    doc.text(`${formatMinutesToHuman(sumTempoConsiderado)} (${sumTempoConsiderado} min)`, 75, currentY + 34);

    // Coluna 2
    doc.setFont('Helvetica', 'bold');
    doc.text('Total de Atrasos no Mês:', 140, currentY + 16);
    doc.setFont('Helvetica', 'normal');
    doc.text(`${sumAtrasos} min (${formatMinutesToHuman(sumAtrasos)})`, 185, currentY + 16);

    doc.setFont('Helvetica', 'bold');
    doc.text('Total para Buscar Filho:', 140, currentY + 22);
    doc.setFont('Helvetica', 'normal');
    doc.text(`${sumBuscarFilho} min (${formatMinutesToHuman(sumBuscarFilho)})`, 185, currentY + 22);

    doc.setFont('Helvetica', 'bold');
    doc.text('Total de Créditos de Permanência:', 140, currentY + 28);
    doc.setFont('Helvetica', 'normal');
    doc.text(`${sumCreditos} min (${formatMinutesToHuman(sumCreditos)})`, 195, currentY + 28);

    doc.setFont('Helvetica', 'bold');
    doc.text('Saldo do Banco de Horas:', 140, currentY + 34);
    doc.setFont('Helvetica', 'normal');
    if (sumSaldoMinutos < 0) {
      doc.setTextColor(220, 38, 38);
      doc.text(`Devendo ${Math.abs(sumSaldoMinutos)} min (-${formatMinutesToHuman(Math.abs(sumSaldoMinutos))})`, 185, currentY + 34);
    } else if (sumSaldoMinutos > 0) {
      doc.setTextColor(22, 163, 74);
      doc.text(`Crédito de +${sumSaldoMinutos} min (+${formatMinutesToHuman(sumSaldoMinutos)})`, 185, currentY + 34);
    } else {
      doc.setTextColor(108, 62, 244);
      doc.text(`Saldo em dia (0 min)`, 185, currentY + 34);
    }

    // Linha divisória interna do quadro
    doc.setDrawColor(221, 214, 254);
    doc.line(20, currentY + 38, 273, currentY + 38);

    // Linha Financeira
    doc.setFontSize(9.5);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`Valor Bruto (${totalDiasTrabalhados} dias × R$ 75,00): R$ ${valorBrutoDias.toFixed(2).replace('.', ',')}`, 20, currentY + 45);

    doc.setTextColor(220, 38, 38);
    doc.text(`(-) Total de Desconto: R$ ${totalDescontoFinanceiro.toFixed(2).replace('.', ',')}`, 125, currentY + 45);

    doc.setTextColor(108, 62, 244);
    doc.text(`(=) Valor Líquido Correspondente: R$ ${valorLiquido.toFixed(2).replace('.', ',')}`, 198, currentY + 45);

    // ASSINATURAS
    let signatureY = currentY + 62;
    if (signatureY + 20 > 200) {
      doc.addPage();
      signatureY = 25;
    }

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    doc.line(20, signatureY, 110, signatureY);
    doc.text(`Assinatura do Colaborador: ${workerName}`, 20, signatureY + 4);

    doc.line(170, signatureY, 260, signatureY);
    doc.text(`Assinatura do Empregador: ${employerName}`, 170, signatureY + 4);

    doc.text(`Data: ____ / ____ / ________`, 20, signatureY + 11);

    doc.save(`Folha_de_Ponto_${workerName.replace(/\s/g, '_')}_${selectedPdfMonth}.pdf`);
  };

  // Cálculos acumulados do Banco de Horas Geral
  const monthToCalculate = entries;
  const totalStats = monthToCalculate.reduce((acc, curr) => {
    const d = calculateDayDetails(
      curr.morningArrival,
      curr.morningExit,
      curr.afternoonArrival,
      curr.afternoonExit,
      curr.schoolMinutes || 0
    );
    acc.atrasos += d.atrasos;
    acc.buscarFilho += d.buscarFilho;
    acc.creditoPermanencia += d.creditoPermanencia;
    acc.saldoMinutos += d.saldoMinutos;
    acc.desconto += d.descontoDia;
    return acc;
  }, { atrasos: 0, buscarFilho: 0, creditoPermanencia: 0, saldoMinutos: 0, desconto: 0 });

  const formattedDateDisplay = format(new Date(selectedDate + 'T00:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR });

  // Detalhes em tempo real da data selecionada
  const currentDayDetails = calculateDayDetails(
    morningArrival,
    morningExit,
    afternoonArrival,
    afternoonExit,
    schoolMinutes
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <header className="mb-2">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400">
          Controle de Ponto
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium">Controle detalhado de jornada, atrasos e banco de horas</p>
      </header>

      {/* BANCO DE HORAS ACUMULADO */}
      <Card className="bg-gradient-to-br from-indigo-50/50 to-violet-50/50 border-indigo-100 dark:from-indigo-950/20 dark:to-violet-950/20 dark:border-indigo-900/50 p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h2 className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">Banco de Horas Acumulado</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Saldo consolidado de todos os registros de ponto</p>
          </div>
          {entries.length > 0 && (
            <button
              onClick={handleResetTimeBank}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 flex items-center gap-1 transition-colors bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-rose-100 dark:border-rose-900/50 shadow-sm cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Zerar Saldo
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
          {/* Atrasos */}
          <div className="bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-indigo-50 dark:border-slate-800/80 shadow-xs flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Total Atrasos</span>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-lg font-black text-rose-600 dark:text-rose-400">
                {formatMinutesToHuman(totalStats.atrasos)}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">atrasos em entradas/saídas</span>
          </div>

          {/* Buscar Filho */}
          <div className="bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-indigo-50 dark:border-slate-800/80 shadow-xs flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Buscar Filho</span>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                {formatMinutesToHuman(totalStats.buscarFilho)}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">saídas escolares</span>
          </div>

          {/* Créditos */}
          <div className="bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-indigo-50 dark:border-slate-800/80 shadow-xs flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Crédito Perm.</span>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                +{formatMinutesToHuman(totalStats.creditoPermanencia)}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">tempo extra após 17:00</span>
          </div>

          {/* Saldo Líquido */}
          <div className="bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-indigo-50 dark:border-slate-800/80 shadow-xs flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Desconto Total</span>
            <div className="flex items-center gap-1 mt-1">
              <span className={`text-lg font-black ${totalStats.desconto > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}>
                R$ {totalStats.desconto.toFixed(2)}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">
              {totalStats.saldoMinutos < 0 ? `saldo: -${Math.abs(totalStats.saldoMinutos)} min` : 'saldo em dia'}
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
              <span>Exportar Folha de Ponto Detalhada (PDF)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Gere um relatório completo e autoexplicativo em PDF, com cálculo detalhado por dia e resumo mensal para o RH.
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

        {/* Saída para Buscar Filho na Escola */}
        <div className="bg-amber-50/45 dark:bg-amber-950/10 p-3.5 rounded-xl border border-amber-100 dark:border-amber-900/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Saída para buscar o filho na escola
              </span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Os minutos informados aqui serão descontados separadamente, sem misturar com atrasos de pontualidade.
              </p>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <input
                type="number"
                min="0"
                value={schoolMinutes || ''}
                onChange={(e) => setSchoolMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0"
                className="w-20 text-center bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-lg p-1.5 font-bold text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">minutos</span>
            </div>
          </div>
        </div>

        {/* QUADRO DETALHADO AUTOEXPLICATIVO DO DIA SELECIONADO */}
        <div className="bg-gradient-to-br from-violet-50/80 to-indigo-50/80 dark:from-slate-950 dark:to-violet-950/30 p-4 rounded-xl border border-violet-100 dark:border-violet-900/50 space-y-3">
          <div className="flex justify-between items-center border-b border-violet-200/60 dark:border-violet-900/50 pb-2">
            <span className="text-xs font-bold text-violet-900 dark:text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-4 h-4 text-violet-600" />
              RESUMO DETALHADO DO DIA (CÁLCULO AUTOMÁTICO)
            </span>
            <span className={`text-xs font-black px-2.5 py-0.5 rounded-md ${
              currentDayDetails.saldoMinutos < 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
              currentDayDetails.saldoMinutos > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
              'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}>
              {currentDayDetails.saldoMinutos < 0 ? `Desconto R$ ${currentDayDetails.descontoDia.toFixed(2)}` :
               currentDayDetails.saldoMinutos > 0 ? `+${formatMinutesToHuman(currentDayDetails.saldoMinutos)} crédito` :
               'Sem descontos'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block font-bold">1. Jornada Prevista</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">7h 30min (450m)</span>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block font-bold">2. Tempo Registrado</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatMinutesToHuman(currentDayDetails.tempoRegistrado)}</span>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block font-bold">3. Total Atrasos</span>
              <span className={`font-bold ${currentDayDetails.atrasos > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                {formatMinutesToHuman(currentDayDetails.atrasos)}
              </span>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block font-bold">4. Buscar Filho</span>
              <span className={`font-bold ${currentDayDetails.buscarFilho > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                {formatMinutesToHuman(currentDayDetails.buscarFilho)}
              </span>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block font-bold">5. Crédito Permanência</span>
              <span className={`font-bold ${currentDayDetails.creditoPermanencia > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                {formatMinutesToHuman(currentDayDetails.creditoPermanencia)}
              </span>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-400 block font-bold">6. Tempo p/ Pagamento</span>
              <span className="font-bold text-violet-700 dark:text-violet-300">{formatMinutesToHuman(currentDayDetails.tempoConsiderado)}</span>
            </div>
          </div>

          {/* MEMÓRIA DE CÁLCULO PASSO A PASSO */}
          <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl border border-violet-200/80 dark:border-violet-900/60 space-y-2 text-xs">
            <span className="font-extrabold text-violet-950 dark:text-violet-200 block border-b border-slate-100 dark:border-slate-800 pb-1.5 uppercase text-[11px] tracking-wide">
              Como o saldo do banco de horas foi calculado:
            </span>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                <span>Crédito por permanência.............</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">+{currentDayDetails.creditoPermanencia} min</span>
              </div>
              <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                <span>Atrasos.............................</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">-{currentDayDetails.atrasos} min</span>
              </div>
              <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                <span>Buscar filho........................</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">-{currentDayDetails.buscarFilho} min</span>
              </div>
              <div className="flex justify-between items-center text-slate-900 dark:text-white font-extrabold border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1 font-sans text-xs">
                <span>Saldo do banco de horas.............</span>
                <span className={currentDayDetails.saldoMinutos < 0 ? 'text-rose-600 dark:text-rose-400' : currentDayDetails.saldoMinutos > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}>
                  {currentDayDetails.saldoMinutos < 0 ? `-${Math.abs(currentDayDetails.saldoMinutos)} min` : `+${currentDayDetails.saldoMinutos} min`}
                </span>
              </div>
            </div>
          </div>

          {/* OBSERVATIVO REGRA FIXA */}
          <div className="p-3 bg-amber-50/90 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-900/60 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed space-y-1">
            <span className="font-bold block text-amber-950 dark:text-amber-100 flex items-center gap-1">
              📌 Regra oficial do cálculo:
            </span>
            <p>
              "O saldo do banco de horas é calculado utilizando apenas os créditos obtidos pela permanência após o horário previsto de saída, descontando os atrasos e o tempo utilizado para buscar o filho. O Tempo Considerado para Pagamento possui finalidade exclusivamente financeira e não participa do cálculo do banco de horas."
            </p>
          </div>
        </div>

        {/* BOTAO SALVAR */}
        <button
          onClick={handleSave}
          className={`w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center space-x-2 shadow-md transition-all duration-300 transform active:scale-95 cursor-pointer ${
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
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {entries
              .sort((a, b) => b.date.localeCompare(a.date))
              .map(entry => {
                const dateObj = new Date(entry.date + 'T00:00:00');
                const dayName = format(dateObj, 'EEE', { locale: ptBR }).toUpperCase();
                const dayNum = format(dateObj, 'dd/MM');

                const dayDetails = calculateDayDetails(
                  entry.morningArrival,
                  entry.morningExit,
                  entry.afternoonArrival,
                  entry.afternoonExit,
                  entry.schoolMinutes || 0
                );

                return (
                  <div key={entry.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl p-3 space-y-2 hover:border-slate-200 dark:hover:border-slate-800 transition-all shadow-2xs">
                    <div className="flex justify-between items-center">
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
                            Registrado: {formatMinutesToHuman(dayDetails.tempoRegistrado)} | Atraso: {dayDetails.atrasos}m | Buscar filho: {dayDetails.buscarFilho}m | Crédito: {dayDetails.creditoPermanencia}m
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {dayDetails.saldoMinutos < 0 ? (
                              <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400">-{Math.abs(dayDetails.saldoMinutos)} min</span>
                            ) : dayDetails.saldoMinutos > 0 ? (
                              <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">+{dayDetails.saldoMinutos} min</span>
                            ) : (
                              <span className="text-xs font-bold text-slate-500">Em dia</span>
                            )}
                          </div>
                          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            {dayDetails.saldoMinutos < 0 ? (
                              <span className="text-rose-500">Desc. R$ {dayDetails.descontoDia.toFixed(2)}</span>
                            ) : dayDetails.saldoMinutos > 0 ? (
                              <span className="text-emerald-500">Sem desconto</span>
                            ) : (
                              'R$ 0.00'
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:text-slate-600 dark:hover:text-rose-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* METODOLOGIA / EXPLICATIVO */}
      <Card className="bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 p-3.5 text-xs text-slate-500 space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
          <HelpCircle className="w-4 h-4 text-violet-500" />
          <span>Como funciona a metodologia detalhada de cálculo?</span>
        </div>
        <p className="leading-relaxed">
          O sistema realiza o cálculo com transparência total e zero segredos:
        </p>
        <ul className="list-disc pl-4 space-y-1.5 leading-relaxed">
          <li><strong>Jornada Padronizada:</strong> 08:00 às 12:00 e 13:30 às 17:00 (Total previsto: 7h 30min / 450 minutos diários).</li>
          <li><strong>Valor Diário e do Minuto:</strong> Diária de R$ 75,00 ÷ 450 min = <strong>R$ 0,166667 por minuto</strong>.</li>
          <li><strong>Tempo Considerado:</strong> Tempo Registrado - Total de Atrasos - Tempo para Buscar Filho.</li>
          <li><strong>Saldo e Desconto do Dia:</strong> Créditos de Permanência (após as 17:00) abatem os Atrasos e a Saída para Buscar Filho. Se houver saldo negativo, o valor correspondente ao saldo é descontado. Se o saldo for positivo, permanece registrado como crédito de tempo.</li>
        </ul>
      </Card>
    </div>
  );
};

export default PontoTab;
