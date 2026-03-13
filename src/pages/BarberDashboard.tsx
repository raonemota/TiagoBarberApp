import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Calendar, Clock, UserPlus, DollarSign, Activity, CheckCircle2, Settings, Save, Plus, Trash2, Ban, X, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Appointment {
  id: string;
  date: string;
  start_time: string;
  end_time?: string;
  status: string;
  notes?: string;
  client: { name: string; phone: string };
  service: { name: string; price: number };
}

interface Availability {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface BarberBlock {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string;
}

const DAYS = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'
];

// Função auxiliar para máscara de telefone (reutilizada do Admin)
const maskPhone = (value: string) => {
  return value
    .replace(/\D/g, "")
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .replace(/(-\d{4})(\d+?)$/, "$1");
};

export default function BarberDashboard() {
  const { profile } = useAuth();
  const { showNotification } = useNotification();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [blocks, setBlocks] = useState<BarberBlock[]>([]);
  const [stats, setStats] = useState({ totalServices: 0, totalValue: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [activeTab, setActiveTab] = useState<'agenda' | 'horarios' | 'bloqueios'>('agenda');
  const [barberId, setBarberId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Estados para o Novo Cliente
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientPassword, setNewClientPassword] = useState('');

  // New Block Form State
  const [newBlock, setNewBlock] = useState({
    date: '',
    start_time: '',
    end_time: '',
    reason: '',
    isFullDay: true
  });

  useEffect(() => {
    if (profile) fetchBarberData();
  }, [profile, view]);

  const fetchBarberData = async () => {
    try {
      const { data: barberData } = await supabase
        .from('barbers')
        .select('id')
        .eq('user_id', profile?.id)
        .single();

      if (!barberData) return;
      setBarberId(barberData.id);

      const today = new Date().toISOString().split('T')[0];

      const { data: apts } = await supabase
        .from('appointments')
        .select(`
          id, date, start_time, end_time, status, notes,
          client:users!client_id(name, phone),
          service:services(name, price)
        `)
        .eq('barber_id', barberData.id)
        .gte('date', today)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (apts) {
        setAppointments(apts as any);
        const todayApts = apts.filter(a => a.date === today);
        const totalVal = todayApts.reduce((acc, curr: any) => acc + (curr.service.price || 0), 0);
        setStats({ totalServices: todayApts.length, totalValue: totalVal });
      }

      const { data: availData } = await supabase
        .from('barber_availability')
        .select('*')
        .eq('barber_id', barberData.id)
        .order('day_of_week', { ascending: true });

      if (availData && availData.length > 0) {
        setAvailability(availData);
      } else {
        const defaults = [0, 1, 2, 3, 4, 5, 6].map(day => ({
          day_of_week: day,
          start_time: '09:00',
          end_time: '18:00',
          is_active: day !== 0
        }));
        setAvailability(defaults);
      }

      const { data: blocksData } = await supabase
        .from('barber_blocks')
        .select('*')
        .eq('barber_id', barberData.id)
        .gte('date', today)
        .order('date', { ascending: true });

      if (blocksData) setBlocks(blocksData);
    } catch (error) {
      console.error('Error fetching barber data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClientName,
          email: newClientEmail,
          phone: newClientPhone,
          password: newClientPassword,
          role: 'client',
          subscription_type: 'comum'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao criar cliente.');
      }

      setIsClientModalOpen(false);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientPassword('');
      showNotification('Cliente cadastrado com sucesso!');
    } catch (error: any) {
      showNotification(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAvailability = async () => {
    if (!barberId) return;
    setSaving(true);
    try {
      for (const item of availability) {
        const { id, ...rest } = item;
        const payload = {
          ...rest,
          barber_id: barberId,
          start_time: item.start_time.length === 5 ? `${item.start_time}:00` : item.start_time,
          end_time: item.end_time.length === 5 ? `${item.end_time}:00` : item.end_time,
        };

        if (id) {
          await supabase.from('barber_availability').update(payload).eq('id', id);
        } else {
          await supabase.from('barber_availability').insert([payload]);
        }
      }
      showNotification('Horários salvos com sucesso!');
      fetchBarberData();
    } catch (error: any) {
      showNotification('Erro ao salvar: ' + (error.message || 'Erro desconhecido'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBlock = async () => {
    if (!barberId || !newBlock.date) {
      showNotification('Selecione ao menos uma data.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        barber_id: barberId,
        date: newBlock.date,
        start_time: newBlock.isFullDay ? null : (newBlock.start_time || null),
        end_time: newBlock.isFullDay ? null : (newBlock.end_time || null),
        reason: newBlock.reason
      };
      await supabase.from('barber_blocks').insert([payload]);
      showNotification('Bloqueio adicionado com sucesso!');
      setNewBlock({ date: '', start_time: '', end_time: '', reason: '', isFullDay: true });
      fetchBarberData();
    } catch (error: any) {
      showNotification('Erro ao bloquear: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBlock = async (id: string) => {
    try {
      await supabase.from('barber_blocks').delete().eq('id', id);
      showNotification('Bloqueio removido.');
      fetchBarberData();
    } catch (error: any) {
      showNotification('Erro ao remover bloqueio.', 'error');
    }
  };

  const updateAvailability = (day: number, field: keyof Availability, value: any) => {
    setAvailability(prev => {
      const exists = prev.some(item => item.day_of_week === day);
      if (exists) {
        return prev.map(item => item.day_of_week === day ? { ...item, [field]: value } : item);
      } else {
        return [...prev, {
          day_of_week: day,
          start_time: '09:00',
          end_time: '18:00',
          is_active: false,
          [field]: value
        }].sort((a, b) => a.day_of_week - b.day_of_week);
      }
    });
  };

  const handleComplete = async (id: string) => {
    await supabase.from('appointments').update({ status: 'completed' }).eq('id', id);
    fetchBarberData();
  };

  if (loading) return <div className="p-8 text-center text-zinc-500">Carregando painel...</div>;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white tracking-tighter">Painel do Profissional</h1>
        <button 
          onClick={() => setIsClientModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-[#8162ff] px-4 py-2 text-sm font-bold text-white hover:bg-[#6e4ff0] transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Novo Cliente
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl bg-[#1a1a1a] p-6 shadow-sm ring-1 ring-[#262626]">
          <div className="flex items-center gap-3 text-zinc-500 mb-2">
            <Activity className="h-5 w-5 text-[#8162ff]" />
            <span className="text-xs font-bold uppercase tracking-widest">Serviços Hoje</span>
          </div>
          <p className="text-3xl font-bold text-white">{stats.totalServices}</p>
        </div>
        <div className="rounded-2xl bg-[#1a1a1a] p-6 shadow-sm ring-1 ring-[#262626]">
          <div className="flex items-center gap-3 text-zinc-500 mb-2">
            <DollarSign className="h-5 w-5 text-[#8162ff]" />
            <span className="text-xs font-bold uppercase tracking-widest">A Receber</span>
          </div>
          <p className="text-3xl font-bold text-white">R$ {stats.totalValue}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#262626] gap-8">
        <button 
          onClick={() => setActiveTab('agenda')}
          className={`pb-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'agenda' ? 'border-[#8162ff] text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
        >
          Agenda
        </button>
        <button 
          onClick={() => setActiveTab('horarios')}
          className={`pb-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'horarios' ? 'border-[#8162ff] text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
        >
          Horários de Trabalho
        </button>
        <button 
          onClick={() => setActiveTab('bloqueios')}
          className={`pb-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'bloqueios' ? 'border-[#8162ff] text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
        >
          Bloqueios
        </button>
      </div>

      {activeTab === 'agenda' ? (
        <div className="rounded-2xl bg-[#1a1a1a] shadow-sm ring-1 ring-[#262626] overflow-hidden">
          <div className="border-b border-[#262626] p-4 sm:px-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between bg-[#1a1a1a]">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#8162ff]" /> Sua Agenda
            </h2>
            <div className="flex bg-[#262626] p-1 rounded-xl w-fit">
              {['day', 'week', 'month'].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v as any)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg capitalize transition-all ${view === v ? 'bg-[#8162ff] text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-[#262626]">
            {appointments.length === 0 ? (
              <div className="p-12 text-center text-zinc-500">Nenhum agendamento encontrado.</div>
            ) : (
              appointments.map((apt) => (
                <div key={apt.id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#262626]/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-[#262626] text-white ring-1 ring-[#333] shrink-0">
                      <span className="text-[10px] font-bold uppercase opacity-60">{format(parseISO(apt.date), 'MMM', { locale: ptBR })}</span>
                      <span className="text-xl font-bold">{format(parseISO(apt.date), 'dd')}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{apt.client?.name || 'Cliente'}</h3>
                      <p className="text-sm text-zinc-500 mt-1">
                        {apt.notes?.startsWith('Serviços:') ? apt.notes.split('|')[0].replace('Serviços:', '').trim() : apt.service?.name} 
                        • <span className="text-[#8162ff] font-bold">R$ {apt.service?.price || 0}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-[#8162ff] bg-[#221c3d] w-fit px-2 py-1 rounded-lg uppercase tracking-wider">
                        <Clock className="h-3 w-3" /> {apt.start_time.substring(0, 5)}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                    <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full ${apt.status === 'completed' ? 'bg-green-500/10 text-green-500' : 'bg-[#8162ff]/10 text-[#8162ff]'}`}>
                      {apt.status === 'completed' ? 'Concluído' : 'Agendado'}
                    </span>
                    {apt.status !== 'completed' && (
                      <button onClick={() => handleComplete(apt.id)} className="text-xs font-bold text-zinc-400 hover:text-white flex items-center gap-1 transition-colors">
                        <CheckCircle2 className="h-4 w-4" /> Finalizar
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : activeTab === 'horarios' ? (
        <div className="space-y-6">
          <div className="rounded-2xl bg-[#1a1a1a] p-4 sm:p-6 shadow-sm ring-1 ring-[#262626]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Horários de Atendimento</h2>
              </div>
              <button onClick={handleSaveAvailability} disabled={saving} className="flex items-center justify-center gap-2 bg-[#8162ff] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#6e4ff0] transition-all disabled:opacity-50">
                {saving ? 'Salvando...' : <><Save className="h-4 w-4" /> Salvar Alterações</>}
              </button>
            </div>
            <div className="space-y-3">
              {DAYS.map((dayName, index) => {
                const dayAvail = availability.find(a => a.day_of_week === index) || { day_of_week: index, start_time: '09:00', end_time: '18:00', is_active: false };
                return (
                  <div key={index} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border transition-all gap-4 ${dayAvail.is_active ? 'bg-[#262626]/30 border-[#8162ff]/20' : 'bg-[#1a1a1a] border-[#262626] opacity-60'}`}>
                    <div className="flex items-center gap-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={dayAvail.is_active} onChange={(e) => updateAvailability(index, 'is_active', e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-[#262626] rounded-full peer peer-checked:bg-[#8162ff] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                      </label>
                      <span className={`font-bold text-sm ${dayAvail.is_active ? 'text-white' : 'text-zinc-500'}`}>{dayName}</span>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-6">
                      <input type="time" value={dayAvail.start_time?.substring(0, 5)} disabled={!dayAvail.is_active} onChange={(e) => updateAvailability(index, 'start_time', e.target.value)} className="bg-[#262626] rounded-xl text-white text-sm font-bold px-3 py-2 disabled:opacity-30" />
                      <span className="text-[10px] text-zinc-500 uppercase font-black">Até</span>
                      <input type="time" value={dayAvail.end_time?.substring(0, 5)} disabled={!dayAvail.is_active} onChange={(e) => updateAvailability(index, 'end_time', e.target.value)} className="bg-[#262626] rounded-xl text-white text-sm font-bold px-3 py-2 disabled:opacity-30" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl bg-[#1a1a1a] p-6 ring-1 ring-[#262626]">
              <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Ban className="h-5 w-5 text-red-500" /> Novo Bloqueio</h2>
              <div className="space-y-4">
                <input type="date" value={newBlock.date} onChange={(e) => setNewBlock({...newBlock, date: e.target.value})} className="w-full bg-[#262626] rounded-xl text-white p-3" />
                <div className="flex items-center gap-3 p-3 bg-[#262626]/50 rounded-xl">
                  <input type="checkbox" id="fullDay" checked={newBlock.isFullDay} onChange={(e) => setNewBlock({...newBlock, isFullDay: e.target.checked})} />
                  <label htmlFor="fullDay" className="text-sm font-bold text-white">Bloquear dia inteiro</label>
                </div>
                {!newBlock.isFullDay && (
                  <div className="grid grid-cols-2 gap-4">
                    <input type="time" value={newBlock.start_time} onChange={(e) => setNewBlock({...newBlock, start_time: e.target.value})} className="w-full bg-[#262626] rounded-xl text-white p-3" />
                    <input type="time" value={newBlock.end_time} onChange={(e) => setNewBlock({...newBlock, end_time: e.target.value})} className="w-full bg-[#262626] rounded-xl text-white p-3" />
                  </div>
                )}
                <textarea value={newBlock.reason} onChange={(e) => setNewBlock({...newBlock, reason: e.target.value})} placeholder="Motivo..." className="w-full bg-[#262626] rounded-xl text-white p-3 h-24 resize-none" />
                <button onClick={handleSaveBlock} disabled={saving} className="w-full bg-red-500 text-white py-4 rounded-xl font-bold hover:bg-red-600">Confirmar Bloqueio</button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl bg-[#1a1a1a] ring-1 ring-[#262626] overflow-hidden">
              <div className="p-6 border-b border-[#262626]"><h2 className="text-lg font-bold text-white">Bloqueios Ativos</h2></div>
              <div className="divide-y divide-[#262626]">
                {blocks.length === 0 ? <div className="p-12 text-center text-zinc-500">Nenhum bloqueio.</div> : blocks.map((block) => (
                  <div key={block.id} className="p-6 flex items-center justify-between hover:bg-[#262626]/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center"><Ban className="h-6 w-6 text-red-500" /></div>
                      <div><h3 className="font-bold text-white">{format(parseISO(block.date), "dd 'de' MMMM", { locale: ptBR })}</h3><p className="text-sm text-zinc-500">{block.start_time ? `${block.start_time.substring(0, 5)} às ${block.end_time?.substring(0, 5)}` : 'Dia Inteiro'}</p></div>
                    </div>
                    <button onClick={() => handleDeleteBlock(block.id)} className="p-2 text-zinc-500 hover:text-red-500"><Trash2 className="h-5 w-5" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Cliente (ADICIONADO) */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-md p-8 shadow-2xl ring-1 ring-[#262626]">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#8162ff] text-white rounded-xl"><UserPlus className="h-6 w-6" /></div>
                <h3 className="text-2xl font-bold text-white tracking-tighter">Novo Cliente</h3>
              </div>
              <button onClick={() => setIsClientModalOpen(false)} className="p-2 text-zinc-500 hover:text-white transition-colors"><X className="h-6 w-6" /></button>
            </div>
            
            <form onSubmit={handleCreateClient} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Nome Completo</label>
                <input required type="text" placeholder="Ex: João Silva" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white focus:ring-2 focus:ring-[#8162ff]" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Email</label>
                <input required type="email" placeholder="joao@email.com" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white focus:ring-2 focus:ring-[#8162ff]" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Telefone</label>
                <input required type="text" placeholder="(11) 99999-9999" value={newClientPhone} onChange={(e) => setNewClientPhone(maskPhone(e.target.value))} className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white focus:ring-2 focus:ring-[#8162ff]" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Senha Temporária</label>
                <input required type="password" placeholder="••••••••" value={newClientPassword} onChange={(e) => setNewClientPassword(e.target.value)} className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white focus:ring-2 focus:ring-[#8162ff]" />
              </div>
              <button type="submit" disabled={saving} className="w-full py-4 bg-[#8162ff] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#6e4ff0] disabled:opacity-50 shadow-lg shadow-[#8162ff]/20">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                Cadastrar Cliente
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}