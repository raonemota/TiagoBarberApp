import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { 
  Calendar, Clock, UserPlus, DollarSign, Activity, CheckCircle2, 
  Save, Plus, Trash2, Ban, X, Loader2, History, Search, XCircle,
  MoreVertical, Scissors, Package, ChevronDown
} from 'lucide-react';
import { format, parseISO, differenceInMinutes, parse, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Appointment {
  id: string;
  date: string;
  start_time: string;
  end_time?: string;
  status: string;
  notes?: string;
  client_id?: string;
  unit_id?: string;
  client: { name: string; phone: string };
  service?: { name: string; price: number };
  product?: { name: string; price: number };
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

const maskPhone = (value: string) => {
  return value
    .replace(/\D/g, "")
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .replace(/(-\d{4})(\d+?)$/, "$1");
};

// Função auxiliar com ordenação segura de horários e datas
const groupAppointmentsByClientAndDate = (apts: Appointment[]) => {
  const groups: Record<string, Appointment[]> = {};
  apts.forEach(apt => {
    const clientName = apt.client?.name || 'Cliente Sem Nome';
    const key = `${apt.date}_${clientName}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(apt);
  });
  
  // Ordena os serviços dentro de cada grupo para garantir que o 1º é sempre o mais cedo
  const sortedGroups = Object.values(groups).map(group => {
    return group.sort((a, b) => a.start_time.localeCompare(b.start_time));
  });

  // Retorna as comandas ordenadas pela Data e depois pelo Horário Inicial
  return sortedGroups.sort((a, b) => {
    const dateCmp = a[0].date.localeCompare(b[0].date);
    if (dateCmp !== 0) return dateCmp;
    return a[0].start_time.localeCompare(b[0].start_time);
  });
};

interface GroupedAppointmentRowProps {
  group: Appointment[];
  isHistory?: boolean;
  onCompleteSingle: (id: string) => void;
  onCancelSingle: (id: string) => void;
  onDeleteSingle: (id: string) => void;
  onAddService: (group: Appointment[]) => void;
  onAddProduct: (group: Appointment[]) => void;
  onCompleteGroup: (group: Appointment[]) => void;
  onCancelGroup: (group: Appointment[]) => void;
  onDeleteGroup: (group: Appointment[]) => void;
}

const GroupedAppointmentRow: React.FC<GroupedAppointmentRowProps> = ({ 
  group, 
  isHistory = false,
  onCompleteSingle,
  onCancelSingle,
  onDeleteSingle,
  onAddService,
  onAddProduct,
  onCompleteGroup,
  onCancelGroup,
  onDeleteGroup
}) => {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const activeApts = group.filter(a => a.status !== 'cancelled');
  const firstValidApt = activeApts.length > 0 ? activeApts[0] : group[0];
  
  const clientName = firstValidApt.client?.name || 'Cliente';
  const startTime = firstValidApt.start_time.substring(0, 5);
  const displayDate = firstValidApt.date;
  
  const allCancelled = group.every(a => a.status === 'cancelled');
  const allCompleted = activeApts.length > 0 && activeApts.every(a => a.status === 'completed');
  const someCompleted = activeApts.some(a => a.status === 'completed') && !allCompleted;

  const totalDuration = group.reduce((acc, apt) => {
    if (apt.status === 'cancelled') return acc;
    if (apt.end_time) {
      const start = parse(apt.start_time.substring(0, 5), 'HH:mm', new Date());
      const end = parse(apt.end_time.substring(0, 5), 'HH:mm', new Date());
      return acc + differenceInMinutes(end, start);
    }
    return acc + 30;
  }, 0);

  const totalPrice = group.reduce((sum, apt) => {
    if (apt.status === 'cancelled') return sum;
    const itemPrice = apt.service?.price || apt.product?.price || 0;
    return sum + itemPrice;
  }, 0);

  let overallStatus = 'Agendado';
  let statusColor = 'bg-[#8162ff]/10 text-[#8162ff]';
  if (allCancelled) { 
    overallStatus = 'Cancelado'; 
    statusColor = 'bg-red-500/10 text-red-500'; 
  } else if (allCompleted) { 
    overallStatus = 'FINALIZADO'; 
    statusColor = 'bg-green-500/10 text-green-500'; 
  } else if (someCompleted) { 
    overallStatus = 'Em Andamento'; 
    statusColor = 'bg-yellow-500/10 text-yellow-500'; 
  }

  return (
    <div className={`flex flex-col transition-all rounded-2xl border border-zinc-200 dark:border-[#262626] relative ${allCancelled ? 'bg-red-500/5 hover:bg-red-500/10 opacity-75' : 'bg-white dark:bg-[#1a1a1a] hover:bg-zinc-50 dark:hover:bg-[#262626]/50 shadow-sm'}`}>
      {/* Header com Data e Hora */}
      <div className={`px-4 py-3 flex items-center justify-between border-b border-zinc-200 dark:border-[#262626] rounded-t-2xl ${allCancelled ? 'bg-red-950/20' : 'bg-zinc-50 dark:bg-black/20'}`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-zinc-600 dark:text-zinc-300 uppercase tracking-widest">
            <Calendar className="h-4 w-4 text-[#8162ff]" />
            {format(parseISO(displayDate), "dd 'de' MMM", { locale: ptBR })}
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-zinc-600 dark:text-zinc-300 uppercase tracking-widest">
            <Clock className="h-4 w-4 text-[#8162ff]" />
            {startTime}
          </div>
        </div>
        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md tracking-wider ${statusColor}`}>
          {overallStatus}
        </span>
      </div>

      <div className="p-4 sm:px-6 flex flex-col sm:flex-row justify-between gap-6">
        <div className="flex items-start gap-4 w-full sm:w-auto">
          <div className="flex flex-col flex-1">
            <h3 className={`font-bold text-lg ${allCancelled ? 'text-zinc-400 line-through' : 'text-zinc-900 dark:text-white'}`}>{clientName}</h3>
            
            <div className="mt-2 space-y-1">
              {group.map((apt) => (
                <div key={apt.id} className="flex items-center gap-2 group/item">
                  <span className={`text-sm flex items-center ${apt.status === 'cancelled' ? 'text-zinc-400 dark:text-zinc-600 line-through' : 'text-zinc-600 dark:text-zinc-400'}`}>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold mr-2 ${apt.status === 'cancelled' ? 'bg-zinc-100 dark:bg-black/20' : 'bg-zinc-100 dark:bg-[#262626] text-zinc-600 dark:text-zinc-300'}`}>
                      {apt.start_time.substring(0,5)}
                    </span>
                    {apt.service?.name || apt.product?.name || 'Item'}
                  </span>
                  <span className={`text-xs font-bold ${apt.status === 'cancelled' ? 'text-zinc-400 dark:text-zinc-600 line-through' : 'text-[#8162ff]'}`}>
                    R$ {(apt.service?.price || apt.product?.price || 0).toFixed(2)}
                  </span>
                  
                  {apt.product && <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-500 px-1.5 py-0.5 rounded uppercase font-bold ml-1">Produto</span>}
                  {group.length > 1 && apt.status === 'completed' && <span className="text-[9px] bg-green-500/10 text-green-600 dark:text-green-500 px-1.5 py-0.5 rounded uppercase font-bold ml-1">Ok</span>}
                  {group.length > 1 && apt.status === 'cancelled' && <span className="text-[9px] bg-red-500/10 text-red-600 dark:text-red-500 px-1.5 py-0.5 rounded uppercase font-bold ml-1">Canc</span>}

                  {!isHistory && !allCancelled && !allCompleted && apt.status === 'scheduled' && (
                    <div className="opacity-0 group-hover/item:opacity-100 flex items-center gap-2 ml-2 transition-opacity">
                      <button onClick={() => onCompleteSingle(apt.id)} className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-green-600 dark:hover:text-green-500 hover:bg-green-500/10 transition-colors" title="Finalizar este serviço">
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => onCancelSingle(apt.id)} className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Cancelar este serviço">
                        <XCircle className="h-4 w-4" />
                      </button>
                      <button onClick={() => onDeleteSingle(apt.id)} className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Remover da comanda">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className={`flex items-center gap-2 mt-3 text-[10px] font-bold w-fit px-2 py-1 rounded-lg uppercase tracking-wider ${allCancelled ? 'bg-red-950/30 text-red-500' : 'bg-[#8162ff]/10 dark:bg-[#221c3d] text-[#8162ff]'}`}>
              <Clock className="h-3 w-3" /> Tempo Total: {totalDuration}min
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-start sm:items-end justify-between border-t border-zinc-200 dark:border-[#262626] sm:border-t-0 pt-4 sm:pt-0 gap-3">
          <div className="flex flex-col sm:items-end gap-2 w-full mt-auto">
            <div className="flex justify-between sm:justify-end items-end w-full sm:mb-2">
              <span className="text-xs text-zinc-400 dark:text-zinc-500 uppercase font-bold mr-3 sm:hidden">Total a Receber</span>
              <div className="text-right">
                <div className={`text-xl font-black ${allCancelled ? 'text-zinc-400 dark:text-zinc-500 line-through' : 'text-zinc-900 dark:text-white'}`}>
                  R$ {totalPrice.toFixed(2)}
                </div>
              </div>
            </div>

          {!isHistory && (
            <div className="flex flex-wrap gap-2 justify-end">
              {!allCompleted && !allCancelled && (
                <div className="relative">
                  <button 
                    onClick={() => { setIsAddMenuOpen(!isAddMenuOpen); setIsActionsMenuOpen(false); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#8162ff]/10 text-[#8162ff] hover:bg-[#8162ff]/20 text-xs font-bold transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                    <ChevronDown className={`h-3 w-3 transition-transform ${isAddMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isAddMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsAddMenuOpen(false)} />
                      <div className="absolute right-0 mt-2 w-40 rounded-2xl bg-white dark:bg-[#1a1a1a] p-2 shadow-2xl ring-1 ring-zinc-200 dark:ring-[#262626] z-50 animate-in fade-in zoom-in duration-200 origin-top-right">
                        <button 
                          onClick={() => { onAddService(group); setIsAddMenuOpen(false); }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#262626] hover:text-zinc-900 dark:hover:text-white transition-colors"
                        >
                          <Scissors className="h-3.5 w-3.5 text-[#8162ff]" /> Serviço
                        </button>
                        <button 
                          onClick={() => { onAddProduct(group); setIsAddMenuOpen(false); }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#262626] hover:text-zinc-900 dark:hover:text-white transition-colors"
                        >
                          <Package className="h-3.5 w-3.5 text-amber-500" /> Produto
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="relative">
                <button 
                  onClick={() => { setIsActionsMenuOpen(!isActionsMenuOpen); setIsAddMenuOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold transition-all"
                >
                  <MoreVertical className="h-3.5 w-3.5" /> Ações
                  <ChevronDown className={`h-3 w-3 transition-transform ${isActionsMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isActionsMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsActionsMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-44 rounded-2xl bg-white dark:bg-[#1a1a1a] p-2 shadow-2xl ring-1 ring-zinc-200 dark:ring-[#262626] z-50 animate-in fade-in zoom-in duration-200 origin-top-right">
                      {!allCompleted && !allCancelled && (
                        <button 
                          onClick={() => { onCompleteGroup(group); setIsActionsMenuOpen(false); }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-green-600 dark:text-green-500 hover:bg-green-500/10 transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Finalizar Comanda
                        </button>
                      )}
                      {!allCancelled && (
                        <button 
                          onClick={() => { onCancelGroup(group); setIsActionsMenuOpen(false); }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-amber-600 dark:text-amber-500 hover:bg-amber-500/10 transition-colors"
                        >
                          <Ban className="h-3.5 w-3.5" /> Cancelar Tudo
                        </button>
                      )}
                      <button 
                        onClick={() => { onDeleteGroup(group); setIsActionsMenuOpen(false); }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-red-600 dark:text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Excluir Registro
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default function BarberDashboard() {
  const { profile } = useAuth();
  const { showNotification } = useNotification();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [blocks, setBlocks] = useState<BarberBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [activeTab, setActiveTab] = useState<'agenda' | 'horarios' | 'bloqueios' | 'historico'>('agenda');
  const [barberId, setBarberId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Estados para buscar os serviços do banco (usados no botão de adicionar serviço)
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [addingServiceToGroup, setAddingServiceToGroup] = useState<Appointment[] | null>(null);
  const [addingProductToGroup, setAddingProductToGroup] = useState<Appointment[] | null>(null);

  // Estados para o Histórico
  const [historyAppointments, setHistoryAppointments] = useState<Appointment[]>([]);
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Estados para o Novo Cliente
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientPassword, setNewClientPassword] = useState('');

  const [newBlock, setNewBlock] = useState({
    date: '',
    start_time: '',
    end_time: '',
    reason: '',
    isFullDay: true
  });

  const stats = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayApts = appointments.filter(a => a.date === todayStr && a.status !== 'cancelled');
    const totalVal = todayApts.reduce((acc, curr: any) => acc + (curr.service?.price || curr.product?.price || 0), 0);
    
    // Group appointments to count unique commands
    const todayGroups = groupAppointmentsByClientAndDate(todayApts);
    const openComandas = groupAppointmentsByClientAndDate(appointments.filter(a => a.status === 'scheduled')).length;

    return {
      totalServices: todayApts.length,
      totalValue: totalVal,
      openComandas,
      todayClients: todayGroups.length
    };
  }, [appointments]);

  // Estado Centralizado para o Modal Personalizado de Confirmações
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    type: 'success' | 'danger';
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: async () => {},
    type: 'success'
  });

  const requestConfirm = (title: string, message: string, type: 'success' | 'danger', action: () => Promise<void>) => {
    setConfirmDialog({ isOpen: true, title, message, type, action });
  };

  useEffect(() => {
    if (profile) fetchBarberData();
  }, [profile, view]);

  useEffect(() => {
    if (activeTab === 'historico' && barberId) {
      fetchHistory();
    }
  }, [activeTab, barberId]);

  useEffect(() => {
    const fetchServicesList = async () => {
      const { data } = await supabase.from('services').select('*').order('name');
      if (data) setAvailableServices(data);
    };
    const fetchProductsList = async () => {
      const { data } = await supabase.from('products').select('*').order('name');
      if (data) setAvailableProducts(data);
    };
    fetchServicesList();
    fetchProductsList();
  }, []);

  const fetchBarberData = async () => {
    try {
      const { data: barberData } = await supabase
        .from('barbers')
        .select('id')
        .eq('user_id', profile?.id)
        .single();

      if (!barberData) return;
      setBarberId(barberData.id);

      const todayStr = format(new Date(), 'yyyy-MM-dd');

      const { data: apts } = await supabase
        .from('appointments')
        .select(`
          id, date, start_time, end_time, status, notes, client_id, unit_id,
          client:users!client_id(name, phone),
          service:services(name, price),
          product:products(name, price)
        `)
        .eq('barber_id', barberData.id)
        .gte('date', todayStr)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (apts) {
        setAppointments(apts as any);
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
        .gte('date', todayStr)
        .order('date', { ascending: true });

      if (blocksData) setBlocks(blocksData);
    } catch (error) {
      console.error('Error fetching barber data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!barberId) return;
    setLoadingHistory(true);
    try {
      let query = supabase
        .from('appointments')
        .select(`
          id, date, start_time, end_time, status, notes, client_id, unit_id,
          client:users!client_id(name, phone),
          service:services(name, price),
          product:products(name, price)
        `)
        .eq('barber_id', barberId)
        .order('date', { ascending: false })
        .order('start_time', { ascending: false });

      if (historyStartDate) query = query.gte('date', historyStartDate);
      if (historyEndDate) query = query.lte('date', historyEndDate);

      const { data } = await query;
      if (data) setHistoryAppointments(data as any);
    } catch (error) {
      showNotification('Erro ao buscar histórico.', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateClient = async (e: FormEvent) => {
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

      if (!response.ok) throw new Error('Erro ao criar cliente.');

      setIsClientModalOpen(false);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientPassword('');
      showNotification('Cliente cadastrado com sucesso!', 'success');
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
      showNotification('Horários salvos com sucesso!', 'success');
      fetchBarberData();
    } catch (error: any) {
      showNotification('Erro ao salvar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBlock = async () => {
    if (!barberId || !newBlock.date) return;
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
      showNotification('Bloqueio adicionado com sucesso!', 'success');
      setNewBlock({ date: '', start_time: '', end_time: '', reason: '', isFullDay: true });
      fetchBarberData();
    } catch (error: any) {
      showNotification('Erro ao bloquear.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBlock = async (id: string) => {
    try {
      await supabase.from('barber_blocks').delete().eq('id', id);
      showNotification('Bloqueio removido.', 'success');
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
        return [...prev, { day_of_week: day, start_time: '09:00', end_time: '18:00', is_active: false, [field]: value }]
          .sort((a, b) => a.day_of_week - b.day_of_week);
      }
    });
  };

  // ==========================================
  // FUNÇÕES DE GESTÃO DA COMANDA (COM MODAL)
  // ==========================================

  const handleCompleteGroup = (group: Appointment[]) => {
    const pendingIds = group.filter(a => a.status !== 'completed' && a.status !== 'cancelled').map(a => a.id);
    if (pendingIds.length === 0) return;

    requestConfirm(
      'Finalizar Comanda', 
      'Deseja finalizar todos os serviços pendentes desta comanda?', 
      'success', 
      async () => {
        const { error } = await supabase.from('appointments').update({ status: 'completed' }).in('id', pendingIds);
        if (error) throw error;
        
        showNotification('Comanda finalizada!', 'success');
        fetchBarberData();
        if (activeTab === 'historico') fetchHistory();
      }
    );
  };

  const handleCancelGroup = (group: Appointment[]) => {
    const pendingIds = group.filter(a => a.status !== 'cancelled').map(a => a.id);
    if (pendingIds.length === 0) return;

    requestConfirm(
      'Cancelar Comanda', 
      'Tem certeza que deseja cancelar todos os serviços desta comanda?', 
      'danger', 
      async () => {
        const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).in('id', pendingIds);
        if (error) throw error;
        
        showNotification('Comanda cancelada.', 'success');
        fetchBarberData();
        if (activeTab === 'historico') fetchHistory();
      }
    );
  };

  const handleDeleteGroup = (group: Appointment[]) => {
    requestConfirm(
      'Excluir Comanda', 
      'Esta ação é permanente. Deseja excluir todos os registros desta comanda do sistema?', 
      'danger', 
      async () => {
        const ids = group.map(a => a.id);
        const { error } = await supabase.from('appointments').delete().in('id', ids);
        if (error) throw error;

        showNotification('Agendamentos excluídos.', 'success');
        fetchBarberData();
        if (activeTab === 'historico') fetchHistory();
      }
    );
  };

  const handleCompleteSingle = (id: string) => {
    requestConfirm(
      'Finalizar Serviço', 
      'Deseja marcar este serviço específico como concluído?', 
      'success', 
      async () => {
        const { error } = await supabase.from('appointments').update({ status: 'completed' }).eq('id', id);
        if (error) throw error;

        showNotification('Serviço finalizado!', 'success');
        fetchBarberData();
        if (activeTab === 'historico') fetchHistory();
      }
    );
  };

  const handleCancelSingle = (id: string) => {
    requestConfirm(
      'Cancelar Serviço', 
      'Deseja cancelar este serviço específico?', 
      'danger', 
      async () => {
        const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
        if (error) throw error;

        showNotification('Serviço cancelado.', 'success');
        fetchBarberData();
        if (activeTab === 'historico') fetchHistory();
      }
    );
  };

  const handleDeleteSingle = (id: string) => {
    requestConfirm(
      'Remover Item', 
      'Tem certeza que deseja remover este item da comanda?', 
      'danger', 
      async () => {
        const { error } = await supabase.from('appointments').delete().eq('id', id);
        if (error) throw error;

        showNotification('Item removido com sucesso.', 'success');
        fetchBarberData();
        if (activeTab === 'historico') fetchHistory();
      }
    );
  };

  const handleAddNewServiceToGroup = async (service: any) => {
    if (!addingServiceToGroup || !barberId) return;
    setSaving(true);
    
    try {
      const firstApt = addingServiceToGroup[0];
      if (!firstApt.client_id) throw new Error("Não foi possível identificar o cliente.");

      const activeApts = addingServiceToGroup.filter(a => a.status !== 'cancelled');
      const referenceApt = activeApts.length > 0 ? activeApts[activeApts.length - 1] : addingServiceToGroup[addingServiceToGroup.length - 1];

      let newStartTime = referenceApt.end_time;
      if (!newStartTime) {
        const start = parse(referenceApt.start_time.substring(0, 5), 'HH:mm', new Date());
        newStartTime = format(addMinutes(start, 30), 'HH:mm');
      } else {
        newStartTime = newStartTime.substring(0, 5);
      }

      const newStartTimeDate = parse(newStartTime, 'HH:mm', new Date());
      const newEndTimeDate = addMinutes(newStartTimeDate, service.duration_minutes);
      const newEndTime = format(newEndTimeDate, 'HH:mm');

      let notesText = 'Serviço Adicionado (Comanda)';
      if (firstApt.notes && firstApt.notes.includes('Comanda #')) {
        const match = firstApt.notes.match(/Comanda #[A-Z0-9]+/);
        if (match) notesText = `${match[0]} (Adicionado)`;
      }

      const payload: any = {
        client_id: firstApt.client_id,
        barber_id: barberId,
        service_id: service.id,
        date: firstApt.date,
        start_time: newStartTime,
        end_time: newEndTime,
        status: 'scheduled',
        notes: notesText
      };

      if (firstApt.unit_id) payload.unit_id = firstApt.unit_id;

      const { error } = await supabase.from('appointments').insert([payload]);
      if (error) throw error;

      showNotification(`Serviço "${service.name}" adicionado!`, 'success');
      setAddingServiceToGroup(null);
      
      if (activeTab === 'historico') {
        fetchHistory();
      } else {
        fetchBarberData();
      }
    } catch (error: any) {
      showNotification(error.message || 'Erro ao adicionar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNewProductToGroup = async (product: any) => {
    if (!addingProductToGroup || !barberId) return;
    
    requestConfirm(
      'Adicionar Produto',
      `Deseja adicionar "${product.name}" (R$ ${product.price.toFixed(2)}) a esta comanda?`,
      'success',
      async () => {
        setSaving(true);
        try {
          const firstApt = addingProductToGroup[0];
          if (!firstApt.client_id) throw new Error("Não foi possível identificar o cliente.");

          const activeApts = addingProductToGroup.filter(a => a.status !== 'cancelled');
          const referenceApt = activeApts.length > 0 ? activeApts[activeApts.length - 1] : addingProductToGroup[addingProductToGroup.length - 1];

          let newStartTime = referenceApt.end_time;
          if (!newStartTime) {
            const start = parse(referenceApt.start_time.substring(0, 5), 'HH:mm', new Date());
            newStartTime = format(addMinutes(start, 5), 'HH:mm');
          } else {
            newStartTime = newStartTime.substring(0, 5);
          }

          const newStartTimeDate = parse(newStartTime, 'HH:mm', new Date());
          const newEndTimeDate = addMinutes(newStartTimeDate, 5);
          const newEndTime = format(newEndTimeDate, 'HH:mm');

          let notesText = 'Produto Adicionado (Comanda)';
          if (firstApt.notes && firstApt.notes.includes('Comanda #')) {
            const match = firstApt.notes.match(/Comanda #[A-Z0-9]+/);
            if (match) notesText = `${match[0]} (Produto)`;
          }

          const payload: any = {
            client_id: firstApt.client_id,
            barber_id: barberId,
            product_id: product.id,
            date: firstApt.date,
            start_time: newStartTime,
            end_time: newEndTime,
            status: 'scheduled',
            notes: notesText
          };

          if (firstApt.unit_id) payload.unit_id = firstApt.unit_id;

          const { error } = await supabase.from('appointments').insert([payload]);
          if (error) throw error;

          showNotification(`Produto "${product.name}" adicionado!`, 'success');
          setAddingProductToGroup(null);
          setProductSearchTerm('');
          fetchBarberData();
        } catch (error: any) {
          showNotification(error.message || 'Erro ao adicionar produto.', 'error');
        } finally {
          setSaving(false);
        }
      }
    );
  };

  const groupedAgenda = useMemo(() => groupAppointmentsByClientAndDate(appointments), [appointments]);
  const groupedHistoryData = useMemo(() => groupAppointmentsByClientAndDate(historyAppointments), [historyAppointments]);

  if (loading) return <div className="p-8 text-center text-zinc-500">Carregando painel...</div>;

  return (
    <div className="space-y-8 pb-10 transition-colors duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tighter">Painel do Profissional</h1>
        <button 
          onClick={() => setIsClientModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#8162ff] px-4 py-2 text-sm font-bold text-white hover:bg-[#6e4ff0] transition-colors shadow-lg shadow-[#8162ff]/20"
        >
          <UserPlus className="h-4 w-4" />
          Novo Cliente
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg bg-white dark:bg-[#1a1a1a] p-3 shadow-sm ring-1 ring-zinc-200 dark:ring-[#262626]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#8162ff]/10 rounded-md">
              <Activity className="h-3.5 w-3.5 text-[#8162ff]" />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 leading-none">Serviços Hoje</p>
              <p className="mt-0.5 text-lg font-bold text-zinc-900 dark:text-white leading-none">{stats.totalServices}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-white dark:bg-[#1a1a1a] p-3 shadow-sm ring-1 ring-zinc-200 dark:ring-[#262626]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#8162ff]/10 rounded-md">
              <DollarSign className="h-3.5 w-3.5 text-[#8162ff]" />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 leading-none">A Receber</p>
              <p className="mt-0.5 text-lg font-bold text-zinc-900 dark:text-white leading-none">R$ {stats.totalValue.toFixed(2).replace('.', ',')}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-white dark:bg-[#1a1a1a] p-3 shadow-sm ring-1 ring-zinc-200 dark:ring-[#262626]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#8162ff]/10 rounded-md">
              <Calendar className="h-3.5 w-3.5 text-[#8162ff]" />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 leading-none">Comandas</p>
              <p className="mt-0.5 text-lg font-bold text-zinc-900 dark:text-white leading-none">{stats.openComandas}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-white dark:bg-[#1a1a1a] p-3 shadow-sm ring-1 ring-zinc-200 dark:ring-[#262626]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#8162ff]/10 rounded-md">
              <UserPlus className="h-3.5 w-3.5 text-[#8162ff]" />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 leading-none">Clientes Hoje</p>
              <p className="mt-0.5 text-lg font-bold text-zinc-900 dark:text-white leading-none">{stats.todayClients}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-[#262626] gap-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
        <button 
          onClick={() => setActiveTab('agenda')}
          className={`pb-4 text-sm font-bold transition-all border-b-2 px-1 ${activeTab === 'agenda' ? 'border-[#8162ff] text-[#8162ff] dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
        >
          Agenda
        </button>
        <button 
          onClick={() => setActiveTab('historico')}
          className={`pb-4 text-sm font-bold transition-all border-b-2 px-1 ${activeTab === 'historico' ? 'border-[#8162ff] text-[#8162ff] dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
        >
          Histórico
        </button>
        <button 
          onClick={() => setActiveTab('horarios')}
          className={`pb-4 text-sm font-bold transition-all border-b-2 px-1 ${activeTab === 'horarios' ? 'border-[#8162ff] text-[#8162ff] dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
        >
          Horários de Trabalho
        </button>
        <button 
          onClick={() => setActiveTab('bloqueios')}
          className={`pb-4 text-sm font-bold transition-all border-b-2 px-1 ${activeTab === 'bloqueios' ? 'border-[#8162ff] text-[#8162ff] dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
        >
          Bloqueios
        </button>
      </div>

      {activeTab === 'agenda' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white dark:bg-[#1a1a1a] p-4 sm:px-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between ring-1 ring-zinc-200 dark:ring-[#262626] shadow-sm">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#8162ff]" /> Comandas Abertas
            </h2>
            <div className="flex bg-zinc-100 dark:bg-[#262626] p-1 rounded-xl w-fit">
              {['day', 'week', 'month'].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v as any)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg capitalize transition-all ${view === v ? 'bg-[#8162ff] text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                >
                  {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {groupedAgenda.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 rounded-2xl bg-white dark:bg-[#1a1a1a] ring-1 ring-zinc-200 dark:ring-[#262626] shadow-sm">Nenhum agendamento encontrado para hoje.</div>
            ) : (
              groupedAgenda.map((group) => (
                <GroupedAppointmentRow 
                  key={group[0].id} 
                  group={group} 
                  isHistory={false}
                  onCompleteSingle={handleCompleteSingle}
                  onCancelSingle={handleCancelSingle}
                  onDeleteSingle={handleDeleteSingle}
                  onAddService={setAddingServiceToGroup}
                  onAddProduct={setAddingProductToGroup}
                  onCompleteGroup={handleCompleteGroup}
                  onCancelGroup={handleCancelGroup}
                  onDeleteGroup={handleDeleteGroup}
                />
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'historico' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white dark:bg-[#1a1a1a] p-4 sm:px-6 flex flex-col lg:flex-row gap-4 lg:items-center justify-between ring-1 ring-zinc-200 dark:ring-[#262626] shadow-sm">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <History className="h-5 w-5 text-[#8162ff]" /> Histórico de Comandas
            </h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <input 
                  type="date" 
                  value={historyStartDate} 
                  onChange={(e) => setHistoryStartDate(e.target.value)} 
                  className="w-full sm:w-auto bg-zinc-100 dark:bg-[#262626] text-zinc-900 dark:text-white px-3 py-2 rounded-xl text-sm outline-none focus:ring-1 focus:ring-[#8162ff] border-none" 
                  title="Data Início"
                />
                <span className="text-zinc-500 hidden sm:block">até</span>
                <input 
                  type="date" 
                  value={historyEndDate} 
                  onChange={(e) => setHistoryEndDate(e.target.value)} 
                  className="w-full sm:w-auto bg-zinc-100 dark:bg-[#262626] text-zinc-900 dark:text-white px-3 py-2 rounded-xl text-sm outline-none focus:ring-1 focus:ring-[#8162ff] border-none" 
                  title="Data Fim"
                />
              </div>
              <button 
                onClick={fetchHistory} 
                className="bg-[#8162ff] hover:bg-[#6e4ff0] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-[#8162ff]/20"
              >
                <Search className="h-4 w-4" /> Filtrar
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {loadingHistory ? (
              <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white dark:bg-[#1a1a1a] ring-1 ring-zinc-200 dark:ring-[#262626] shadow-sm">
                <Loader2 className="h-6 w-6 animate-spin text-[#8162ff]" />
                Buscando histórico...
              </div>
            ) : groupedHistoryData.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 rounded-2xl bg-white dark:bg-[#1a1a1a] ring-1 ring-zinc-200 dark:ring-[#262626] shadow-sm">Nenhum agendamento encontrado para o período.</div>
            ) : (
              groupedHistoryData.map((group) => (
                <GroupedAppointmentRow 
                  key={group[0].id} 
                  group={group} 
                  isHistory={true}
                  onCompleteSingle={handleCompleteSingle}
                  onCancelSingle={handleCancelSingle}
                  onDeleteSingle={handleDeleteSingle}
                  onAddService={setAddingServiceToGroup}
                  onAddProduct={setAddingProductToGroup}
                  onCompleteGroup={handleCompleteGroup}
                  onCancelGroup={handleCancelGroup}
                  onDeleteGroup={handleDeleteGroup}
                />
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'horarios' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white dark:bg-[#1a1a1a] p-4 sm:p-6 shadow-sm ring-1 ring-zinc-200 dark:ring-[#262626]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Horários de Atendimento</h2>
              </div>
              <button onClick={handleSaveAvailability} disabled={saving} className="flex items-center justify-center gap-2 bg-[#8162ff] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#6e4ff0] transition-all disabled:opacity-50 shadow-lg shadow-[#8162ff]/20">
                {saving ? 'Salvando...' : <><Save className="h-4 w-4" /> Salvar Alterações</>}
              </button>
            </div>
            <div className="space-y-3">
              {DAYS.map((dayName, index) => {
                const dayAvail = availability.find(a => a.day_of_week === index) || { day_of_week: index, start_time: '09:00', end_time: '18:00', is_active: false };
                return (
                  <div key={index} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border transition-all gap-4 ${dayAvail.is_active ? 'bg-zinc-50 dark:bg-[#262626]/30 border-[#8162ff]/20' : 'bg-white dark:bg-[#1a1a1a] border-zinc-100 dark:border-[#262626] opacity-60'}`}>
                    <div className="flex items-center gap-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={dayAvail.is_active} onChange={(e) => updateAvailability(index, 'is_active', e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-zinc-200 dark:bg-[#262626] rounded-full peer peer-checked:bg-[#8162ff] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                      </label>
                      <span className={`font-bold text-sm ${dayAvail.is_active ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>{dayName}</span>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-6">
                      <input type="time" value={dayAvail.start_time?.substring(0, 5)} disabled={!dayAvail.is_active} onChange={(e) => updateAvailability(index, 'start_time', e.target.value)} className="bg-zinc-100 dark:bg-[#262626] rounded-xl text-zinc-900 dark:text-white text-sm font-bold px-3 py-2 disabled:opacity-30 outline-none border-none" />
                      <span className="text-[10px] text-zinc-500 uppercase font-black">Até</span>
                      <input type="time" value={dayAvail.end_time?.substring(0, 5)} disabled={!dayAvail.is_active} onChange={(e) => updateAvailability(index, 'end_time', e.target.value)} className="bg-zinc-100 dark:bg-[#262626] rounded-xl text-zinc-900 dark:text-white text-sm font-bold px-3 py-2 disabled:opacity-30 outline-none border-none" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'bloqueios' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl bg-white dark:bg-[#1a1a1a] p-6 ring-1 ring-zinc-200 dark:ring-[#262626] shadow-sm">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2"><Ban className="h-5 w-5 text-red-500" /> Novo Bloqueio</h2>
              <div className="space-y-4">
                <input type="date" value={newBlock.date} onChange={(e) => setNewBlock({...newBlock, date: e.target.value})} className="w-full bg-zinc-100 dark:bg-[#262626] rounded-xl text-zinc-900 dark:text-white p-3 outline-none border-none" />
                <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-[#262626]/50 rounded-xl cursor-pointer" onClick={() => setNewBlock({...newBlock, isFullDay: !newBlock.isFullDay})}>
                  <input type="checkbox" id="fullDay" checked={newBlock.isFullDay} readOnly className="pointer-events-none" />
                  <label className="text-sm font-bold text-zinc-900 dark:text-white cursor-pointer">Bloquear dia inteiro</label>
                </div>
                {!newBlock.isFullDay && (
                  <div className="grid grid-cols-2 gap-4">
                    <input type="time" value={newBlock.start_time} onChange={(e) => setNewBlock({...newBlock, start_time: e.target.value})} className="w-full bg-zinc-100 dark:bg-[#262626] rounded-xl text-zinc-900 dark:text-white p-3 outline-none border-none" />
                    <input type="time" value={newBlock.end_time} onChange={(e) => setNewBlock({...newBlock, end_time: e.target.value})} className="w-full bg-zinc-100 dark:bg-[#262626] rounded-xl text-zinc-900 dark:text-white p-3 outline-none border-none" />
                  </div>
                )}
                <textarea value={newBlock.reason} onChange={(e) => setNewBlock({...newBlock, reason: e.target.value})} placeholder="Motivo (opcional)..." className="w-full bg-zinc-100 dark:bg-[#262626] rounded-xl text-zinc-900 dark:text-white p-3 h-24 resize-none outline-none border-none" />
                <button onClick={handleSaveBlock} disabled={saving} className="w-full bg-red-500/10 text-red-600 dark:text-red-500 py-4 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-colors">Confirmar Bloqueio</button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl bg-white dark:bg-[#1a1a1a] ring-1 ring-zinc-200 dark:ring-[#262626] overflow-hidden shadow-sm">
              <div className="p-6 border-b border-zinc-100 dark:border-[#262626]"><h2 className="text-lg font-bold text-zinc-900 dark:text-white">Bloqueios Ativos</h2></div>
              <div className="divide-y divide-zinc-100 dark:divide-[#262626]">
                {blocks.length === 0 ? <div className="p-12 text-center text-zinc-500">Nenhum bloqueio.</div> : blocks.map((block) => (
                  <div key={block.id} className="p-6 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-[#262626]/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center"><Ban className="h-6 w-6 text-red-500" /></div>
                      <div>
                        <h3 className="font-bold text-zinc-900 dark:text-white">{format(parseISO(block.date), "dd 'de' MMMM", { locale: ptBR })}</h3>
                        <p className="text-sm text-zinc-500">
                          {block.start_time ? `${block.start_time.substring(0, 5)} às ${block.end_time?.substring(0, 5)}` : 'Dia Inteiro'}
                          {block.reason && ` • ${block.reason}`}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteBlock(block.id)} className="p-2 text-zinc-400 hover:text-red-500 transition-colors"><Trash2 className="h-5 w-5" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Serviço à Comanda */}
      {addingServiceToGroup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl w-full max-w-md p-8 shadow-2xl ring-1 ring-zinc-200 dark:ring-[#262626] max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#8162ff]/10 text-[#8162ff] rounded-xl"><Plus className="h-6 w-6" /></div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tighter">Adicionar Serviço</h3>
              </div>
              <button onClick={() => setAddingServiceToGroup(null)} className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"><X className="h-6 w-6" /></button>
            </div>
            
            <div className="overflow-y-auto pr-2 space-y-3 no-scrollbar pb-4">
              {availableServices.map(srv => (
                  <button 
                    key={srv.id}
                    onClick={() => handleAddNewServiceToGroup(srv)}
                    disabled={saving}
                    className="w-full p-4 rounded-xl border border-zinc-100 dark:border-[#262626] bg-zinc-50 dark:bg-[#262626]/30 hover:bg-zinc-100 dark:hover:bg-[#262626] flex items-center justify-between transition-colors disabled:opacity-50 text-left"
                  >
                      <div>
                          <p className="font-bold text-zinc-900 dark:text-white text-sm">{srv.name}</p>
                          <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-bold flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {srv.duration_minutes} min
                          </p>
                      </div>
                      <span className="font-black text-lg text-[#8162ff]">R$ {srv.price.toFixed(2)}</span>
                  </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Produto à Comanda */}
      {addingProductToGroup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl w-full max-w-md p-8 shadow-2xl ring-1 ring-zinc-200 dark:ring-[#262626] max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl"><Package className="h-6 w-6" /></div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tighter">Adicionar Produto</h3>
              </div>
              <button 
                onClick={() => {
                  setAddingProductToGroup(null);
                  setProductSearchTerm('');
                }} 
                className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="relative mb-4 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input 
                type="text"
                placeholder="Buscar produto..."
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                className="w-full bg-zinc-100 dark:bg-[#262626] border-none rounded-xl py-2.5 pl-10 pr-4 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-amber-500/50 transition-all text-sm outline-none"
              />
            </div>
            
            <div className="overflow-y-auto pr-2 space-y-2 no-scrollbar pb-4">
              {availableProducts
                .filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()))
                .map(prod => (
                  <button 
                    key={prod.id}
                    onClick={() => {
                      handleAddNewProductToGroup(prod);
                      setProductSearchTerm('');
                    }}
                    disabled={saving}
                    className="w-full p-3 rounded-xl border border-zinc-100 dark:border-[#262626] bg-zinc-50 dark:bg-[#262626]/30 hover:bg-zinc-100 dark:hover:bg-[#262626] flex items-center justify-between transition-colors disabled:opacity-50 text-left group"
                  >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-[#1a1a1a] overflow-hidden flex-shrink-0 ring-1 ring-zinc-200 dark:ring-[#262626]">
                          {prod.image_url ? (
                            <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-800">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <span className="font-bold text-zinc-900 dark:text-white text-sm group-hover:text-amber-500 transition-colors">{prod.name}</span>
                      </div>
                      <span className="font-black text-sm text-amber-500">R$ {prod.price.toFixed(2)}</span>
                  </button>
              ))}
              {availableProducts.filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase())).length === 0 && (
                <div className="p-8 text-center text-zinc-500 text-sm">Nenhum produto encontrado.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Genérico de Confirmação */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl w-full max-w-sm p-6 shadow-2xl ring-1 ring-zinc-200 dark:ring-[#262626] animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className={`p-4 rounded-full ${confirmDialog.type === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                {confirmDialog.type === 'danger' ? <XCircle className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tighter">{confirmDialog.title}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">{confirmDialog.message}</p>
              </div>
              <div className="flex w-full gap-3 mt-4">
                <button 
                  onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                  className="flex-1 py-3 rounded-xl font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-[#262626] hover:bg-zinc-200 dark:hover:bg-[#333] transition-colors"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await confirmDialog.action();
                      setConfirmDialog({ ...confirmDialog, isOpen: false });
                    } catch (err: any) {
                      showNotification(err.message || 'Erro ao processar', 'error');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className={`flex-1 py-3 rounded-xl font-bold text-white transition-colors flex justify-center items-center ${confirmDialog.type === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Cliente */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl w-full max-w-md p-8 shadow-2xl ring-1 ring-zinc-200 dark:ring-[#262626]">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#8162ff] text-white rounded-xl"><UserPlus className="h-6 w-6" /></div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tighter">Novo Cliente</h3>
              </div>
              <button onClick={() => setIsClientModalOpen(false)} className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"><X className="h-6 w-6" /></button>
            </div>
            
            <form onSubmit={handleCreateClient} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Nome Completo</label>
                <input required type="text" placeholder="Ex: João Silva" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} className="w-full rounded-xl border-none bg-zinc-100 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white focus:ring-2 focus:ring-[#8162ff] outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Email</label>
                <input required type="email" placeholder="joao@email.com" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} className="w-full rounded-xl border-none bg-zinc-100 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white focus:ring-2 focus:ring-[#8162ff] outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Telefone</label>
                <input required type="text" placeholder="(11) 99999-9999" value={newClientPhone} onChange={(e) => setNewClientPhone(maskPhone(e.target.value))} className="w-full rounded-xl border-none bg-zinc-100 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white focus:ring-2 focus:ring-[#8162ff] outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Senha Temporária</label>
                <input required type="password" placeholder="••••••••" value={newClientPassword} onChange={(e) => setNewClientPassword(e.target.value)} className="w-full rounded-xl border-none bg-zinc-100 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white focus:ring-2 focus:ring-[#8162ff] outline-none" />
              </div>
              <button type="submit" disabled={saving} className="w-full py-4 bg-[#8162ff] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#6e4ff0] disabled:opacity-50 shadow-lg shadow-[#8162ff]/20 transition-all">
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