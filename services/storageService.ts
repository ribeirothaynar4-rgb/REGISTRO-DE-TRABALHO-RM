

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

// --- FUNÇÕES AUXILIARES ---

export const clearLocalData = () => {
  localStorage.removeItem(KEYS.WORK_ENTRIES);
  localStorage.removeItem(KEYS.ADVANCES);
  localStorage.removeItem(KEYS.EXPENSES);
  localStorage.removeItem(KEYS.SETTINGS);
  // Não limpamos LAST_NOTIF necessariamente, mas podemos se quiser resetar o aviso
};

// --- FUNÇÕES DE SINCRONIZAÇÃO COM SUPABASE (TABELA historico_ia) ---

// Envia dados para o Supabase (Background Sync) - Retorna TRUE se salvou ok
const syncKeyToSupabase = async (key: string, data: any): Promise<boolean> => {
  // 1. Pega o usuário logado ATUAL
  const { data: { session } } = await supabase.auth.getSession();
  
  // Se não tem usuário, não salva na nuvem (apenas local)
  if (!session?.user) return false; 

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

    if (error) {
        console.error(`Erro ao sincronizar ${key}:`, error);
        return false;
    }
    return true;
  } catch (err) {
    console.error("Erro de conexão ao salvar no banco:", err);
    return false;
  }
};

// Baixa todos os dados do Supabase ao iniciar (Load)
export const fetchAllFromSupabase = async (): Promise<boolean> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return false;

  try {
    // CORREÇÃO CRÍTICA:
    // Não limpamos os dados locais ANTES de baixar.
    // Primeiro baixamos. Se der erro (sem internet), mantemos os dados locais do usuário.
    
    const { data, error } = await supabase
      .from('historico_ia')
      .select('category, data')
      .eq('user_id', session.user.id);

    if (error) throw error;

    if (data && data.length > 0) {
      // SUCESSO: O servidor respondeu com dados.
      // Agora é seguro atualizar o LocalStorage.
      data.forEach(row => {
        // Verifica se o dado é válido antes de salvar
        if (row.data) {
             localStorage.setItem(row.category, JSON.stringify(row.data));
        }
      });
      return true;
    }
    
    // Se chegou aqui, conectou mas não tem dados no servidor (usuário novo).
    // Mantemos o que está local ou o app inicia zerado naturalmente.
    return true; 
  } catch (err) {
    console.error("Erro ao baixar dados do Supabase (Usando cache local):", err);
    // Retornamos false, mas NÃO limpamos os dados. 
    // O usuário verá os dados que já estavam no celular (Offline Mode).
    return false;
  }
};

// --- GETTERS (Leitura Local - Rápida) ---
// Adicionado try-catch para proteger contra dados corrompidos

export const getWorkEntries = (): WorkEntry[] => {
  try {
    const data = localStorage.getItem(KEYS.WORK_ENTRIES);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Erro ao ler registros:", e);
    return [];
  }
};

export const getAdvances = (): AdvanceEntry[] => {
  try {
    const data = localStorage.getItem(KEYS.ADVANCES);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Erro ao ler vales:", e);
    return [];
  }
};

export const getExpenses = (): ExpenseEntry[] => {
  try {
    const data = localStorage.getItem(KEYS.EXPENSES);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Erro ao ler despesas:", e);
    return [];
  }
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
    billingCycleStartDate: format(startOfMonth(new Date()), 'yyyy-MM-dd') // Padrão: dia 1 do mês atual
  };

  try {
    const data = localStorage.getItem(KEYS.SETTINGS);
    if (data) {
        const parsed = JSON.parse(data);
        return { ...defaultSettings, ...parsed };
    }
  } catch (e) {
    console.error("Erro ao ler configurações:", e);
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
  const allAdvances = getAdvances();
  const newAdvances = allAdvances.filter(a => a.id !== id);
  
  localStorage.setItem(KEYS.ADVANCES, JSON.stringify(newAdvances));
  syncKeyToSupabase(KEYS.ADVANCES, newAdvances);
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

// Agora é ASYNC para garantir que sobe pro banco antes de dar refresh
export const importAllData = async (jsonString: string): Promise<boolean> => {
  try {
    const data = JSON.parse(jsonString);
    
    if (!data.workEntries || !data.advances || !data.settings) {
      throw new Error("Arquivo de backup inválido.");
    }

    // 1. Salva Localmente
    localStorage.setItem(KEYS.WORK_ENTRIES, JSON.stringify(data.workEntries));
    localStorage.setItem(KEYS.ADVANCES, JSON.stringify(data.advances));
    
    if (data.expenses) {
      localStorage.setItem(KEYS.EXPENSES, JSON.stringify(data.expenses));
    } else {
      localStorage.setItem(KEYS.EXPENSES, JSON.stringify([]));
    }
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings));

    // 2. Aguarda Sincronização com a Nuvem (CRÍTICO)
    const promises = [
        syncKeyToSupabase(KEYS.WORK_ENTRIES, data.workEntries),
        syncKeyToSupabase(KEYS.ADVANCES, data.advances),
        syncKeyToSupabase(KEYS.SETTINGS, data.settings)
    ];

    if(data.expenses) {
        promises.push(syncKeyToSupabase(KEYS.EXPENSES, data.expenses));
    }

    await Promise.all(promises);
    // Mesmo que o sync falhe (retorne false), o dado está local, então retornamos sucesso.
    
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
    notificationTime: '18:00',
    billingCycleStartDate: format(startOfMonth(today), 'yyyy-MM-dd')
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