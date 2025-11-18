


// FIX: Import ExpenseEntry type.
import { WorkEntry, AdvanceEntry, UserSettings, WorkStatus, ExpenseEntry } from '../types';
import { format, subDays } from 'date-fns';

const KEYS = {
  WORK_ENTRIES: 'mrt_work_entries',
  ADVANCES: 'mrt_advances',
  // FIX: Add key for expenses.
  EXPENSES: 'mrt_expenses',
  SETTINGS: 'mrt_settings',
  LAST_NOTIF: 'mrt_last_notification_date'
};

export const getWorkEntries = (): WorkEntry[] => {
  const data = localStorage.getItem(KEYS.WORK_ENTRIES);
  return data ? JSON.parse(data) : [];
};

export const saveWorkEntry = (entry: WorkEntry) => {
  const entries = getWorkEntries();
  const index = entries.findIndex(e => e.id === entry.id);
  
  if (index >= 0) {
    entries[index] = entry;
  } else {
    entries.push(entry);
  }
  localStorage.setItem(KEYS.WORK_ENTRIES, JSON.stringify(entries));
};

export const deleteWorkEntry = (id: string) => {
  const entries = getWorkEntries();
  const newEntries = entries.filter(e => e.id !== id);
  localStorage.setItem(KEYS.WORK_ENTRIES, JSON.stringify(newEntries));
};

export const getAdvances = (): AdvanceEntry[] => {
  const data = localStorage.getItem(KEYS.ADVANCES);
  return data ? JSON.parse(data) : [];
};

export const saveAdvance = (advance: AdvanceEntry) => {
  const advances = getAdvances();
  const index = advances.findIndex(a => a.id === advance.id);
  if (index >= 0) {
    advances[index] = advance;
  } else {
    advances.push(advance);
  }
  localStorage.setItem(KEYS.ADVANCES, JSON.stringify(advances));
};

export const deleteAdvance = (id: string) => {
  const advances = getAdvances().filter(a => a.id !== id);
  localStorage.setItem(KEYS.ADVANCES, JSON.stringify(advances));
};

// FIX: Add functions to get, save, and delete expenses.
export const getExpenses = (): ExpenseEntry[] => {
  const data = localStorage.getItem(KEYS.EXPENSES);
  return data ? JSON.parse(data) : [];
};

export const saveExpense = (expense: ExpenseEntry) => {
  const expenses = getExpenses();
  const index = expenses.findIndex(e => e.id === expense.id);
  if (index >= 0) {
    expenses[index] = expense;
  } else {
    expenses.push(expense);
  }
  localStorage.setItem(KEYS.EXPENSES, JSON.stringify(expenses));
};

export const deleteExpense = (id: string) => {
  const expenses = getExpenses();
  const newExpenses = expenses.filter(e => e.id !== id);
  localStorage.setItem(KEYS.EXPENSES, JSON.stringify(newExpenses));
};

export const getSettings = (): UserSettings => {
  const data = localStorage.getItem(KEYS.SETTINGS);
  const defaultSettings: UserSettings = {
    dailyRate: 200,
    workerName: '',
    employerName: '',
    currency: 'BRL',
    theme: 'light',
    notificationEnabled: false,
    notificationTime: '18:00'
  };

  if (data) {
    const parsed = JSON.parse(data);
    // Merge defaults to ensure new fields exist for old users
    return { ...defaultSettings, ...parsed };
  }
  
  return defaultSettings;
};

export const saveSettings = (settings: UserSettings) => {
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
};

// --- Helpers para Notificação ---
export const setLastNotificationDate = (dateStr: string) => {
    localStorage.setItem(KEYS.LAST_NOTIF, dateStr);
}

export const getLastNotificationDate = (): string | null => {
    return localStorage.getItem(KEYS.LAST_NOTIF);
}


// --- FUNÇÕES DE BACKUP ---

export const exportAllData = (): string => {
  const backupData = {
    workEntries: getWorkEntries(),
    advances: getAdvances(),
    // FIX: Include expenses in the backup data.
    expenses: getExpenses(),
    settings: getSettings(),
    exportedAt: new Date().toISOString(),
    appVersion: '1.1' // Updated version
  };
  return JSON.stringify(backupData);
};

export const importAllData = (jsonString: string): boolean => {
  try {
    const data = JSON.parse(jsonString);
    
    if (!data.workEntries || !data.advances || !data.settings) {
      throw new Error("Arquivo de backup inválido.");
    }

    localStorage.setItem(KEYS.WORK_ENTRIES, JSON.stringify(data.workEntries));
    localStorage.setItem(KEYS.ADVANCES, JSON.stringify(data.advances));
    // FIX: Handle expenses during data import for backward compatibility.
    if (data.expenses) {
      localStorage.setItem(KEYS.EXPENSES, JSON.stringify(data.expenses));
    } else {
      localStorage.setItem(KEYS.EXPENSES, JSON.stringify([]));
    }
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings));
    
    return true;
  } catch (e) {
    console.error("Erro ao importar:", e);
    return false;
  }
};

// --- DADOS DE TESTE ---

export const generateTestData = () => {
  localStorage.clear(); // Limpa tudo antes
  const today = new Date();
  const entries: WorkEntry[] = [];
  const advances: AdvanceEntry[] = [];
  // FIX: Initialize expenses array for test data.
  const expenses: ExpenseEntry[] = [];
  
  const demoSettings: UserSettings = {
    dailyRate: 250,
    workerName: 'Trabalhador Exemplo',
    employerName: 'Construtora Modelo',
    currency: 'BRL',
    theme: 'light',
    notificationEnabled: false,
    notificationTime: '18:00'
  };
  saveSettings(demoSettings);

  for (let i = 0; i < 45; i++) {
    const date = subDays(today, i);
    if (date.getDay() === 0) continue;

    const dateStr = format(date, 'yyyy-MM-dd');
    const rand = Math.random();
    
    let status = WorkStatus.WORKED;
    let overtimeValue = undefined;
    let dailyRateSnapshot = 250;

    if (rand > 0.9) status = WorkStatus.HALF_DAY;
    else if (rand > 0.8) status = WorkStatus.MISSED;
    else if (rand > 0.5) overtimeValue = 50;
    
    if (status !== WorkStatus.MISSED) {
      entries.push({ id: dateStr, date: dateStr, status, dailyRateSnapshot, overtimeValue });
    }
  }

  advances.push({ id: 'demo_adv_1', date: format(subDays(today, 10), 'yyyy-MM-dd'), amount: 100, note: 'Gasolina' });
  advances.push({ id: 'demo_adv_2', date: format(subDays(today, 5), 'yyyy-MM-dd'), amount: 150, note: 'Almoço equipe' });

  // FIX: Add sample expenses.
  expenses.push({ id: 'demo_exp_1', date: format(subDays(today, 12), 'yyyy-MM-dd'), amount: 80, note: 'Ferramenta nova' });
  expenses.push({ id: 'demo_exp_2', date: format(subDays(today, 3), 'yyyy-MM-dd'), amount: 45.50, note: 'Material para reparo' });

  localStorage.setItem(KEYS.WORK_ENTRIES, JSON.stringify(entries));
  localStorage.setItem(KEYS.ADVANCES, JSON.stringify(advances));
  // FIX: Save expenses test data to localStorage.
  localStorage.setItem(KEYS.EXPENSES, JSON.stringify(expenses));
};