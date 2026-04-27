import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import { 
  Target, StickyNote, Plus, Trash2, 
  CheckCircle2, Circle, RotateCcw
} from 'lucide-react';

export default function Productivity({ user }) {
  // ================= ESTADOS: TAREFAS =================
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('Média');
  const [loadingTasks, setLoadingTasks] = useState(true);

  // ================= ESTADOS: BLOCO DE NOTAS =================
  const [note, setNote] = useState(localStorage.getItem(`notes_${user.id}`) || '');

  // ================= EFEITOS =================
  useEffect(() => {
    fetchTasks();
  }, [user.id]);

  // Salvar nota automaticamente
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem(`notes_${user.id}`, note);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [note, user.id]);

  // ================= FUNÇÕES: TAREFAS =================
  const fetchTasks = async () => {
    try {
      const res = await api.get(`/personal-tasks/${user.id}`);
      setTasks(res.data);
    } catch (err) {
      console.error("Erro ao buscar tarefas pessoais", err);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const res = await api.post('/personal-tasks/', {
        user_id: user.id,
        title: newTaskTitle,
        priority: newTaskPriority
      });
      setTasks([res.data, ...tasks]);
      setNewTaskTitle('');
      setNewTaskPriority('Média');
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTaskStatus = async (task) => {
    const newStatus = task.status === 'pending' ? 'completed' : 'pending';
    // Atualiza otimisticamente a UI
    setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    
    try {
      await api.put(`/personal-tasks/${task.id}`, { status: newStatus });
    } catch (err) {
      // Reverte em caso de erro
      setTasks(tasks.map(t => t.id === task.id ? { ...t, status: task.status } : t));
    }
  };

  const deleteTask = async (taskId) => {
    setTasks(tasks.filter(t => t.id !== taskId));
    try {
      await api.delete(`/personal-tasks/${taskId}`);
    } catch (err) {
      fetchTasks(); // Recarrega se der erro
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Alta': return 'text-red-600 bg-red-50 border-red-200';
      case 'Média': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'Baixa': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* HEADER DA PÁGINA */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-4">
          <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
            <Target size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Meu Espaço de Foco</h1>
            <p className="text-blue-100 mt-1 font-medium text-sm">Organize o seu dia, mantenha o foco e anote ideias rápidas.</p>
          </div>
        </div>
        {/* Decoração de Fundo */}
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 opacity-10">
          <Target size={200} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA 1: GESTOR DE TAREFAS PESSOAIS (Ocupa 2 colunas) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col h-[600px]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle2 size={20} className="text-blue-600" />
              Tarefas do Dia
            </h2>
            <span className="text-xs font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase tracking-wider">
              {tasks.filter(t => t.status === 'completed').length} / {tasks.length} Concluídas
            </span>
          </div>

          {/* Form de Criação */}
          <form onSubmit={handleAddTask} className="flex gap-2 mb-6">
            <input 
              type="text" 
              placeholder="O que você precisa fazer hoje?" 
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none transition-all"
            />
            <select 
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 outline-none cursor-pointer"
            >
              <option value="Baixa">🟢 Baixa</option>
              <option value="Média">🟡 Média</option>
              <option value="Alta">🔴 Alta</option>
            </select>
            <button 
              type="submit"
              disabled={!newTaskTitle.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl font-bold transition-colors flex items-center gap-2"
            >
              <Plus size={18} /> Adicionar
            </button>
          </form>

          {/* Lista de Tarefas */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
            {loadingTasks ? (
              <div className="flex justify-center items-center h-full text-slate-400">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><RotateCcw /></motion.div>
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-full text-slate-400 opacity-70">
                <Target size={48} className="mb-4 text-slate-300" />
                <p className="font-medium text-sm">A sua lista está limpa!</p>
                <p className="text-xs">Adicione uma tarefa acima para começar.</p>
              </div>
            ) : (
              <AnimatePresence>
                {tasks.map((task) => (
                  <motion.div 
                    key={task.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={`group flex items-center justify-between p-4 rounded-xl border transition-all ${
                      task.status === 'completed' 
                        ? 'bg-slate-50 border-slate-100 opacity-60' 
                        : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => toggleTaskStatus(task)}>
                      <button className={`transition-colors ${task.status === 'completed' ? 'text-emerald-500' : 'text-slate-300 group-hover:text-blue-500'}`}>
                        {task.status === 'completed' ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                      </button>
                      <span className={`flex-1 text-sm font-medium transition-all ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                        {task.title}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      <button onClick={() => deleteTask(task.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1" title="Excluir">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* COLUNA 2: NOTAS (Agora ocupa toda a altura lateral) */}
        <div className="flex flex-col gap-6 h-[600px]">
          {/* BLOCO DE NOTAS RÁPIDO */}
          <div className="flex-1 bg-amber-50/50 rounded-3xl border border-amber-200 shadow-sm p-6 flex flex-col relative overflow-hidden group">
            <div className="flex items-center justify-between mb-3 relative z-10">
              <h2 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                <StickyNote size={18} />
                Rascunho Rápido
              </h2>
              <span className="text-[10px] font-bold text-amber-600/50 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                Salvo Auto
              </span>
            </div>
            
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Cole links, anote ideias, faça rascunhos aqui... Fica salvo no seu navegador."
              className="flex-1 w-full bg-transparent resize-none outline-none text-sm text-amber-900 placeholder-amber-700/40 custom-scrollbar relative z-10 leading-relaxed"
            />
            
            {/* Linhas de caderno decorativas */}
            <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, #d97706 28px)', backgroundPositionY: '52px' }}></div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        /* Custom Scrollbar for Tasks and Notes */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 20px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: #94a3b8;
        }
      `}</style>
    </motion.div>
  );
}