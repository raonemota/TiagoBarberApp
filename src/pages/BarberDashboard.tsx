import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Calendar, Clock, UserPlus, DollarSign, Activity, CheckCircle2, Settings, Save, Plus, Trash2, Ban } from 'lucide-react';
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
      // First get the barber id
      const { data: barberData } = await supabase
        .from('barbers')
        .select('id')
        .eq('user_id', profile?.id)
        .single();

      if (!barberData) return;
      setBarberId(barberData.id);

      const today = new Date().toISOString().split('T')[0];

      // Fetch appointments
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
        
        // Calculate stats (mocked for today)
        const todayApts = apts.filter(a => a.date === today);
        const totalVal = todayApts.reduce((acc, curr: any) => acc + (curr.service.price || 0), 0);
        setStats({ totalServices: todayApts.length, totalValue: totalVal });
      }

      // Fetch availability
      const { data: availData } = await supabase
        .from('barber_availability')
        .select('*')
        .eq('barber_id', barberData.id)
        .order('day_of_week', { ascending: true });

      if (availData) {
        setAvailability(availData);
      } else {
        // Initialize with empty defaults if none exist (0 = Sunday, 1-6 = Mon-Sat)
        const defaults = [0, 1, 2, 3, 4, 5, 6].map(day => ({
          day_of_week: day,
          start_time: '09:00',
          end_time: '18:00',
          is_active: day !== 0 // Default Sunday to inactive
        }));
        setAvailability(defaults);
      }

      // Fetch blocks
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
          const { error } = await supabase.from('barber_availability').update(payload).eq('id', id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('barber_availability').insert([payload]);
          if (error) throw error;
        }
      }
      showNotification('Horários salvos com sucesso!');
      fetchBarberData();
    } catch (error: any) {
      console.error('Erro ao salvar disponibilidade:', error);
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

      const { error } = await supabase.from('barber_blocks').insert([payload]);
      if (error) throw error;

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
      const { error } = await supabase.from('barber_blocks').delete().eq('id', id);
      if (error) throw error;
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
        return prev.map(item => 
          item.day_of_week === day ? { ...item, [field]: value } : item
        );
      } else {
        // If it doesn't exist, add it with default values plus the changed field
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
        <button className="flex items-center gap-2 rounded-xl bg-[#8162ff] px-4 py-2 text-sm font-bold text-white hover:bg-[#6e4ff0] transition-colors">
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
        /* Agenda */
        <div className="rounded-2xl bg-[#1a1a1a] shadow-sm ring-1 ring-[#262626] overflow-hidden">
          <div className="border-b border-[#262626] p-4 sm:px-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between bg-[#1a1a1a]">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#8162ff]" />
              Sua Agenda
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
                        {apt.notes?.startsWith('Serviços:') 
                          ? apt.notes.split('|')[0].replace('Serviços:', '').trim()
                          : apt.service?.name || 'Serviço'} 
                        • <span className="text-[#8162ff] font-bold">
                          {apt.notes?.includes('| Total: R$')
                            ? `R$ ${apt.notes.split('| Total: R$')[1].trim().replace('.', ',')}`
                            : `R$ ${apt.service?.price || 0}`}
                        </span>
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-[#8162ff] bg-[#221c3d] w-fit px-2 py-1 rounded-lg uppercase tracking-wider">
                        <Clock className="h-3 w-3" />
                        {apt.start_time.substring(0, 5)}
                        {apt.end_time && ` - ${apt.end_time.substring(0, 5)}`}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                    <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full ${apt.status === 'completed' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-[#8162ff]/10 text-[#8162ff] border border-[#8162ff]/20'}`}>
                      {apt.status === 'completed' ? 'Concluído' : 'Agendado'}
                    </span>
                    {apt.status !== 'completed' && (
                      <button 
                        onClick={() => handleComplete(apt.id)}
                        className="text-xs font-bold text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                      >
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
        /* Availability Management */
        <div className="space-y-6">
          <div className="rounded-2xl bg-[#1a1a1a] p-4 sm:p-6 shadow-sm ring-1 ring-[#262626]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Horários de Atendimento</h2>
                <p className="text-sm text-zinc-500">Defina os dias e horários que você está disponível.</p>
              </div>
              <button 
                onClick={handleSaveAvailability}
                disabled={saving}
                className="flex items-center justify-center gap-2 bg-[#8162ff] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#6e4ff0] transition-all disabled:opacity-50 shadow-lg shadow-[#8162ff]/20"
              >
                {saving ? 'Salvando...' : <><Save className="h-4 w-4" /> Salvar Alterações</>}
              </button>
            </div>

            <div className="space-y-3">
              {DAYS.map((dayName, index) => {
                const dayAvail = availability.find(a => a.day_of_week === index) || {
                  day_of_week: index,
                  start_time: '09:00',
                  end_time: '18:00',
                  is_active: false
                };

                return (
                  <div 
                    key={index} 
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border transition-all gap-4 ${
                      dayAvail.is_active 
                        ? 'bg-[#262626]/30 border-[#8162ff]/20' 
                        : 'bg-[#1a1a1a] border-[#262626] opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={dayAvail.is_active}
                          onChange={(e) => updateAvailability(index, 'is_active', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#262626] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8162ff]"></div>
                      </label>
                      <span className={`font-bold text-sm sm:text-base ${dayAvail.is_active ? 'text-white' : 'text-zinc-500'}`}>
                        {dayName}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-6">
                      <div className="flex-1 sm:flex-none flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 uppercase font-black tracking-tighter">De</span>
                        <input 
                          type="time" 
                          value={dayAvail.start_time?.substring(0, 5) || '09:00'}
                          disabled={!dayAvail.is_active}
                          onChange={(e) => updateAvailability(index, 'start_time', e.target.value)}
                          className="w-full sm:w-auto bg-[#262626] border-none rounded-xl text-white text-sm font-bold focus:ring-2 focus:ring-[#8162ff] disabled:opacity-30 transition-all px-3 py-2"
                        />
                      </div>
                      <div className="flex-1 sm:flex-none flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 uppercase font-black tracking-tighter">Até</span>
                        <input 
                          type="time" 
                          value={dayAvail.end_time?.substring(0, 5) || '18:00'}
                          disabled={!dayAvail.is_active}
                          onChange={(e) => updateAvailability(index, 'end_time', e.target.value)}
                          className="w-full sm:w-auto bg-[#262626] border-none rounded-xl text-white text-sm font-bold focus:ring-2 focus:ring-[#8162ff] disabled:opacity-30 transition-all px-3 py-2"
                        />
                      </div>
                    </div>

                    <div className="hidden sm:block w-20 text-right">
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${dayAvail.is_active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {dayAvail.is_active ? 'Aberto' : 'Fechado'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 pt-6 border-t border-[#262626]">
              <button 
                onClick={handleSaveAvailability}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-[#8162ff] text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#6e4ff0] transition-all disabled:opacity-50 shadow-xl shadow-[#8162ff]/20"
              >
                {saving ? 'Salvando...' : <><Save className="h-4 w-4" /> Salvar Configurações</>}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Blocks Management */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* New Block Form */}
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl bg-[#1a1a1a] p-6 shadow-sm ring-1 ring-[#262626]">
              <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Ban className="h-5 w-5 text-red-500" />
                Novo Bloqueio
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Data</label>
                  <input 
                    type="date" 
                    value={newBlock.date}
                    onChange={(e) => setNewBlock({...newBlock, date: e.target.value})}
                    className="w-full bg-[#262626] border-none rounded-xl text-white p-3 focus:ring-2 focus:ring-[#8162ff]"
                  />
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#262626]/50 rounded-xl border border-[#262626]">
                  <input 
                    type="checkbox" 
                    id="fullDay"
                    checked={newBlock.isFullDay}
                    onChange={(e) => setNewBlock({...newBlock, isFullDay: e.target.checked})}
                    className="rounded border-zinc-700 bg-zinc-800 text-[#8162ff] focus:ring-[#8162ff]"
                  />
                  <label htmlFor="fullDay" className="text-sm font-bold text-white cursor-pointer">Bloquear dia inteiro</label>
                </div>

                {!newBlock.isFullDay && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Início</label>
                      <input 
                        type="time" 
                        value={newBlock.start_time}
                        onChange={(e) => setNewBlock({...newBlock, start_time: e.target.value})}
                        className="w-full bg-[#262626] border-none rounded-xl text-white p-3 focus:ring-2 focus:ring-[#8162ff]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Fim</label>
                      <input 
                        type="time" 
                        value={newBlock.end_time}
                        onChange={(e) => setNewBlock({...newBlock, end_time: e.target.value})}
                        className="w-full bg-[#262626] border-none rounded-xl text-white p-3 focus:ring-2 focus:ring-[#8162ff]"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Motivo (Opcional)</label>
                  <textarea 
                    value={newBlock.reason}
                    onChange={(e) => setNewBlock({...newBlock, reason: e.target.value})}
                    placeholder="Ex: Feriado, Consulta médica..."
                    className="w-full bg-[#262626] border-none rounded-xl text-white p-3 focus:ring-2 focus:ring-[#8162ff] h-24 resize-none"
                  />
                </div>

                <button 
                  onClick={handleSaveBlock}
                  disabled={saving}
                  className="w-full bg-red-500 text-white py-4 rounded-xl font-bold hover:bg-red-600 transition-all disabled:opacity-50 shadow-lg shadow-red-500/20"
                >
                  {saving ? 'Bloqueando...' : 'Confirmar Bloqueio'}
                </button>
              </div>
            </div>
          </div>

          {/* Blocks List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl bg-[#1a1a1a] shadow-sm ring-1 ring-[#262626] overflow-hidden">
              <div className="p-6 border-b border-[#262626]">
                <h2 className="text-lg font-bold text-white">Bloqueios Ativos</h2>
                <p className="text-sm text-zinc-500">Datas e horários onde sua agenda está fechada.</p>
              </div>

              <div className="divide-y divide-[#262626]">
                {blocks.length === 0 ? (
                  <div className="p-12 text-center text-zinc-500 italic">Nenhum bloqueio futuro configurado.</div>
                ) : (
                  blocks.map((block) => (
                    <div key={block.id} className="p-6 flex items-center justify-between hover:bg-[#262626]/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                          <Ban className="h-6 w-6 text-red-500" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white">
                            {format(parseISO(block.date), "dd 'de' MMMM", { locale: ptBR })}
                          </h3>
                          <p className="text-sm text-zinc-500">
                            {block.start_time ? `${block.start_time.substring(0, 5)} às ${block.end_time?.substring(0, 5)}` : 'Dia Inteiro'}
                            {block.reason && ` • ${block.reason}`}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteBlock(block.id)}
                        className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
