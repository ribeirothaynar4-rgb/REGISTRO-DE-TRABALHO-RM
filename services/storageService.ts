import { WorkEntry, AdvanceEntry, UserSettings, WorkStatus, ExpenseEntry } from '../types';
import { format, subDays } from 'date-fns';
import { supabase } from './supabaseClient';

const KEYS = {
  WORK_ENTRIES: 'mrt_work_entries',
  ADVANCES: 'mrt_advances',
  EXPENSES: 'mrt_expenses',
  SETTINGS: 'mrt_settings',
  LAST_NOTIF: 'mrt_last_notification_date'
};

// --- FUNÇÕES AUXILIARES ---

export const clearLocalData = () => {
  localStorage.removeItem(KEYS.WORK_ENTRIES);
  localStorage.removeItem(KEYS.ADVANCES);
  localStorage.removeItem(KEYS.EXPENSES);
  localStorage.removeItem(KEYS.SETTINGS);
  // Não limpamos LAST_NOTIF necessariamente, mas podemos se quiser resetar o aviso
};

// --- FUNÇÕES DE SINCRONIZAÇÃO COM SUPABASE (TABELA historico_ia) ---

// Envia dados para o Supabase (Background Sync)
const syncKeyToSupabase = async (key: string, data: any) => {
  // 1. Pega o usuário logado ATUAL
  const { data: { session } } = await supabase.auth.getSession();
  
  // Se não tem usuário, não salva na nuvem (apenas local)
  if (!session?.user) return; 

  try {
    // 2. Faz o Upsert usando o ID do usuário
    const { error } = await supabase
      .from('historico_ia')
      .upsert(
        { 
          user_id: session.user.id, // GARANTE que o dado é deste usuário
          category: key, 
          data: data,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id, category' }
      );

    if (error) console.error(`Erro ao sincronizar ${key}:`, error);
  } catch (err) {
    console.error("Erro de conexão ao salvar no banco:", err);
  }
};

// Baixa todos os dados do Supabase ao iniciar (Load)
export const fetchAllFromSupabase = async (): Promise<boolean> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return false;

  try {
    // 1. ANTES de baixar, limpamos o LocalStorage para evitar misturar dados
    // se o usuário anterior deixou lixo no cache.
    clearLocalData();

    // 2. Busca apenas os dados do usuário logado
    const { data, error } = await supabase
      .from('historico_ia')
      .select('category, data')
      .eq('user_id', session.user.id); // Filtro crucial

    if (error) throw error;

    if (data && data.length > 0) {
      data.forEach(row => {
        // Atualiza o LocalStorage com o que veio do banco
        localStorage.setItem(row.category, JSON.stringify(row.data));
      });
      return true;
    }
    // Se não tiver dados no banco (usuário novo), o LocalStorage já foi limpo acima,
    // então ele começa zerado (correto).
    return true; 
  } catch (err) {
    console.error("Erro ao baixar dados do Supabase:", err);
    return false;
  }
};

// --- GETTERS (Leitura Local - Rápida) ---

export const getWorkEntries = (): WorkEntry[] => {
  const data = localStorage.getItem(KEYS.WORK_ENTRIES);
  return data ? JSON.parse(data) : [];
};

export const getAdvances = (): AdvanceEntry[] => {
  const data = localStorage.getItem(KEYS.ADVANCES);
  return data ? JSON.parse(data) : [];
};

export const getExpenses = (): ExpenseEntry[] => {
  const data = localStorage.getItem(KEYS.EXPENSES);
  return data ? JSON.parse(data) : [];
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
    return { ...defaultSettings, ...parsed };
  }
  
  return defaultSettings;
};

// --- SETTERS (Escrita Local + Sincronização Nuvem) ---

export const saveWorkEntry = (entry: WorkEntry) => {
  const entries = getWorkEntries();
  const index = entries.findIndex(e => e.id === entry.id);
  
  if (index >= 0) {
    entries[index] = entry;
  } else {
    entries.push(entry);
  }
  
  // Salva local
  localStorage.setItem(KEYS.WORK_ENTRIES, JSON.stringify(entries));
  // Sincroniza nuvem
  syncKeyToSupabase(KEYS.WORK_ENTRIES, entries);
};

