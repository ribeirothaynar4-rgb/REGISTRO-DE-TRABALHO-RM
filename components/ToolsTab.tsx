
import React, { useState, useEffect } from 'react';
import { Plus, Wrench, Trash2, Edit, X, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ToolEntry } from '../types';
import { getTools, saveTool, deleteTool } from '../services/storageService';
import { Card } from './ui/Card';

interface ToolsTabProps {
  onUpdate: () => void;
}

const ToolsTab: React.FC<ToolsTabProps> = ({ onUpdate }) => {
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const data = getTools().sort((a, b) => b.date.localeCompare(a.date));
    setTools(data);
  };

  const handleSave = () => {
    if (!name || !amount || !date) return;
    const newTool: ToolEntry = {
      id: editingId || Date.now().toString(),
      date,
      name,
      amount: parseFloat(amount),
      note
    };
    saveTool(newTool);
    setName('');
    setAmount('');
    setNote('');
    setShowForm(false);
    setEditingId(null);
    loadData();
    onUpdate();
  };

  const handleEdit = (item: ToolEntry) => {
    setEditingId(item.id);
    setName(item.name);
    setAmount(item.amount.toString());
    setDate(item.date);
    setNote(item.note || '');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Deseja realmente apagar esta ferramenta?")) {
        setTools(prev => prev.filter(item => item.id !== id));
        deleteTool(id);
        if (editingId === id) {
            setEditingId(null);
            setShowForm(false);
        }
        onUpdate();
    }
  };

  const totalTools = tools.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <header className="flex justify-between items-end">
        <div>
            <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white">Ferramentas</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Equipamentos comprados</p>
        </div>
        <button 
            onClick={() => setShowForm(!showForm)}
            className={`p-3 rounded-2xl shadow-lg transition-all transform active:scale-90 ${
                showForm ? 'bg-slate-200 text-slate-600' : 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-indigo-200'
            }`}
        >
            {showForm ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </header>

      {!showForm && (
          <div className="bg-gradient-to-r from-indigo-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-100 dark:shadow-none">
              <p className="text-indigo-100 font-bold text-sm uppercase tracking-wider">Total em Ferramentas</p>
              <p className="text-4xl font-extrabold mt-1">R$ {totalTools.toFixed(2)}</p>
              <p className="text-xs text-indigo-100 mt-2 opacity-80">* Este valor será somado ao seu salário final.</p>
          </div>
      )}

      {showForm && (
        <Card className="animate-in zoom-in duration-300 border-indigo-100 dark:border-indigo-900/30 shadow-xl">
            <div className="space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-indigo-500" />
                    {editingId ? 'Editar Ferramenta' : 'Nova Ferramenta'}
                </h3>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nome da Ferramenta</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-3 border-2 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white border-slate-200 dark:border-slate-800" placeholder="Ex: Furadeira, Martelo..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Valor (R$)</label>
                        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full p-3 border-2 rounded-xl bg-slate-50 dark:bg-slate-950 font-bold text-lg text-slate-800 dark:text-white border-slate-200 dark:border-slate-800" placeholder="0.00" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Data</label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-3 border-2 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white border-slate-200 dark:border-slate-800" />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Observação (Opcional)</label>
                    <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full p-3 border-2 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white border-slate-200 dark:border-slate-800" placeholder="Onde comprou, garantia..." />
                </div>
                <button onClick={handleSave} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all">
                    {editingId ? 'Salvar Alterações' : 'Adicionar Ferramenta'}
                </button>
            </div>
        </Card>
      )}

      <div className="space-y-3">
        {tools.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                <Wrench className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="font-medium">Nenhuma ferramenta registrada.</p>
            </div>
        ) : (
            tools.map((item) => (
            <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-4">
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-full text-indigo-600"><Wrench className="w-6 h-6" /></div>
                    <div>
                        <p className="font-bold text-slate-800 dark:text-white text-lg">{item.name}</p>
                        <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">R$ {item.amount.toFixed(2)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-500 font-medium">
                            {format(new Date(item.date + 'T00:00:00'), 'dd/MM')} {item.note && `• ${item.note}`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-6 pr-2"> 
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleEdit(item); }} 
                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                        title="Editar"
                    >
                        <Edit className="w-6 h-6" />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} 
                        className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Excluir"
                    >
                        <Trash2 className="w-6 h-6" />
                    </button>
                </div>
            </div>
            ))
        )}
      </div>
    </div>
  );
};

export default ToolsTab;
