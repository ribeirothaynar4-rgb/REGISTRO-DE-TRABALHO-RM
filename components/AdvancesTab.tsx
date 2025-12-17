
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
    const data = getAdvances().sort((a, b) => b.date.localeCompare(a.date));
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
    setAmount('');
    setNote('');
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
    if (window.confirm("Deseja realmente apagar este vale?")) {
        // Remove da tela instantaneamente
        setAdvances(prev => prev.filter(item => item.id !== id));
        // Apaga do armazenamento
        deleteAdvance(id);
        if (editingId === id) {
            setEditingId(null);
            setShowForm(false);
        }
        onUpdate();
    }
  };

  const totalAdvances = advances.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <header className="flex justify-between items-end">
        <div>
            <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white">Vales</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Controle de adiantamentos</p>
        </div>
        <button 
            onClick={() => setShowForm(!showForm)}
            className={`p-3 rounded-2xl shadow-lg transition-all transform active:scale-90 ${
                showForm ? 'bg-slate-200 text-slate-600' : 'bg-gradient-to-r from-rose-500 to-pink-600 text-white'
            }`}
        >
            {showForm ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </header>

      {!showForm && (
          <div className="bg-gradient-to-r from-rose-500 to-pink-600 rounded-2xl p-6 text-white shadow-lg">
              <p className="text-rose-100 font-bold text-sm uppercase tracking-wider">Total em Vales</p>
              <p className="text-4xl font-extrabold mt-1">R$ {totalAdvances.toFixed(2)}</p>
          </div>
      )}

      {showForm && (
        <Card className="animate-in zoom-in duration-300">
            <div className="space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-white">{editingId ? 'Editar Vale' : 'Novo Vale'}</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">VALOR</label>
                        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full p-3 border-2 rounded-xl bg-slate-50 dark:bg-slate-950 font-bold text-lg" placeholder="0.00" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">DATA</label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-3 border-2 rounded-xl bg-slate-50 dark:bg-slate-950" />
                    </div>
                </div>
                <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full p-3 border-2 rounded-xl bg-slate-50 dark:bg-slate-950" placeholder="Motivo (opcional)" />
                <button onClick={handleSave} className="w-full bg-rose-600 text-white py-4 rounded-xl font-bold">Salvar Vale</button>
            </div>
        </Card>
      )}

      <div className="space-y-3">
        {advances.map((item) => (
            <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                    <div className="bg-rose-50 dark:bg-rose-900/30 p-3 rounded-full text-rose-600"><DollarSign className="w-6 h-6" /></div>
                    <div>
                        <p className="font-bold text-lg">R$ {item.amount.toFixed(2)}</p>
                        <p className="text-xs text-slate-400">{format(new Date(item.date + 'T00:00:00'), 'dd/MM')} {item.note && `• ${item.note}`}</p>
                    </div>
                </div>
                <div className="flex items-center gap-5"> {/* GAP AUMENTADO PARA 5 */}
                    <button onClick={() => handleEdit(item)} className="p-3 text-slate-400 hover:text-blue-600"><Edit className="w-6 h-6" /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-3 text-slate-400 hover:text-rose-600"><Trash2 className="w-6 h-6" /></button>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default AdvancesTab;