export const deleteWorkEntry = (id: string) => {
  const entries = getWorkEntries();
  const newEntries = entries.filter(e => e.id !== id);
  
  localStorage.setItem(KEYS.WORK_ENTRIES, JSON.stringify(newEntries));
  syncKeyToSupabase(KEYS.WORK_ENTRIES, newEntries);
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
  syncKeyToSupabase(KEYS.ADVANCES, advances);
};

export const deleteAdvance = (id: string) => {
  const advances = getAdvances().filter(a => a.id !== id);
  
  localStorage.setItem(KEYS.ADVANCES, JSON.stringify(advances));
  syncKeyToSupabase(KEYS.ADVANCES, advances);
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
  syncKeyToSupabase(KEYS.EXPENSES, expenses);
};

export const deleteExpense = (id: string) => {
  const expenses = getExpenses();
  const newExpenses = expenses.filter(e => e.id !== id);
  
  localStorage.setItem(KEYS.EXPENSES, JSON.stringify(newExpenses));
  syncKeyToSupabase(KEYS.EXPENSES, newExpenses);
};

export const saveSettings = (settings: UserSettings) => {
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  syncKeyToSupabase(KEYS.SETTINGS, settings);
};

// --- Helpers para Notificação ---
export const setLastNotificationDate = (dateStr: string) => {
    localStorage.setItem(KEYS.LAST_NOTIF, dateStr);
}

export const getLastNotificationDate = (): string | null => {
    return localStorage.getItem(KEYS.LAST_NOTIF);
}

// --- FUNÇÕES DE BACKUP (Arquivo Físico) ---

export const exportAllData = (): string => {
  const backupData = {
    workEntries: getWorkEntries(),
    advances: getAdvances(),
    expenses: getExpenses(),
    settings: getSettings(),
    exportedAt: new Date().toISOString(),
    appVersion: '1.2'
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
    
    if (data.expenses) {
      localStorage.setItem(KEYS.EXPENSES, JSON.stringify(data.expenses));
    } else {
      localStorage.setItem(KEYS.EXPENSES, JSON.stringify([]));
    }
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings));

    // Sincroniza tudo importado para a nuvem
    syncKeyToSupabase(KEYS.WORK_ENTRIES, data.workEntries);
    syncKeyToSupabase(KEYS.ADVANCES, data.advances);
    if(data.expenses) syncKeyToSupabase(KEYS.EXPENSES, data.expenses);
    syncKeyToSupabase(KEYS.SETTINGS, data.settings);
    
    return true;
  } catch (e) {
    console.error("Erro ao importar:", e);
    return false;
  }
};

// --- DADOS DE TESTE ---

export const generateTestData = () => {
  localStorage.clear();
  const today = new Date();
  const entries: WorkEntry[] = [];
  const advances: AdvanceEntry[] = [];
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
  
  // Salva e Sincroniza Settings
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

  expenses.push({ id: 'demo_exp_1', date: format(subDays(today, 12), 'yyyy-MM-dd'), amount: 80, note: 'Ferramenta nova' });
  expenses.push({ id: 'demo_exp_2', date: format(subDays(today, 3), 'yyyy-MM-dd'), amount: 45.50, note: 'Material para reparo' });

  // Salva no LocalStorage
  localStorage.setItem(KEYS.WORK_ENTRIES, JSON.stringify(entries));
  localStorage.setItem(KEYS.ADVANCES, JSON.stringify(advances));
  localStorage.setItem(KEYS.EXPENSES, JSON.stringify(expenses));

  // Força Sincronização
  syncKeyToSupabase(KEYS.WORK_ENTRIES, entries);
  syncKeyToSupabase(KEYS.ADVANCES, advances);
  syncKeyToSupabase(KEYS.EXPENSES, expenses);
};