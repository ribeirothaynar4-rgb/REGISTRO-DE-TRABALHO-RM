
import React, { useState, useEffect } from 'react';
import { Plus, DollarSign, Trash2, Edit, X, ArrowDown } from 'lucide-react';
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
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    // Sort by date descending
    const data = getAdvances().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setAdvances(data);
  };

  const handleSave = () => {
    if (!amount || !date) return;
    
    const newAdvance: AdvanceEntry = {
      id: editingId || Date.now().toString(),
      date,
      amount: parseFloat(amount),
      note
    };

    saveAdvance(newAdvance);
    
    // Reset form
    setAmount('');
    setNote('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setShowForm(false);
    setEditingId(null);
    
    loadData();
    onUpdate();
  };

  const handleEdit = (item: AdvanceEntry) => {
    setEditingId(item.id);
    setAmount(item.amount.toString());
    setDate(item.date);
    setNote(item.note || '');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    if (confirm("Deseja realmente apagar este adiantamento?")) {
        deleteAdvance(id);
        if (editingId === id) {
            setEditingId(null);
            setShowForm(false);
        }
        loadData();
        onUpdate();
    }
  };

  const toggleForm = () => {
    if (showForm) {
        setShowForm(false);
        setEditingId(null);
        setAmount('');
        setNote('');
    } else {
        setShowForm(true);
        setEditingId(null);
        setAmount('');
        setNote('');
        setDate(format(new Date(), 'yyyy-MM-dd'));
    }
  };

  const totalAdvances = advances.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-end">
        <div>
            <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white">Adiantamentos</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Gerencie seus vales</p>
        </div>
        <button 
            onClick={toggleForm}
            className={`p-3 rounded-2xl shadow-lg transition-all transform active:scale-90 ${
                showForm 
                ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300' 
                : 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-rose-200'
            }`}
        >
            {showForm ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </header>

      {/* Total Card */}
      {!showForm && (
          <div className="bg-gradient-to-r from-rose-500 to-pink-600 rounded-2xl p-6 text-white shadow-lg shadow-rose-200 dark:shadow-none">
              <p className="text-rose-100 font-bold text-sm uppercase tracking-wider">Total de Vales (Mês Atual)</p>
              <p className="text-4xl font-extrabold mt-1">R$ {totalAdvances.toFixed(2)}</p>
              <p className="text-rose-100 text-xs mt-2 opacity-80">Este valor será descontado do seu pagamento.</p>
          </div>
      )}

      {showForm && (
        <div className="animate-in fade-in zoom-in duration-300">
            <Card className="bg-white dark:bg-slate-900 border-2 border-rose-100 dark:border-rose-900/30 shadow-xl">
            <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-rose-50 dark:border-slate-800 pb-2">
                    <div className="bg-rose-100 p-1.5 rounded-full"><ArrowDown className="w-4 h-4 text-rose-600" /></div>
                    <h3 className="font-bold text-slate-800 dark:text-white">
                        {editingId ? 'Editar Vale' : 'Novo Vale / Adiantamento'}
                    </h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Valor (R$)</label>
                    <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-rose-500 focus:border-rose-500 bg-slate-50 dark:bg-slate-950 dark:text-white text-lg font-bold"
                    placeholder="0.00"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Data</label>
                    <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-rose-500 focus:border-rose-500 bg-slate-50 dark:bg-slate-950 dark:text-white"
                    />
                </div>
                </div>

                <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Motivo (Opcional)</label>
                <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full p-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 dark:text-white"
                    placeholder="Ex: Gasolina, Almoço..."
                    />
                </div>

                <div className="flex space-x-3 pt-2">
                    {editingId && (
                        <button
                            onClick={() => {
                                setShowForm(false);
                                setEditingId(null);
                                setAmount('');
                                setNote('');
                            }}
                            className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                    onClick={handleSave}
                    className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all transform active:scale-95"
                    >
                    {editingId ? 'Salvar Alterações' : 'Confirmar Vale'}
                    </button>
                </div>
            </div>
            </Card>
        </div>
      )}

      <div className="space-y-3">
        {advances.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="font-medium">Nenhum vale registrado.</p>
            </div>
        ) : (
            advances.map((item) => (
            <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex justify-between items-center transition-all hover:shadow-md">
                <div className="flex items-center space-x-4">
                    <div className="bg-rose-50 dark:bg-rose-900/30 p-3 rounded-full text-rose-600 dark:text-rose-400">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-800 dark:text-white text-lg">R$ {item.amount.toFixed(2)}</p>
                        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                            {format(new Date(item.date + 'T00:00:00'), 'dd/MM')} {item.note && `• ${item.note}`}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => handleEdit(item)}
                        className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-xl transition-colors"
                        title="Editar"
                    >
                        <Edit className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-colors"
                        title="Excluir"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </div>
            ))
        )}
      </div>
    </div>
  );
};

export default AdvancesTab;
