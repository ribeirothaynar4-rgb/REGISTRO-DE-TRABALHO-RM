
import { WorkEntry, AdvanceEntry, UserSettings, WorkStatus, ExpenseEntry, ToolEntry, CycleHistory, MonthlyStats } from '../types';
import { format, subDays, startOfMonth, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { supabase } from './supabaseClient';

const KEYS = {
  WORK_ENTRIES: 'mrt_work_entries',
  ADVANCES: 'mrt_advances',
  EXPENSES: 'mrt_expenses',
  TOOLS: 'mrt_tools',
  CYCLE_HISTORY: 'mrt_cycle_history',
  SETTINGS: 'mrt_settings',
  LAST_NOTIF: 'mrt_last_notification_date'
};

export const clearLocalData = () => {
  localStorage.removeItem(KEYS.WORK_ENTRIES);
  localStorage.removeItem(KEYS.ADVANCES);
  localStorage.removeItem(KEYS.EXPENSES);
  localStorage.removeItem(KEYS.TOOLS);
  localStorage.removeItem(KEYS.CYCLE_HISTORY);
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

export const getTools = (): ToolEntry[] => {
  try {
    const data = localStorage.getItem(KEYS.TOOLS);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

export const getCycleHistory = (): CycleHistory[] => {
  try {
    const data = localStorage.getItem(KEYS.CYCLE_HISTORY);
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

export const saveTool = (tool: ToolEntry) => {
  const tools = getTools();
  const index = tools.findIndex(t => t.id === tool.id);
  if (index >= 0) tools[index] = tool; else tools.push(tool);
  localStorage.setItem(KEYS.TOOLS, JSON.stringify(tools));
  syncKeyToSupabase(KEYS.TOOLS, tools);
};

export const deleteTool = (id: string) => {
  const newTools = getTools().filter(t => t.id !== id);
  localStorage.setItem(KEYS.TOOLS, JSON.stringify(newTools));
  syncKeyToSupabase(KEYS.TOOLS, newTools);
};

export const saveCycleHistory = (cycle: CycleHistory) => {
  const history = getCycleHistory();
  history.push(cycle);
  localStorage.setItem(KEYS.CYCLE_HISTORY, JSON.stringify(history));
  syncKeyToSupabase(KEYS.CYCLE_HISTORY, history);
};

export const deleteCycleHistory = (id: string) => {
  const newHistory = getCycleHistory().filter(c => c.id !== id);
  localStorage.setItem(KEYS.CYCLE_HISTORY, JSON.stringify(newHistory));
  syncKeyToSupabase(KEYS.CYCLE_HISTORY, newHistory);
};

export const saveSettings = (settings: UserSettings) => {
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  syncKeyToSupabase(KEYS.SETTINGS, settings);
};

export const setLastNotificationDate = (dateStr: string) => localStorage.setItem(KEYS.LAST_NOTIF, dateStr);
export const getLastNotificationDate = (): string | null => localStorage.getItem(KEYS.LAST_NOTIF);

export const calculateStats = (startDate: string, endDate: string): MonthlyStats => {
  const entries = getWorkEntries();
  const advances = getAdvances();
  const tools = getTools();

  const start = startOfDay(parseISO(startDate));
  const end = endOfDay(parseISO(endDate));

  const fEntries = entries.filter(e => isWithinInterval(parseISO(e.date), { start, end }));
  const fAdvances = advances.filter(a => isWithinInterval(parseISO(a.date), { start, end }));
  const fTools = tools.filter(t => isWithinInterval(parseISO(t.date), { start, end }));

  const s: MonthlyStats = {
    daysWorked: 0, daysMissed: 0, grossTotal: 0, totalAdvances: 0, totalFromTools: 0, finalTotal: 0,
    totalFromDays: 0, totalFromOvertime: 0, totalFromExtraServices: 0,
  };

  fEntries.forEach(e => {
    if (e.status === WorkStatus.WORKED) { s.daysWorked += 1; s.totalFromDays += e.dailyRateSnapshot; }
    else if (e.status === WorkStatus.HALF_DAY) { s.daysWorked += 0.5; s.totalFromDays += (e.dailyRateSnapshot / 2); }
    else if (e.status === WorkStatus.SATURDAY_FULL) { s.daysWorked += 1; s.totalFromDays += e.dailyRateSnapshot; }
    else if (e.status === WorkStatus.SUNDAY) { s.daysWorked += 1; s.totalFromDays += e.dailyRateSnapshot; }
    else if (e.status === WorkStatus.MISSED) s.daysMissed += 1;
    else if (e.status === WorkStatus.EXTRA_SERVICE) s.totalFromExtraServices += e.dailyRateSnapshot;
    if (e.overtimeValue) s.totalFromOvertime += e.overtimeValue;
  });

  s.grossTotal = s.totalFromDays + s.totalFromOvertime + s.totalFromExtraServices;
  s.totalAdvances = fAdvances.reduce((acc, curr) => acc + curr.amount, 0);
  s.totalFromTools = fTools.reduce((acc, curr) => acc + curr.amount, 0);
  s.finalTotal = (s.grossTotal + s.totalFromTools) - s.totalAdvances;

  return s;
};

export const exportAllData = (): string => {
  return JSON.stringify({
    workEntries: getWorkEntries(),
    advances: getAdvances(),
    expenses: getExpenses(),
    tools: getTools(),
    cycleHistory: getCycleHistory(),
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
    localStorage.setItem(KEYS.TOOLS, JSON.stringify(data.tools || []));
    localStorage.setItem(KEYS.CYCLE_HISTORY, JSON.stringify(data.cycleHistory || []));
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings || {}));
    await Promise.all([
      syncKeyToSupabase(KEYS.WORK_ENTRIES, data.workEntries),
      syncKeyToSupabase(KEYS.ADVANCES, data.advances),
      syncKeyToSupabase(KEYS.TOOLS, data.tools),
      syncKeyToSupabase(KEYS.CYCLE_HISTORY, data.cycleHistory),
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
