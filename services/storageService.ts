
import { WorkEntry, AdvanceEntry, UserSettings, WorkStatus, ExpenseEntry } from '../types';
import { format, subDays, startOfMonth } from 'date-fns';
import { supabase } from './supabaseClient';

const KEYS = {
  WORK_ENTRIES: 'mrt_work_entries',
  ADVANCES: 'mrt_advances',
  EXPENSES: 'mrt_expenses',
  SETTINGS: 'mrt_settings',
  LAST_NOTIF: 'mrt_last_notification_date'
};

export const clearLocalData = () => {
  localStorage.removeItem(KEYS.WORK_ENTRIES);
  localStorage.removeItem(KEYS.ADVANCES);
  localStorage.removeItem(KEYS.EXPENSES);
  localStorage.removeItem(KEYS.SETTINGS);
};

const syncKeyToSupabase = async (key: string, data: any): Promise<boolean> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return false; 
  try {
    const { error } = await supabase
      .from('historico_ia')
      .upsert(
        { 
          user_id: session.user.id, 
          category: key, 
          data: data,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id, category' }
      );
    return !error;
  } catch (err) {
    return false;
  }
};

export const fetchAllFromSupabase = async (): Promise<boolean> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return false;
  try {
    const { data, error } = await supabase
      .from('historico_ia')
      .select('category, data')
      .eq('user_id', session.user.id);
    if (error) throw error;
    if (data && data.length > 0) {
      data.forEach(row => {
        if (row.data) localStorage.setItem(row.category, JSON.stringify(row.data));
      });
      return true;
    }
    return true; 
  } catch (err) {
    return false;
  }
};

export const getWorkEntries = (): WorkEntry[] => {
  try {
    const data = localStorage.getItem(KEYS.WORK_ENTRIES);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

export const getAdvances = (): AdvanceEntry[] => {
  try {
    const data = localStorage.getItem(KEYS.ADVANCES);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

export const getExpenses = (): ExpenseEntry[] => {
  try {
    const data = localStorage.getItem(KEYS.EXPENSES);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

export const getSettings = (): UserSettings => {
  const defaultSettings: UserSettings = {
    dailyRate: 200,
    workerName: '',
    employerName: '',
    currency: 'BRL',
    theme: 'light',
    notificationEnabled: false,
    notificationTime: '18:00',
    billingCycleStartDate: '2024-12-16' // Valor que você mencionou como exemplo
  };
  try {
    const data = localStorage.getItem(KEYS.SETTINGS);
    if (data) return { ...defaultSettings, ...JSON.parse(data) };
  } catch {}
  return defaultSettings;
};

export const saveWorkEntry = (entry: WorkEntry) => {
  const entries = getWorkEntries();
  const index = entries.findIndex(e => e.id === entry.id);
  if (index >= 0) entries[index] = entry; else entries.push(entry);
  localStorage.setItem(KEYS.WORK_ENTRIES, JSON.stringify(entries));
  syncKeyToSupabase(KEYS.WORK_ENTRIES, entries);
};

export const deleteWorkEntry = (id: string) => {
  const newEntries = getWorkEntries().filter(e => e.id !== id);
  localStorage.setItem(KEYS.WORK_ENTRIES, JSON.stringify(newEntries));
  syncKeyToSupabase(KEYS.WORK_ENTRIES, newEntries);
};

export const saveAdvance = (advance: AdvanceEntry) => {
  const advances = getAdvances();
  const index = advances.findIndex(a => a.id === advance.id);
  if (index >= 0) advances[index] = advance; else advances.push(advance);
  localStorage.setItem(KEYS.ADVANCES, JSON.stringify(advances));
  syncKeyToSupabase(KEYS.ADVANCES, advances);
};

export const deleteAdvance = (id: string) => {
  const newAdvances = getAdvances().filter(a => a.id !== id);
  localStorage.setItem(KEYS.ADVANCES, JSON.stringify(newAdvances));
  syncKeyToSupabase(KEYS.ADVANCES, newAdvances);
};

export const saveExpense = (expense: ExpenseEntry) => {
  const expenses = getExpenses();
  const index = expenses.findIndex(e => e.id === expense.id);
  if (index >= 0) expenses[index] = expense; else expenses.push(expense);
  localStorage.setItem(KEYS.EXPENSES, JSON.stringify(expenses));
  syncKeyToSupabase(KEYS.EXPENSES, expenses);
};

export const deleteExpense = (id: string) => {
  const newExpenses = getExpenses().filter(e => e.id !== id);
  localStorage.setItem(KEYS.EXPENSES, JSON.stringify(newExpenses));
  syncKeyToSupabase(KEYS.EXPENSES, newExpenses);
};

export const saveSettings = (settings: UserSettings) => {
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  syncKeyToSupabase(KEYS.SETTINGS, settings);
};

export const setLastNotificationDate = (dateStr: string) => localStorage.setItem(KEYS.LAST_NOTIF, dateStr);
export const getLastNotificationDate = (): string | null => localStorage.getItem(KEYS.LAST_NOTIF);

export const exportAllData = (): string => {
  return JSON.stringify({
    workEntries: getWorkEntries(),
    advances: getAdvances(),
    expenses: getExpenses(),
    settings: getSettings(),
    exportedAt: new Date().toISOString()
  });
};

export const importAllData = async (jsonString: string): Promise<boolean> => {
  try {
    const data = JSON.parse(jsonString);
    localStorage.setItem(KEYS.WORK_ENTRIES, JSON.stringify(data.workEntries || []));
    localStorage.setItem(KEYS.ADVANCES, JSON.stringify(data.advances || []));
    localStorage.setItem(KEYS.EXPENSES, JSON.stringify(data.expenses || []));
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings || {}));
    await Promise.all([
      syncKeyToSupabase(KEYS.WORK_ENTRIES, data.workEntries),
      syncKeyToSupabase(KEYS.ADVANCES, data.advances),
      syncKeyToSupabase(KEYS.SETTINGS, data.settings)
    ]);
    return true;
  } catch { return false; }
};

export const generateTestData = () => {
  const today = new Date();
  const settings = getSettings();
  const entries: WorkEntry[] = [];
  for (let i = 0; i < 20; i++) {
    const d = format(subDays(today, i), 'yyyy-MM-dd');
    entries.push({ id: d, date: d, status: WorkStatus.WORKED, dailyRateSnapshot: settings.dailyRate });
  }
  localStorage.setItem(KEYS.WORK_ENTRIES, JSON.stringify(entries));
  syncKeyToSupabase(KEYS.WORK_ENTRIES, entries);
};
