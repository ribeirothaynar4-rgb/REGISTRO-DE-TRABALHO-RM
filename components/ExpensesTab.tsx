
import React, { useState, useEffect } from 'react';
import { Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ExpenseEntry } from '../types';
import { getExpenses, saveExpense, deleteExpense } from '../services/storageService';
import { Card } from './ui/Card';

interface ExpensesTabProps {
  onUpdate: () => void;
}

const ExpensesTab: React.FC<ExpensesTabProps> = ({ onUpdate }) => {
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const data = getExpenses().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setExpenses(data);
  };

  const handleAdd = () => {
    if (!amount || !date) return;
    
    const newExpense: ExpenseEntry = {
      id: Date.now().toString(),
      date,
      amount: parseFloat(amount),
      note
    };

    saveExpense(newExpense);
    setAmount('');
    setNote('');
    setShowForm(false);
    loadData();
    onUpdate();
  };

  const handleDelete = (id: string) => {
    if (confirm("Deseja realmente apagar esta despesa?")) {
        deleteExpense(id);
        loadData();
        onUpdate();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Despesas</h1>
            <p className="text-slate-500 dark:text-slate-400">Gastos com materiais, ferramentas, etc.</p>
        </div>
        <button 
            onClick={() => setShowForm(!showForm)}
            className="bg-orange-600 text-white p-2 rounded-full shadow-lg hover:bg-orange-700 transition-colors"
        >
            <Plus className="w-6 h-6" />
        </button>
      </header>

      {showForm && (
        <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
          <div className="space-y-4">
            <h3 className="font-bold text-orange-800 dark:text-orange-300">Nova Despesa</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-orange-800 dark:text-orange-300 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-2 border border-orange-300 dark:border-orange-700 rounded-lg focus:ring-orange-500 bg-white dark:bg-slate-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-orange-800 dark:text-orange-300 mb-1">Data</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2 border border-orange-300 dark:border-orange-700 rounded-lg focus:ring-orange-500 bg-white dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
               <label className="block text-xs font-medium text-orange-800 dark:text-orange-300 mb-1">Descrição</label>
               <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full p-2 border border-orange-300 dark:border-orange-700 rounded-lg bg-white dark:bg-slate-900 dark:text-white"
                  placeholder="Ex: Compra de ferramenta"
                />
            </div>

            <button
              onClick={handleAdd}
              className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold shadow hover:bg-orange-700 transition-colors"
            >
              Confirmar Despesa
            </button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {expenses.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>Nenhuma despesa registrada.</p>
            </div>
        ) : (
            expenses.map((item) => (
            <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                    <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-full text-orange-600 dark:text-orange-400">
                        <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-800 dark:text-white">R$ {item.amount.toFixed(2)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {format(new Date(item.date + 'T00:00:00'), 'dd/MM/yyyy')} {item.note && `• ${item.note}`}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                    title="Excluir"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>
            ))
        )}
      </div>
    </div>
  );
};

export default ExpensesTab;
