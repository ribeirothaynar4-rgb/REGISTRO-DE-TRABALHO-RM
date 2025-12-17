

export enum WorkStatus {
  WORKED = 'WORKED',
  HALF_DAY = 'HALF_DAY',
  MISSED = 'MISSED',
  DAY_OFF = 'DAY_OFF',
  EXTRA_SERVICE = 'EXTRA_SERVICE',
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
  finalTotal: number;
  // Detalhamento do valor bruto
  totalFromDays: number;
  totalFromOvertime: number;
  totalFromExtraServices: number;
}