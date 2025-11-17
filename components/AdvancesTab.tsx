
import React, { useState, useEffect } from 'react';
import { Plus, DollarSign, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { AdvanceEntry } from '../types';
import { getAdvances, saveAdvance, deleteAdvance } from '../services/storageService';
import { Card } from './ui/Card';

interface AdvancesTabProps {
  onUpdate: () => void;
}

const AdvancesTab: React.FC<AdvancesTabProps> = ({ onUpdate }) => {
  const [advances, setAdvances] = useState<AdvanceEntry[]>([]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    // Sort by date descending
    const data = getAdvances().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setAdvances(data);
  };

  const handleAdd = () => {
    if (!amount || !date) return;
    
    const newAdvance: AdvanceEntry = {
      id: Date.now().toString(),
      date,
      amount: parseFloat(amount),
      note
    };

    saveAdvance(newAdvance);
    setAmount('');
    setNote('');
    setShowForm(false);
    loadData();
    onUpdate();
  };

  const handleDelete = (id: string) => {
    if (confirm("Deseja realmente apagar este adiantamento?")) {
        deleteAdvance(id);
        loadData();
        onUpdate();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Adiantamentos</h1>
            <p className="text-slate-500 dark:text-slate-400">Vale e dinheiro pego antes</p>
        </div>
        <button 
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
            <Plus className="w-6 h-6" />
        </button>
      </header>

      {showForm && (
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="space-y-4">
            <h3 className="font-bold text-blue-800 dark:text-blue-300">Novo Adiantamento</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-2 border border-blue-300 dark:border-blue-700 rounded-lg focus:ring-blue-500 bg-white dark:bg-slate-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">Data</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2 border border-blue-300 dark:border-blue-700 rounded-lg focus:ring-blue-500 bg-white dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
               <label className="block text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">Descrição</label>
               <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full p-2 border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-slate-900 dark:text-white"
                  placeholder="Ex: Vale para gasolina"
                />
            </div>

            <button
              onClick={handleAdd}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold shadow hover:bg-blue-700 transition-colors"
            >
              Confirmar Adiantamento
            </button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {advances.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>Nenhum adiantamento registrado.</p>
            </div>
        ) : (
            advances.map((item) => (
            <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                    <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full text-red-600 dark:text-red-400">
                        <DollarSign className="w-5 h-5" />
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

export default AdvancesTab;
