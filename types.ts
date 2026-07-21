

export enum WorkStatus {
  WORKED = 'WORKED',
  HALF_DAY = 'HALF_DAY',
  MISSED = 'MISSED',
  DAY_OFF = 'DAY_OFF',
  EXTRA_SERVICE = 'EXTRA_SERVICE',
  SATURDAY_FULL = 'SATURDAY_FULL',
  SUNDAY = 'SUNDAY',
}

export interface WorkEntry {
  id: string;
  date: string; // ISO string YYYY-MM-DD
  status: WorkStatus;
  note?: string;
  dailyRateSnapshot: number; // Armazena o valor da diária OU o valor do serviço extra
  overtimeValue?: number; // Valor das horas extras
  serviceTitle?: string; // Nome do serviço extra (ex: "Instalação Elétrica")
}

export interface AdvanceEntry {
  id: string;
  date: string; // ISO string YYYY-MM-DD
  amount: number;
  note?: string;
}

// FIX: Added ExpenseEntry type for the ExpensesTab component.
export interface ExpenseEntry {
  id: string;
  date: string; // ISO string YYYY-MM-DD
  amount: number;
  note?: string;
}

export interface ToolEntry {
  id: string;
  date: string; // ISO string YYYY-MM-DD
  name: string;
  amount: number;
  note?: string;
}

export interface CycleHistory {
  id: string;
  startDate: string;
  endDate: string;
  stats: MonthlyStats;
  workerName: string;
  employerName: string;
}

export interface UserSettings {
  dailyRate: number;
  workerName: string;
  employerName: string;
  currency: string;
  theme: 'light' | 'dark';
  notificationEnabled: boolean;
  notificationTime: string; // Format "HH:mm"
  billingCycleStartDate?: string; // Data de início do ciclo atual (reset do saldo)
}

export interface MonthlyStats {
  daysWorked: number;
  daysMissed: number;
  grossTotal: number;
  totalAdvances: number;
  totalFromTools: number;
  finalTotal: number;
  // Detalhamento do valor bruto
  totalFromDays: number;
  totalFromOvertime: number;
  totalFromExtraServices: number;
  pontoMinutesOwed?: number;
  pontoDiscountValue?: number;
}

export interface PontoEntry {
  id: string;
  date: string; // ISO string YYYY-MM-DD
  morningArrival: string; // "HH:MM" e.g., "08:05"
  morningExit: string; // "HH:MM" e.g., "12:00"
  afternoonArrival: string; // "HH:MM" e.g., "13:35"
  afternoonExit: string; // "HH:MM" e.g., "17:00"
  morningDelay: number; // minutos de atraso na entrada (positivo = devendo, negativo = adiantado)
  morningExitDelay: number; // minutos de saída antecipada (positivo = devendo, negativo = extra)
  afternoonDelay: number; // minutos de atraso no retorno (positivo = devendo, negativo = adiantado)
  afternoonExitDelay: number; // minutos de saída antecipada (positivo = devendo, negativo = extra)
  totalDelay: number; // soma dos 4 desvios + outros atrasos (ex: busca do filho)
  valueEquivalent: number; // totalDelay * (75 / 450)
  schoolMinutes?: number; // minutos extras gastos buscando o filho na escola
}
